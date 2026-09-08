#!/usr/bin/env node
/**
 * Pruebas de los dos modos del AI Analyst contra el endpoint real
 * `POST /api/ai/analyze`. Ejercitan la cadena completa (ruta → prompt →
 * proveedor), no una simulación de ella.
 *
 * Uso:
 *   npm run dev                 # en otra terminal
 *   node scripts/test-ai-modes.mjs
 *
 * Variables opcionales:
 *   BASE_URL     por defecto http://localhost:3000
 *   ACCOUNT_ID   cuenta de Meta real para el caso de rendimiento
 *
 * No contiene datos simulados: las aserciones son sobre códigos de estado y
 * sobre la forma de la respuesta, nunca sobre cifras concretas.
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/ai/analyze`;
const ACCOUNT_ID = process.env.ACCOUNT_ID ?? "act_1047152237711045";

const ANALYSIS_FIELDS = ["summary", "issues", "opportunities", "recommendations", "priority", "generatedAt"];

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

async function post(body) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // respuesta no-JSON: se refleja como json === null
  }
  return { status: res.status, json };
}

function isAnalysisShape(json) {
  return Boolean(json) && ANALYSIS_FIELDS.every((f) => f in json);
}

// ── 1. Pregunta estratégica sin clientId ni dateRange ────────────────────
async function testGeneralQuestion() {
  console.log("\n1. Pregunta estratégica general (sin clientId ni dateRange)");
  const { status, json } = await post({
    mode: "general",
    question: "¿Qué estrategia de Meta Ads recomiendas para vender insumos de ortodoncia mediante WhatsApp?",
  });

  if (status === 503 && json?.kind === "auth") {
    console.log("  ⊘ proveedor de IA sin credencial en este entorno: no se puede validar la respuesta");
    assert(true, "el endpoint NO exige clientId/dateRange (llegó hasta el proveedor)");
    return;
  }

  assert(status === 200, "responde 200 sin cuenta seleccionada", `status=${status} ${JSON.stringify(json)?.slice(0, 160)}`);
  assert(isAnalysisShape(json), "devuelve un AIAnalysis completo");
  assert(typeof json?.summary === "string" && json.summary.length > 0, "summary no vacío");
  assert(["low", "medium", "high"].includes(json?.priority), "priority válida");
}

// ── 2. Análisis de rendimiento con clientId y dateRange ──────────────────
async function testPerformanceWithData() {
  console.log("\n2. Análisis de rendimiento (con clientId y dateRange)");
  const { status, json } = await post({
    mode: "performance",
    clientId: ACCOUNT_ID,
    dateRange: { from: "2026-08-04", to: "2026-09-02" },
    question: "Analiza el rendimiento de la cuenta.",
  });

  // Sin credencial de Meta el endpoint devuelve el error real de la API: es
  // el comportamiento correcto, nunca datos inventados.
  if (status === 503 && json?.kind === "missing_token") {
    console.log("  ⊘ META_ACCESS_TOKEN ausente en este entorno");
    assert(true, "falla con el error real de Meta, sin sustituirlo por datos simulados");
    return;
  }
  if (status === 401 || status === 403) {
    console.log("  ⊘ token de Meta inválido o sin permisos en este entorno");
    assert(true, "propaga el error real de Meta");
    return;
  }

  assert(status === 200, "responde 200 con cuenta y periodo", `status=${status}`);
  assert(isAnalysisShape(json), "devuelve un AIAnalysis completo");
}

// ── 3. Análisis de rendimiento SIN periodo ───────────────────────────────
async function testPerformanceMissingRange() {
  console.log("\n3. Rendimiento con cuenta pero sin periodo");
  const { status, json } = await post({ mode: "performance", clientId: ACCOUNT_ID, question: "¿Cómo va la cuenta?" });

  assert(status === 400, "responde 400", `status=${status}`);
  assert(/periodo/i.test(json?.error ?? ""), "el mensaje pide seleccionar un periodo", json?.error);
  assert(!isAnalysisShape(json), "NO devuelve un análisis que parezca basado en métricas");
}

// ── 4. Sin cuenta y sin pregunta ─────────────────────────────────────────
async function testGeneralWithoutQuestion() {
  console.log("\n4. Consulta estratégica sin pregunta");
  const { status, json } = await post({ mode: "general" });

  assert(status === 400, "responde 400", `status=${status}`);
  assert(/pregunta/i.test(json?.error ?? ""), "el mensaje pide escribir una pregunta", json?.error);
  assert(!isAnalysisShape(json), "NO devuelve un análisis");
}

// ── 4b. Rendimiento sin cuenta: bloqueado antes de llamar a la IA ────────
async function testPerformanceWithoutAccount() {
  console.log("\n4b. Modo rendimiento sin cuenta seleccionada");
  const { status, json } = await post({
    mode: "performance",
    dateRange: { from: "2026-08-04", to: "2026-09-02" },
    question: "¿Cuál es mi mejor anuncio?",
  });

  assert(status === 400, "responde 400", `status=${status}`);
  assert(/cuenta/i.test(json?.error ?? ""), "el mensaje pide seleccionar una cuenta", json?.error);
  assert(!isAnalysisShape(json), "NO genera un análisis de rendimiento sin datos");
}

// ── 4c. Modo ausente o inválido: rechazado en el servidor ────────────────
async function testInvalidMode() {
  console.log("\n4c. Modo ausente o inválido");

  const missing = await post({ question: "¿Cómo estructuro una campaña?" });
  assert(missing.status === 400, "sin modo → 400", `status=${missing.status}`);
  assert(/modo/i.test(missing.json?.error ?? ""), "el mensaje menciona el modo", missing.json?.error);

  const invalid = await post({ mode: "otro", question: "¿Cómo estructuro una campaña?" });
  assert(invalid.status === 400, "modo desconocido → 400", `status=${invalid.status}`);
  assert(!isAnalysisShape(invalid.json), "NO devuelve un análisis");
}

// ── 4d. El modo estratégico ignora cuenta y periodo si vienen ────────────
async function testGeneralIgnoresAccount() {
  console.log("\n4d. Modo estratégico con cuenta y periodo en el cuerpo (deben ignorarse)");
  const { status, json } = await post({
    mode: "general",
    clientId: ACCOUNT_ID,
    dateRange: { from: "2026-08-04", to: "2026-09-02" },
    question: "¿Cómo estructurarías una campaña de mensajes?",
  });

  // Si consultara Meta, sin token devolvería missing_token en vez de llegar a la IA.
  assert(json?.kind !== "missing_token" && json?.kind !== "invalid_token",
    "NO consulta Meta pese a recibir cuenta y periodo", `kind=${json?.kind} status=${status}`);
}

// ── 5. El modo general no depende de Meta ────────────────────────────────
async function testGeneralIndependentFromMeta() {
  console.log("\n5. El modo general funciona aunque Meta no esté disponible");

  const meta = await fetch(`${BASE_URL}/api/meta/accounts`);
  const metaBroken = !meta.ok;
  console.log(`  (estado de /api/meta/accounts: ${meta.status}${metaBroken ? " — Meta no disponible" : ""})`);

  const { status, json } = await post({ mode: "general", question: "¿Cómo estructurarías una campaña de mensajes en Meta Ads?" });

  if (status === 503 && json?.kind === "auth") {
    console.log("  ⊘ proveedor de IA sin credencial en este entorno");
    assert(true, "el fallo proviene del proveedor de IA, no de Meta");
    return;
  }

  assert(status === 200, "responde 200 con Meta caído", `status=${status}`);
  assert(json?.kind !== "missing_token" && json?.kind !== "invalid_token", "el error de Meta no contamina el modo general");
  if (metaBroken) assert(status === 200, "confirmado con Meta efectivamente no disponible");
}

async function main() {
  console.log(`AI Analyst — pruebas de modo contra ${ENDPOINT}`);
  try {
    await fetch(BASE_URL);
  } catch {
    console.error(`\nNo se pudo conectar con ${BASE_URL}. Arranca el servidor con "npm run dev".`);
    process.exit(1);
  }

  await testGeneralQuestion();
  await testPerformanceWithData();
  await testPerformanceMissingRange();
  await testGeneralWithoutQuestion();
  await testPerformanceWithoutAccount();
  await testInvalidMode();
  await testGeneralIgnoresAccount();
  await testGeneralIndependentFromMeta();

  console.log(`\n${passed} correctas, ${failed} fallidas`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
