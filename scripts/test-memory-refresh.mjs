import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, imports, context = {}) {
  const loadedModule = { exports: {} };
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, {
    module: loadedModule, exports: loadedModule.exports, process, console, ...context,
    require(name) {
      if (name === "server-only") return {};
      if (name in imports) return imports[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return loadedModule.exports;
}

let writes = 0;
const route = load("src/app/api/meta/intelligence/route.ts", {
  "next/server": { NextResponse: { json: (body) => body } },
  "@/lib/decisions/real-engine": { generateRealDecisions: async () => ({ decisions: [] }) },
  "@/lib/intelligence/engine": { buildIntelligenceSuite: () => ({ brief: { headline: "OK" } }) },
  "@/lib/memory/repository": {
    loadBusinessGoals: async () => ({ goals: null }),
    getMemoryStatus: async () => ({ state: "ready" }),
    persistIntelligenceMemory: async () => { writes++; return { state: "ready" }; },
  },
  "@/lib/meta/real/error-response": { metaErrorResponse: (error) => { throw error; } },
  "@/lib/meta/real/request-params": {
    parseAccountRangeParams: () => ({ ok: true, params: { accountId: "act_1", from: "2026-09-23", to: "2026-09-23" } }),
  },
});
const request = { nextUrl: { searchParams: new URLSearchParams() } };
await route.GET(request);
assert.equal(writes, 0, "GET must not save history");
await route.POST(request);
assert.equal(writes, 1, "POST explicitly saves history");

const operations = [];
const client = {
  auth: { getUser: async () => ({ data: { user: { id: "member" } } }) },
  from(table) {
    if (table === "users") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "member" } }) }) }) };
    return { upsert: async (rows, options) => { operations.push({ table, rows, options }); return { error: null }; } };
  },
};
const repo = load("src/lib/memory/repository.ts", {
  "@/lib/supabase/server": { getSupabaseServerClient: async () => client },
  "./config": { isMemoryEnabled: () => true },
});
const decision = {
  entityType: "campaign", entityId: "123", entityName: "Campaign", campaignId: "123",
  objective: "MESSAGES", action: "WATCH", score: 50, confidence: "low", risk: "low",
  suggestedChangePercent: null, rationale: "Updated rationale", signals: [],
  currentMetrics: { spend: 45 }, previousMetrics: { spend: 40 }, generatedAt: "2026-09-24T10:00:00Z",
};
await repo.persistIntelligenceMemory({ accountId: "act_1", from: "2026-09-23", to: "2026-09-23",
  currency: "MXN", accountMetrics: { spend: 45, impressions: 100, reach: 60, clicks: 5, results: 1 },
  summary: {}, decisions: [decision] }, { forecast: {} }, {});
const decisionWrite = operations.find((entry) => entry.table === "decision_history");
const observationWrite = operations.find((entry) => entry.table === "account_period_observations");
assert.equal(decisionWrite.options.onConflict, "ad_account_id,period_from,period_to,entity_type,entity_id");
assert.equal(decisionWrite.options.ignoreDuplicates, undefined);
assert.equal(decisionWrite.rows[0].stored_at, observationWrite.rows.captured_at);
assert.ok(operations.indexOf(decisionWrite) < operations.indexOf(observationWrite));

const cron = load("src/app/api/cron/daily-brief/route.ts", {
  "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  resend: { Resend: class {} },
  "@/lib/decisions/real-engine": { generateRealDecisions: async () => { throw new Error("Unexpected Meta call"); } },
  "@/lib/intelligence/engine": { buildIntelligenceSuite: () => ({}) },
  "@/lib/memory/service-repository": { loadServiceBusinessGoals: async () => ({}), persistServiceIntelligenceMemory: async () => ({}) },
  "@/lib/meta/real/accounts": { fetchAdAccounts: async () => [] },
});
const oldSecret = process.env.CRON_SECRET;
const oldRecipient = process.env.ANLUX_BRIEF_RECIPIENT;
const oldResend = process.env.RESEND_API_KEY;
try {
  process.env.CRON_SECRET = "vercel-cron-test-secret";
  process.env.ANLUX_BRIEF_RECIPIENT = "test@example.invalid";
  process.env.RESEND_API_KEY = "test-key";
  assert.equal((await cron.GET({ headers: { get: () => "Bearer wrong" } })).status, 401);
  assert.equal((await cron.GET({ headers: { get: () => "Bearer vercel-cron-test-secret" } })).status, 503,
    "Valid Vercel CRON_SECRET passes authentication and reaches the account check");
} finally {
  for (const [name, value] of [["CRON_SECRET", oldSecret], ["ANLUX_BRIEF_RECIPIENT", oldRecipient], ["RESEND_API_KEY", oldResend]]) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}
console.log("Memory refresh: read-only GET, explicit POST, current-decision upsert and cron auth verified.");
