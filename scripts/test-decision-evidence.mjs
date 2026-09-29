#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const enginePath = fileURLToPath(new URL("../src/lib/decisions/engine.ts", import.meta.url));
const source = await readFile(enginePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function("exports", "require", "module", compiled)(mod.exports, () => { throw new Error("Unexpected runtime dependency"); }, mod);
const { evaluateDecision } = mod.exports;

const input = {
  entityType: "campaign",
  entityId: "campaign-1",
  entityName: "VENTAS 2",
  campaignId: "campaign-1",
  campaignName: "VENTAS 2",
  objective: "MESSAGES",
  resultType: "onsite_conversion.messaging_conversation_started_7d",
  previousResultType: "onsite_conversion.messaging_conversation_started_7d",
  currentResultsAvailable: true,
  previousResultsAvailable: true,
  startDate: "2025-01-01",
  current: { spend: 58.07, impressions: 42000, reach: 30000, clicks: 42, results: 2, cpc: 1.38, ctr: 1.3, costPerResult: 29.04, frequency: 1.4 },
  previous: { spend: 42.09, impressions: 18000, reach: 14000, clicks: 17, results: 3, cpc: 2.48, ctr: 0.9, costPerResult: 14.03, frequency: 1.2 },
};

const lowSample = evaluateDecision(input);
assert.equal(lowSample.action, "WATCH");
assert.equal(lowSample.score, 50);
assert.equal(lowSample.suggestedChangePercent, null);
assert.match(lowSample.rationale, /no hay conversiones comparables suficientes/i);
assert.ok(lowSample.signals.some((signal) => signal.code === "outcome_sample_insufficient"));
assert.ok(lowSample.signals.some((signal) => signal.code === "cpc_down"));

const mismatchedAction = evaluateDecision({
  ...input,
  current: { ...input.current, results: 5, costPerResult: 10 },
  previous: { ...input.previous, results: 5, costPerResult: 20 },
  previousResultType: "purchase",
});
assert.equal(mismatchedAction.action, "WATCH");
assert.equal(mismatchedAction.score, 50);
assert.ok(!mismatchedAction.signals.some((signal) => signal.code === "cpr_down_strong"));

console.log("Decision evidence tests passed: low volume stays WATCH; unlike outcomes are not compared.");
