import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, imports = {}) {
  const loadedModule = { exports: {} };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, {
    module: loadedModule, exports: loadedModule.exports,
    require(name) {
      if (name === "server-only") return {};
      if (name in imports) return imports[name];
      throw new Error(`Import inesperado: ${name}`);
    },
  });
  return loadedModule.exports;
}

const actions = load("src/lib/meta/real/actions.ts");
const { accountObservationMetrics } = load("src/lib/decisions/account-metrics.ts", {
  "@/lib/meta/real/actions": actions,
});
const conversation = [{ action_type: actions.MESSAGING_CONVERSATION_ACTION, value: "3" }];
const campaignRows = new Map([
  ["active", { spend: "20", actions: conversation }],
  ["paused", { spend: "80", actions: [{ action_type: actions.MESSAGING_CONVERSATION_ACTION, value: "5" }] }],
]);
const objectives = new Map([["active", "MESSAGES"], ["paused", "MESSAGES"]]);
const aggregate = { spend: "100", impressions: "1500", reach: "900", clicks: "40" };
const metrics = accountObservationMetrics(aggregate, campaignRows, objectives);
assert.equal(metrics.spend, 100, "El gasto proviene del agregado real de Meta");
assert.equal(metrics.reach, 900, "El alcance no debe sumarse entre campañas");
assert.equal(metrics.results, 8, "Una campaña pausada con actividad pertenece al histórico");
assert.equal(accountObservationMetrics(null, campaignRows, objectives), undefined,
  "Sin agregado de cuenta no se debe afirmar que hay un snapshot exacto");
console.log("Audit regression: los snapshots incluyen actividad de campañas pausadas y requieren agregado de cuenta.");
