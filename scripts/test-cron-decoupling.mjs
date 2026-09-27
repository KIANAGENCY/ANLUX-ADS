import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("src/app/api/cron/daily-brief/route.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const state = { persisted: 0, updates: [], sent: 0 };
const loadedModule = { exports: {} };
const imports = {
  "server-only": {},
  "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  resend: { Resend: class { constructor() { state.sent++; } } },
  "@/lib/decisions/real-engine": { generateRealDecisions: async () => ({ decisions: [], portfolioRecommendations: [], accountMetrics: { spend: 1 } }) },
  "@/lib/intelligence/engine": { buildIntelligenceSuite: () => ({ brief: { headline: "Informe", attention: [], healthy: [] } }) },
  "@/lib/memory/service-repository": {
    loadServiceBusinessGoals: async () => ({ goals: null }),
    persistServiceIntelligenceMemory: async () => { state.persisted++; return { state: "ready" }; },
  },
  "@/lib/meta/real/accounts": { fetchAdAccounts: async () => [{ id: "act_1", name: "Hotel Expert" }] },
  "@/lib/supabase/service": { getSupabaseServiceClient: () => ({}) },
  "@/lib/memory/config": { isMemoryEnabled: () => true },
  "@/lib/memory/cron-status": {
    startCronRun: async () => "pending",
    updateCronRun: async (_client, _period, changes) => { state.updates.push(changes); },
  },
};
vm.runInNewContext(source, {
  module: loadedModule, exports: loadedModule.exports, process: { env: { CRON_SECRET: "test-secret" } },
  require: (name) => { if (name in imports) return imports[name]; throw new Error(`Import inesperado: ${name}`); },
});
const request = (authorization) => ({ headers: { get: () => authorization } });
const denied = await loadedModule.exports.GET(request("Bearer wrong"));
assert.equal(denied.status, 401);
assert.equal(state.persisted, 0);
const result = await loadedModule.exports.GET(request("Bearer test-secret"));
assert.equal(result.status, 200);
assert.equal(state.persisted, 1, "la memoria se guarda sin configurar Resend");
assert.equal(result.body.emailStatus, "skipped");
assert.equal(state.sent, 0);
assert.ok(state.updates.some((update) => update.snapshot_success_at));
console.log("Cron: persistencia independiente de Resend y autenticación preservada.");
