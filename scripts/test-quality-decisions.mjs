import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { deriveMessagingTarget } from "../src/lib/intelligence/target-derivation.ts";

const mod = { exports: {} };
const source = ts.transpileModule(readFileSync("src/lib/decisions/quality.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
vm.runInNewContext(source, {
  module: mod, exports: mod.exports,
  require(name) {
    if (name === "server-only") return {};
    if (name === "@/lib/supabase/server") return { getSupabaseServerClient: async () => null };
    if (name === "@/lib/supabase/service") return { getSupabaseServiceClient: () => null };
    throw new Error(`Unexpected import: ${name}`);
  },
});
const base = {
  entityType: "campaign", campaignId: "1", resultType: "onsite_conversion.messaging_conversation_started_7d",
  currentResultsAvailable: true, currentMetrics: { results: 30, spend: 450 },
  action: "SCALE", suggestedChangePercent: 10, score: 80, rationale: "Meta improved", signals: [],
};
const poor = mod.exports.applyQualityEvidence(base, 3);
assert.equal(poor.action, "WATCH");
assert.equal(poor.suggestedChangePercent, null);
assert.equal(poor.qualifiedConversations, 3);
assert.equal(poor.currentMetrics.results, 30, "Meta results remain unchanged");
assert.equal(mod.exports.applyQualityEvidence(base, 31), base, "invalid human count is ignored");
assert.equal(mod.exports.applyQualityEvidence(base, undefined), base, "missing feedback is not invented");
assert.equal(mod.exports.applyQualityEvidence({ ...base, resultType: "purchase" }, 3).action, "SCALE");

const history = ["2026-09-01", "2026-09-08", "2026-09-15"].map((from, i) => ({
  periodFrom: from, periodTo: from, objective: "CONVERSIONS",
  resultType: "onsite_conversion.messaging_conversation_started_7d", resultsAvailable: true,
  results: 12, costPerResult: 18 + i,
}));
assert.ok(deriveMessagingTarget(history), "CONVERSIONS with messaging outcomes is eligible");
assert.equal(deriveMessagingTarget(history.map((row) => ({ ...row, resultType: null }))), null,
  "unknown historic result types cannot be reinterpreted");
assert.equal(deriveMessagingTarget(history.map((row) => ({ ...row, resultsAvailable: false }))), null);
console.log("Quality evidence and messaging target guards passed.");
