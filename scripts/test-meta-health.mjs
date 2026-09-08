#!/usr/bin/env node
/**
 * Pruebas del monitor de salud de la conexión con Meta contra el endpoint
 * real `GET /api/meta/health`. Ejercitan la ruta completa, no una simulación.
 *
 * Uso:
 *   npm run dev                    # en otra terminal
 *   node scripts/test-meta-health.mjs
 *
 * Variables opcionales:
 *   BASE_URL   por defecto http://localhost:3000
 *
 * Las aserciones son sobre el contrato (código de estado, forma, coherencia
 * interna y ausencia de secretos), nunca sobre cifras concretas: el resultado
 * depende del token real del entorno y ambos desenlaces son válidos.
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/meta/health`;

const STATUSES = [
  "ok",
  "missing_token",
  "token_expired",
  "insufficient_permissions",
  "business_unreachable",
  "no_accounts",
  "temporary_error",
  "blocked_by_network",
];

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

async function get() {
  const res = await fetch(ENDPOINT, { cache: "no-store" });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // respuesta no-JSON: se refleja como json === null
  }
  return { status: res.status, json, raw: JSON.stringify(json ?? null) };
}

// ── 1. Contrato de la respuesta ──────────────────────────────────────────
async function testContract() {
  console.log("\n1. Contrato de GET /api/meta/health");
  const { status, json } = await get();

  assert(status === 200, "responde 200 aunque la conexión esté rota", `status=${status}`);
  assert(STATUSES.includes(json?.status), "status es uno de los siete estados conocidos", `status=${json?.status}`);
  assert(typeof json?.summary === "string" && json.summary.length > 0, "summary no vacío");
  assert(Array.isArray(json?.checks), "checks es un array");
  assert(Array.isArray(json?.accounts), "accounts es un array");
  assert(typeof json?.businessConfigured === "boolean", "businessConfigured es booleano");

  const checkedAt = Date.parse(json?.checkedAt ?? "");
  assert(Number.isFinite(checkedAt), "checkedAt es una fecha ISO válida", json?.checkedAt);
  assert(Math.abs(Date.now() - checkedAt) < 5 * 60_000, "checkedAt corresponde a esta comprobación, no a una cacheada");

  console.log(`  (estado observado: ${json?.status} — ${json?.summary})`);
  return json;
}

// ── 2. El token nunca sale del servidor ──────────────────────────────────
async function testNoSecretLeak() {
  console.log("\n2. La respuesta no expone la credencial");
  const { raw } = await get();

  // El *nombre* de la variable (META_ACCESS_TOKEN) sí aparece en los mensajes
  // de diagnóstico y es correcto: lo que no debe aparecer nunca es su valor,
  // ni una clave `access_token` con contenido.
  assert(!/(?<!META_)access_token/i.test(raw), "no aparece ninguna clave access_token con valor");
  assert(!/\bEAA[A-Za-z0-9]{20,}/.test(raw), "no aparece nada con forma de token de Meta");

  const token = process.env.META_ACCESS_TOKEN;
  if (token) {
    assert(!raw.includes(token), "el token real del entorno no aparece en la respuesta");
  } else {
    console.log("  ⊘ META_ACCESS_TOKEN no está en el entorno de la prueba: no se puede comparar literalmente");
  }
}

// ── 3. Coherencia interna del informe ────────────────────────────────────
async function testCoherence(report) {
  console.log("\n3. Coherencia del informe");
  if (!report) {
    assert(false, "hay informe que comprobar");
    return;
  }

  const ids = report.checks.map((c) => c.id);
  assert(report.checks.every((c) => ["token", "business"].includes(c.id)), "cada check tiene un id conocido", ids.join(","));
  assert(
    report.checks.every((c) => typeof c.label === "string" && typeof c.detail === "string" && typeof c.ok === "boolean"),
    "cada check trae label, detail y ok"
  );
  assert(ids.includes("token"), "siempre se comprueba el token");
  assert(
    report.businessConfigured ? ids.includes("business") : !ids.includes("business"),
    "el check del Business Manager solo aparece si META_BUSINESS_ID está configurado"
  );

  if (report.status === "ok") {
    assert(report.accounts.length > 0, "estado ok ⇒ hay al menos una cuenta accesible");
    assert(report.checks.every((c) => c.ok), "estado ok ⇒ todas las comprobaciones pasan");
  }
  if (report.status === "no_accounts") {
    assert(report.accounts.length === 0, "estado no_accounts ⇒ lista de cuentas vacía");
  }
  if (["missing_token", "token_expired", "insufficient_permissions"].includes(report.status)) {
    assert(report.accounts.length === 0, "token inutilizable ⇒ no se reportan cuentas");
    assert(report.checks.find((c) => c.id === "token")?.ok === false, "token inutilizable ⇒ el check del token falla");
  }

  assert(
    report.accounts.every((a) => typeof a.id === "string" && typeof a.name === "string" && typeof a.currency === "string"),
    "cada cuenta trae id, name y currency"
  );
}

// ── 4. Solo lectura: el endpoint no acepta escrituras ────────────────────
async function testReadOnly() {
  console.log("\n4. Solo lectura");
  const res = await fetch(ENDPOINT, { method: "POST", body: "{}" });
  assert(res.status === 405, "POST no está permitido (405)", `status=${res.status}`);
}

// ── 5. Cada llamada vuelve a comprobar ───────────────────────────────────
async function testFreshOnEachCall() {
  console.log("\n5. Cada llamada realiza una comprobación nueva");
  const first = await get();
  await new Promise((r) => setTimeout(r, 1100));
  const second = await get();

  assert(
    Date.parse(second.json?.checkedAt) > Date.parse(first.json?.checkedAt),
    "checkedAt avanza entre dos llamadas: la respuesta no está cacheada",
    `${first.json?.checkedAt} → ${second.json?.checkedAt}`
  );
}

async function main() {
  console.log(`Monitor de salud de Meta — pruebas contra ${ENDPOINT}`);
  try {
    await fetch(BASE_URL);
  } catch {
    console.error(`\nNo se pudo conectar con ${BASE_URL}. Arranca el servidor con "npm run dev".`);
    process.exit(1);
  }

  const report = await testContract();
  await testNoSecretLeak();
  await testCoherence(report);
  await testReadOnly();
  await testFreshOnEachCall();

  console.log(`\n${passed} correctas, ${failed} fallidas`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
