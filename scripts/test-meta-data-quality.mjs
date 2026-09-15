import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function load(file, imports = {}) {
  const loadedModule = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, {
    module: loadedModule,
    exports: loadedModule.exports,
    require(name) {
      if (name === "server-only") return {};
      if (name in imports) return imports[name];
      throw Error(`Unexpected import ${name} from ${file}`);
    },
  });
  return loadedModule.exports;
}

const actions = load("src/lib/meta/real/actions.ts");

async function testInsightIdentityAndPagination() {
  const requests = [];
  const graph = {
    async metaGraphGet(url, params) {
      requests.push({ url, params });
      if (!params.after) {
        const id = params.level === "campaign" ? { campaign_id: "c1" } : params.level === "adset" ? { campaign_id: "c1", adset_id: "s1" } : { campaign_id: "c1", adset_id: "s1", ad_id: "a1" };
        return { data: [{ ...id, spend: "10", impressions: "100" }], paging: { next: "opaque-next", cursors: { after: "page-2" } } };
      }
      const id = params.level === "campaign" ? { campaign_id: "c2" } : params.level === "adset" ? { campaign_id: "c1", adset_id: "s2" } : { campaign_id: "c1", adset_id: "s1", ad_id: "a2" };
      return { data: [{ ...id, spend: "5", impressions: "50" }] };
    },
  };
  const insights = load("src/lib/meta/real/insights.ts", { "./graph-client": graph, "./actions": actions });

  const campaigns = await insights.fetchAggregatedInsightsByEntity("act_1", "campaign", "2026-09-01", "2026-09-15");
  assert.equal(campaigns.size, 2, "campaign insight pagination must preserve both entities");
  const campaignFields = requests.find((r) => r.params.level === "campaign").params.fields;
  assert.ok(campaignFields.includes("campaign_id"), "campaign insights must request campaign_id");

  requests.length = 0;
  const adsets = await insights.fetchAggregatedInsightsByEntity("act_1", "adset", "2026-09-01", "2026-09-15");
  assert.equal(adsets.size, 2);
  const adsetFields = requests[0].params.fields;
  assert.ok(adsetFields.includes("campaign_id"));
  assert.ok(adsetFields.includes("adset_id"));

  requests.length = 0;
  const ads = await insights.fetchAggregatedInsightsByEntity("act_1", "ad", "2026-09-01", "2026-09-15");
  assert.equal(ads.size, 2);
  const adFields = requests[0].params.fields;
  assert.ok(adFields.includes("campaign_id"));
  assert.ok(adFields.includes("adset_id"));
  assert.ok(adFields.includes("ad_id"));

  const exactMessage = { actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "3" }] };
  const connectionOnly = { actions: [{ action_type: "onsite_conversion.total_messaging_connection", value: "7" }] };
  assert.equal(insights.hasPrimaryResult(exactMessage, "MESSAGES"), true);
  assert.equal(insights.hasPrimaryResult(connectionOnly, "MESSAGES"), false, "messaging connections are not conversations");
}

function testDecisionMissingResultGuard() {
  const engine = load("src/lib/decisions/engine.ts");
  const safe = load("src/lib/decisions/safe-evaluate.ts", { "./engine": engine });
  const metrics = {
    spend: 120,
    reach: 2500,
    impressions: 5000,
    clicks: 100,
    results: 0,
    frequency: 2,
    cpm: 24,
    ctr: 2,
    cpc: 1.2,
    costPerResult: 0,
  };
  const decision = safe.evaluateDecisionSafely({
    entityType: "campaign",
    entityId: "c1",
    entityName: "WhatsApp",
    campaignId: "c1",
    campaignName: "WhatsApp",
    objective: "MESSAGES",
    current: metrics,
    previous: metrics,
    currentResultsAvailable: false,
    previousResultsAvailable: false,
  });
  assert.equal(decision.action, "INSUFFICIENT_DATA");
  assert.equal(decision.confidence, "low");
  assert.equal(decision.currentResultsAvailable, false);
  assert.ok(decision.signals.some((signal) => signal.code === "results_unavailable"));
  assert.ok(!decision.signals.some((signal) => signal.code === "clicks_no_results"), "missing results must not become a zero-result penalty");
}

await testInsightIdentityAndPagination();
testDecisionMissingResultGuard();
console.log("Meta data-quality regression checks passed: entity ids, pagination, exact messaging result and missing-result guards.");
