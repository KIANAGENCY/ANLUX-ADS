import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';
let user = null, selected = null, written = null;
let queryAccount = null;
const client = { auth: { getUser: async () => ({ data: { user } }) }, from: table => ({
  select: () => ({ eq: (key, value) => { assert.equal(key, 'id'); return { eq: (key, value) => { assert.equal(key, 'ad_account_id'); queryAccount = value; return { maybeSingle: async () => ({ data: selected, error: null }) }; } }; } }),
  upsert: async value => { assert.equal(table, 'decision_feedback'); written = value; return { error: null }; },
}) };
const mod = { exports: {} };
const imports = {
  'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  zod: { z },
  '@/lib/supabase/server': { getSupabaseServerClient: async () => client },
  '@/lib/supabase/access': { canAccessAnlux: user => user.app_metadata?.anlux_role === 'member' },
  '@/lib/meta/account-binding': { ACTIVE_META_CLIENT: { adAccountId: 'act_bound' } },
  '@/lib/memory/config': { isMemoryEnabled: () => true },
};
vm.runInNewContext(ts.transpileModule(readFileSync('src/app/api/meta/memory/feedback/route.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: mod.exports, module: mod, require: name => { if (!(name in imports)) throw Error(name); return imports[name]; } });
const req = body => ({ json: async () => body });
assert.equal((await mod.exports.POST(req({ decisionId: 1, outcome: 'accepted' }))).status, 403);
user = { id: 'real-user', app_metadata: { anlux_role: 'member' } };
assert.equal((await mod.exports.POST(req({ decisionId: 1, outcome: 'invalid' }))).status, 400);
assert.equal((await mod.exports.POST(req({ decisionId: 1, outcome: 'accepted' }))).status, 404);
assert.equal(written, null);
assert.equal(queryAccount, 'act_bound');
selected = { id: 1 };
assert.equal((await mod.exports.POST(req({ decisionId: 1, outcome: 'accepted', notes: 'Confirmed', reviewed_by: 'impostor' }))).status, 200);
assert.equal(written.reviewed_by, 'real-user');
assert.equal(written.decision_id, 1);
console.log('Feedback: session, validation, bound account, missing decision and reviewer identity verified.');
