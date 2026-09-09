#!/usr/bin/env node
/**
 * Smoke tests de seguridad contra una instancia local de producción (`npm start`).
 *
 * El CI no inyecta credenciales: eso es intencional. Verificamos que ANLUX
 * falle cerrado cuando Supabase no está configurado, que las APIs internas no
 * devuelvan datos y que las cabeceras de seguridad estén presentes.
 */

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";

let passed = 0;
let failed = 0;

function assert(condition, label, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✘ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/login`, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // servidor todavía arrancando
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No arrancó el servidor en ${BASE_URL}`);
}

async function testProtectedApi(path) {
  const res = await fetch(`${BASE_URL}${path}`, { redirect: "manual" });
  const body = await res.text();

  assert(res.status === 503, `${path} falla cerrado sin Supabase`, `status=${res.status}`);
  assert(!/accounts|campaigns|ads|adsets/i.test(body) || /autenticación/i.test(body), `${path} no filtra datos reales`);
  assert(/no-store/i.test(res.headers.get("cache-control") ?? ""), `${path} impide cachear la respuesta`);
}

async function testProtectedPage() {
  const res = await fetch(`${BASE_URL}/overview`, { redirect: "manual" });
  assert([307, 308].includes(res.status), "dashboard redirige al login sin autenticación", `status=${res.status}`);
  assert((res.headers.get("location") ?? "").includes("/login"), "la redirección apunta a /login");
}

async function testSecurityHeaders() {
  const res = await fetch(`${BASE_URL}/login`, { redirect: "manual" });
  assert(res.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options=nosniff");
  assert(res.headers.get("x-frame-options") === "DENY", "X-Frame-Options=DENY");
  assert(Boolean(res.headers.get("strict-transport-security")), "HSTS presente");
  assert(Boolean(res.headers.get("referrer-policy")), "Referrer-Policy presente");
  assert(Boolean(res.headers.get("permissions-policy")), "Permissions-Policy presente");
  assert(!res.headers.has("x-powered-by"), "X-Powered-By oculto");
}

async function main() {
  console.log(`Security smoke tests — ${BASE_URL}`);
  await waitForServer();
  await testProtectedApi("/api/meta/accounts");
  await testProtectedApi("/api/meta/health");
  await testProtectedPage();
  await testSecurityHeaders();

  console.log(`\n${passed} correctas, ${failed} fallidas`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
