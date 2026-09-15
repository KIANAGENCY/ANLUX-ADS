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
const { CONVERSATION_ACTION: event, conversationCount, buildMessagingReport, applyInferredDestinations } = logic;
const action = (value, destination) => ({ action_type: event, value, action_destination: destination });
assert.equal(conversationCount(undefined), null);
assert.equal(conversationCount([]), null);
assert.equal(conversationCount([action('0')]), 0);
assert.equal(conversationCount([action('12')]), 12);
for (const value of ['', 'invalid', '-1', undefined, null]) assert.equal(conversationCount([action(value)]), null);
assert.equal(conversationCount([{ action_type: 'link_click', value: '150' }, { action_type: 'onsite_conversion.total_messaging_connection', value: '50' }]), null);
assert.equal(conversationCount([action('12'), { action_type: 'onsite_conversion.total_messaging_connection', value: '50' }]), 12);
const totals = [{ campaign_id: 'c1', campaign_name: 'Hotel Expert', actions: [action('12')] }, { campaign_id: 'c2', actions: [] }];
const details = [{ campaign_id: 'c1', publisher_platform: 'facebook', actions: [action('7', 'whatsapp')] }, { campaign_id: 'c1', publisher_platform: 'instagram', actions: [action('5', 'whatsapp')] }];
let report = buildMessagingReport(totals, details);
assert.equal(report[0].conversations, 12);
assert.equal(report[0].details.length, 2);
assert.equal(report[0].details[0].destination, 'WhatsApp');
assert.equal(report[0].details[1].source, 'Instagram');
assert.equal(report[1].conversations, null);
report = buildMessagingReport(totals, [{ campaign_id: 'c1', actions: [action('12', 'unknown')] }]);
assert.equal(report[0].details[0].destination, 'Destino no identificado');
report = applyInferredDestinations(report, new Map([['c1', 'WhatsApp']]));
assert.equal(report[0].details[0].destination, 'WhatsApp');
assert.throws(() => buildMessagingReport([totals[0], totals[0]], []));
assert.throws(() => buildMessagingReport([{}], []));
assert.equal(buildMessagingReport(totals, [details[0]])[0].conversations, 12, 'Partial breakdown does not replace total');

class MetaApiError extends Error { constructor(kind, message) { super(message); this.kind = kind; } }
const adSets = [{ campaignId: 'c1', whatsappDestination: true, destinationType: 'WHATSAPP' }];
const createService = get => load('src/lib/meta/real/messaging.ts', {
  '../messaging': logic,
  './graph-client': { metaGraphGet: get, MetaApiError },
  './adsets': { fetchRealAdSets: async () => adSets },
});
async function main() {
  const requests = [];
  let count = 0;
  const paginated = createService(async (url, params) => {
    requests.push({ url, params });
    if (params.breakdowns) return { data: details };
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
  const fallback = createService(async (_, params) => {
    if (params.breakdowns) throw Error('Unsupported combination');
    return { data: params.action_breakdowns ? [{ campaign_id: 'c1', actions: [action('12')] }] : totals };
  });
  const fallbackReport = await fallback.fetchMessagingReport('act_1', '2026-09-01', '2026-09-15');
  assert.equal(fallbackReport.campaigns[0].conversations, 12);
  assert.equal(fallbackReport.campaigns[0].details[0].destination, 'WhatsApp');
  assert.equal(fallbackReport.warnings.length, 1);
  const noDetails = createService(async (_, params) => { if (params.action_breakdowns) throw Error('secret must not be exposed'); return { data: totals }; });
  const noDetailsReport = await noDetails.fetchMessagingReport('act_1', '2026-09-01', '2026-09-15');
  assert.equal(noDetailsReport.campaigns[0].conversations, 12);
  assert.equal(noDetailsReport.warnings.length, 2);
  assert.ok(!JSON.stringify(noDetailsReport).includes('secret'));
  const failedTotals = createService(async () => { throw new MetaApiError('invalid_token', 'No access'); });
  await assert.rejects(() => failedTotals.fetchMessagingReport('act_1', '2026-09-01', '2026-09-15'), /No access/);
  const loop = createService(async () => ({ data: [], paging: { next: 'next', cursors: { after: 'same' } } }));
  await assert.rejects(() => loop.fetchMessagingReport('act_1', '2026-09-01', '2026-09-15'), /páginas/);
  console.log('Messaging regression checks passed: counts, inferred destination, attribution, grouping, pagination, fallbacks and errors.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
