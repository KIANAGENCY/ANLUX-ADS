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
    if (name === "@/lib/intelligence/target-derivation") return { deriveMessagingTarget };
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

const history = Array.from({ length: 7 }, (_, i) => ({
  campaignId: `campaign-${i % 2}`,
  periodFrom: `2026-09-${String(i + 1).padStart(2, "0")}`,
  periodTo: `2026-09-${String(i + 1).padStart(2, "0")}`,
  objective: "CONVERSIONS",
  resultType: "onsite_conversion.messaging_conversation_started_7d", resultsAvailable: true,
  results: 3, spend: 54 + i * 3,
}));
assert.ok(deriveMessagingTarget(history), "CONVERSIONS with messaging outcomes is eligible");
assert.equal(deriveMessagingTarget(history.map((row) => ({ ...row, resultType: null }))), null,
  "unknown historic result types cannot be reinterpreted");
assert.equal(deriveMessagingTarget(history.map((row) => ({ ...row, resultsAvailable: false }))), null);
assert.equal(deriveMessagingTarget(history.map((row) => ({ ...row, periodTo: "2026-09-30" }))), null,
  "overlapping rolling windows are excluded");
assert.equal(deriveMessagingTarget(history.slice(0, 6)), null, "fewer than seven daily samples is insufficient");
assert.equal(deriveMessagingTarget([...history, history[0]] )?.periods, 7, "duplicate campaign/day rows do not increase the sample size");
assert.equal(deriveMessagingTarget(history.map((row) => ({ ...row, results: 0 }))), null,
  "zero-conversation history cannot produce an account CPA");
console.log("Quality evidence and messaging target guards passed.");
