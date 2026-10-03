import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("src/app/api/cron/daily-brief/route.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const state = { persisted: 0, updates: [], sent: 0, persistenceFails: false, messagingFails: false };
const env = { CRON_SECRET: "test-secret" };
const loadedModule = { exports: {} };
const imports = {
  "server-only": {},
  "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  resend: { Resend: class { emails = { send: async () => { state.sent++; return { data: { id: "test-email" }, error: null }; } }; } },
  "@/lib/decisions/real-engine": { generateRealDecisions: async () => ({ decisions: [], portfolioRecommendations: [], accountMetrics: { spend: 1 } }) },
  "@/lib/intelligence/engine": { buildIntelligenceSuite: () => ({ brief: { headline: "Informe", attention: [], healthy: [] } }) },
  "@/lib/memory/service-repository": {
    loadServiceBusinessGoals: async () => ({ goals: null }),
    persistServiceIntelligenceMemory: async () => { state.persisted++; return { state: state.persistenceFails ? "unavailable" : "ready" }; },
  },
  "@/lib/meta/real/messaging": { fetchMessagingReport: async () => {
    assert.ok(state.updates.some(update => update.snapshot_success_at), "snapshot recorded before contract check");
    if (state.messagingFails) throw new Error("Meta timeout");
    return {};
  } },
  "@/lib/meta/messaging": { messagingContract: () => ({ state: "incomplete", campaignsWithEvents: 1, campaignsComplete: 0 }) },
  "@/lib/meta/real/accounts": { fetchAdAccounts: async () => [{ id: "act_1", name: "Hotel Expert" }] },
  "@/lib/supabase/service": { getSupabaseServiceClient: () => ({}) },
  "@/lib/memory/config": { isMemoryEnabled: () => true },
  "@/lib/memory/cron-status": {
    startCronRun: async () => "pending",
    updateCronRun: async (_client, _period, changes) => { state.updates.push(changes); },
  },
};
vm.runInNewContext(source, {
  module: loadedModule, exports: loadedModule.exports, process: { env }, AbortSignal,
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
assert.equal(result.body.messagingChecks[0].state, "incomplete");
assert.ok(state.updates.some(update => update.messaging_contract?.checks[0]?.state === "incomplete"));
state.messagingFails = true;
const contractFailure = await loadedModule.exports.GET(request("Bearer test-secret"));
assert.equal(contractFailure.status, 200, "a contract failure must not invalidate persistence");
assert.equal(contractFailure.body.messagingChecks[0].state, "failed");
state.messagingFails = false;
assert.ok(state.updates.some((update) => update.snapshot_success_at));
try {
  env.ANLUX_BRIEF_RECIPIENT = "test@example.invalid";
  env.RESEND_API_KEY = "test-key";
  state.persistenceFails = true;
  const failed = await loadedModule.exports.GET(request("Bearer test-secret"));
  assert.equal(failed.status, 503);
  assert.equal(failed.body.emailStatus, "skipped");
  assert.equal(state.sent, 0, "un informe incompleto no debe enviarse");
  state.persistenceFails = false;
  const recovered = await loadedModule.exports.GET(request("Bearer test-secret"));
  assert.equal(recovered.status, 200);
  assert.equal(state.sent, 1, "el informe se envía tras guardar el snapshot");
} finally {
  delete env.ANLUX_BRIEF_RECIPIENT;
  delete env.RESEND_API_KEY;
}
console.log("Cron: persistencia independiente de Resend y autenticación preservada.");
