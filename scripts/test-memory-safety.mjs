import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("supabase/migrations/202609090001_anlux_memory_v1.sql", "utf8");
const config = await readFile("src/lib/memory/config.ts", "utf8");
const repository = await readFile("src/lib/memory/repository.ts", "utf8");

for (const table of [
  "users",
  "meta_ad_accounts",
  "business_goals",
  "account_period_observations",
  "decision_history",
  "decision_feedback",
]) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} debe tener RLS`);
}

assert.match(migration, /id\s*=\s*auth\.uid\(\)/i, "la membresía debe estar ligada a auth.uid()");
assert.match(migration, /reviewed_by\s*=\s*auth\.uid\(\)/i, "feedback debe pertenecer al usuario autenticado");
assert.doesNotMatch(migration, /create policy[^;]+public\.users[^;]+for insert/is, "no debe existir autoalta RLS en public.users");
assert.match(config, /ANLUX_MEMORY_ENABLED\s*===\s*"true"/, "la memoria debe ser opt-in explícito");
assert.doesNotMatch(repository, /service_role|SUPABASE_SERVICE|secret.*key/i, "runtime de memoria no debe usar bypass de RLS");
assert.match(repository, /getSupabaseServerClient/, "runtime debe usar la sesión autenticada de Supabase");

console.log("Memory v1: salvaguardas RLS y opt-in correctas.");
