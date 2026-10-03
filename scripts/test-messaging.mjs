import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function load(file, imports = {}) {
  const loadedModule = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { module: loadedModule, exports: loadedModule.exports, require(name) {
    if (name === 'server-only') return {};
    if (name in imports) return imports[name];
    throw Error(`Unexpected import ${name}`);
  } });
  return loadedModule.exports;
}
const logic = load('src/lib/meta/messaging.ts');
const { CONVERSATION_ACTION: event, conversationCount, buildMessagingReport } = logic;
const action = (value, destination) => ({ action_type: event, value, action_destination: destination });
assert.equal(conversationCount(undefined), null);
assert.equal(conversationCount([]), null);
assert.equal(conversationCount([action('0')]), 0);
assert.equal(conversationCount([action('12')]), 12);
for (const value of ['', 'invalid', '-1', undefined, null]) assert.equal(conversationCount([action(value)]), null);
assert.equal(conversationCount([{ action_type: 'link_click', value: '150' }, { action_type: 'onsite_conversion.total_messaging_connection', value: '50' }]), null);
assert.equal(conversationCount([action('12'), { action_type: 'onsite_conversion.total_messaging_connection', value: '50' }]), 12);
const totals = [{ campaign_id: 'c1', campaign_name: 'Hotel Expert', actions: [action('12')] }, { campaign_id: 'c2', actions: [] }];
const details = [{ campaign_id: 'c1', actions: [action('7', 'whatsapp')] }, { campaign_id: 'c1', actions: [action('5', 'instagram_direct')] }];
let report = buildMessagingReport(totals, details);
assert.equal(report[0].conversations, 12);
assert.equal(report[0].details.length, 2);
assert.equal(report[0].details[0].destination, 'WhatsApp');
assert.equal(report[0].details[1].destination, 'Instagram Direct');
assert.equal(report[1].conversations, null);
report = buildMessagingReport(totals, [{ campaign_id: 'c1', actions: [action('12', 'unknown')] }]);
assert.equal(report[0].details.length, 0, 'Unknown destinations are never assigned to a channel');
assert.throws(() => buildMessagingReport([totals[0], totals[0]], []));
assert.throws(() => buildMessagingReport([{}], []));
assert.equal(buildMessagingReport(totals, [details[0]])[0].conversations, 12, 'Partial breakdown does not replace total');

// A current ad configuration is not proof of the historic destination of a conversation.
const mixed = buildMessagingReport(totals, [
  { campaign_id: 'c1', configuredDestination: 'Messenger', actions: [action('4')] },
  { campaign_id: 'c1', configuredDestination: 'WhatsApp', actions: [action('3')] },
  { campaign_id: 'c1', actions: [action('5', 'whatsapp')] },
]);
assert.equal(mixed[0].details.length, 1);
assert.equal(mixed[0].details[0].destination, 'WhatsApp');
assert.equal(mixed[0].details[0].conversations, 5);
assert.equal(mixed[0].conversations, 12);

// The response shape seen in production: totals exist without any destination.
assert.equal(logic.messagingContract({ campaigns: buildMessagingReport([totals[0]], []), warnings: [] }).state, 'incomplete');
assert.equal(logic.messagingContract({ campaigns: buildMessagingReport([totals[0]], details), warnings: [] }).state, 'verified');
assert.equal(logic.messagingContract({ campaigns: buildMessagingReport([{ campaign_id: 'zero', actions: [action('0')] }], []), warnings: [] }).state, 'no_observations');
assert.equal(logic.messagingContract({ campaigns: buildMessagingReport([{ campaign_id: 'missing' }], []), warnings: [] }).state, 'unavailable');
const partial = buildMessagingReport([totals[0]], [details[0]])[0];
assert.equal(partial.attributionStatus, 'partial');
assert.equal(partial.unattributedConversations, 5);
const incompatible = buildMessagingReport([totals[0]], [{ campaign_id: 'c1', actions: [action('13', 'whatsapp')] }])[0];
assert.equal(incompatible.attributionStatus, 'inconsistent');
assert.equal(incompatible.details.length, 0);

class MetaApiError extends Error { constructor(kind, message) { super(message); this.kind = kind; } }
const createService = get => load('src/lib/meta/real/messaging.ts', {
  '../messaging': logic,
  './graph-client': { metaGraphGet: get, MetaApiError },
});
async function main() {
  const requests = [];
  let count = 0;
  const paginated = createService(async (url, params) => {
    requests.push({ url, params });
    if (params.action_breakdowns) return { data: details };
    count++;
    if (!params.after) return { data: [totals[0]], paging: { next: 'https://never-follow.invalid/?access_token=secret', cursors: { after: 'next-page' } } };
    return { data: [totals[1]] };
  });
  const result = await paginated.fetchMessagingReport('act_1', '2026-09-01', '2026-09-15');
  assert.equal(count, 2);
  assert.equal(result.campaigns.length, 2);
  assert.ok(requests.every(r => r.url === '/act_1/insights'));
  assert.ok(requests.every(r => r.params.use_unified_attribution_setting === 'true'));
  assert.ok(requests.every(r => r.params.time_range === '{"since":"2026-09-01","until":"2026-09-15"}'));
  const fallbackRequests = [];
  const fallback = createService(async (_, params) => {
    fallbackRequests.push(params);
    if (params.breakdowns || params.action_breakdowns === 'action_type,conversion_destination') throw new MetaApiError('unknown', 'Unsupported conversion destination');
    if (params.level === 'campaign' && params.action_breakdowns) return { data: [{ campaign_id: 'c1', actions: [action('12')] }] };
    if (params.level === 'adset' && params.action_breakdowns) throw Error('Unsupported breakdown at ad set level');
    if (params.level === 'ad' && params.action_breakdowns) return { data: [{ campaign_id: 'c1', ad_id: 'ad-1', actions: [action('8', 'whatsapp'), action('4', 'messenger')] }] };
    return { data: totals };
  });
  const fallbackReport = await fallback.fetchMessagingReport('act_1', '2026-09-01', '2026-09-15');
  assert.equal(fallbackReport.campaigns[0].conversations, 12);
  assert.equal(JSON.stringify(fallbackReport.campaigns[0].details.map(d => [d.destination, d.conversations])), JSON.stringify([['WhatsApp', 8], ['Messenger', 4]]));
  assert.equal(fallbackReport.campaigns[0].attributionStatus, "complete");
  assert.deepEqual(fallbackRequests.filter(r => r.action_breakdowns === 'action_type,action_destination').map(r => r.level), ['campaign', 'adset', 'ad']);
  assert.ok(fallbackRequests.every(r => r.breakdowns !== 'publisher_platform'));
  const conversionRows = createService(async (_, params) => params.breakdowns === 'conversion_destination'
    ? { data: [{ campaign_id: 'c1', conversion_destination: 'WHATSAPP', actions: [action('7')] }, { campaign_id: 'c1', conversion_destination: 'MESSENGER', actions: [action('5')] }] }
    : { data: totals });
  const conversionReport = await conversionRows.fetchMessagingReport('act_1', '2026-09-01', '2026-09-15');
  assert.equal(JSON.stringify(conversionReport.campaigns[0].details.map(d => [d.destination, d.conversations])), JSON.stringify([['WhatsApp', 7], ['Messenger', 5]]));
  assert.equal(conversionReport.campaigns[0].conversations, 12);
  const conversionActions = createService(async (_, params) => {
    if (params.breakdowns) throw new MetaApiError('unknown', 'Unsupported row breakdown');
    if (params.action_breakdowns === 'action_type,conversion_destination') return { data: [{ campaign_id: 'c1', actions: [{ action_type: event, value: '12', conversion_destination: 'INSTAGRAM_DIRECT' }] }] };
    return { data: totals };
  });
  assert.equal((await conversionActions.fetchMessagingReport('act_1', '2026-09-01', '2026-09-15')).campaigns[0].details[0].destination, 'Instagram Direct');
  const noDetails = createService(async (_, params) => params.action_breakdowns
    ? { data: [{ campaign_id: 'c1', actions: [action('12')] }] }
    : { data: totals });
  const noDetailsReport = await noDetails.fetchMessagingReport('act_1', '2026-09-01', '2026-09-15');
  assert.equal(noDetailsReport.campaigns[0].conversations, 12);
  assert.ok(noDetailsReport.warnings.length >= 1);
  assert.equal(noDetailsReport.campaigns[0].details.length, 0, 'Unknown destination never borrows current ad configuration');
  // One campaign's successful breakdown cannot hide another campaign's missing destinations.
  const twoTotals = [totals[0], { campaign_id: 'c2', actions: [action('3')] }];
  let attempts = 0;
  const partialThenComplete = createService(async (_, params) => {
    if (!params.action_breakdowns) return { data: twoTotals };
    attempts++;
    return { data: attempts === 1 ? details : [...details, { campaign_id: 'c2', actions: [action('3', 'messenger')] }] };
  });
  const completed = await partialThenComplete.fetchMessagingReport('act_1', '2026-09-01', '2026-09-15');
  assert.equal(attempts, 2);
  assert.equal(completed.campaigns[0].conversations, 12, 'overlapping responses never sum');
  assert.equal(completed.campaigns[1].attributionStatus, 'complete');
  assert.equal(completed.warnings.length, 0);
  const betterPartial = createService(async (_, params) => !params.action_breakdowns ? { data: [totals[0]] }
    : { data: params.level === 'adset' ? details : [details[0]] });
  const improved = await betterPartial.fetchMessagingReport('act_1', '2026-09-01', '2026-09-15');
  assert.equal(improved.campaigns[0].attributionStatus, 'complete');
  assert.equal(improved.campaigns[0].details[0].conversations, 7);
  const failedTotals = createService(async () => { throw new MetaApiError('invalid_token', 'No access'); });
  await assert.rejects(() => failedTotals.fetchMessagingReport('act_1', '2026-09-01', '2026-09-15'), /No access/);
  const loop = createService(async () => ({ data: [], paging: { next: 'next', cursors: { after: 'same' } } }));
  await assert.rejects(() => loop.fetchMessagingReport('act_1', '2026-09-01', '2026-09-15'), /páginas/);
  console.log('Messaging regression checks passed: campaign totals, exact destinations, ad-level fallback, pagination and unknown-destination guards.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
