import assert from "node:assert/strict";
import { evaluateDecision } from "../src/lib/decisions/engine.ts";

function metrics(overrides = {}) {
  return {
    spend: 100,
    reach: 3000,
    impressions: 5000,
    clicks: 100,
    results: 10,
    frequency: 1.67,
    cpm: 20,
    ctr: 2,
    cpc: 1,
    costPerResult: 10,
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    entityType: "campaign",
    entityId: "cmp_1",
    entityName: "Campaña prueba",
    campaignId: "cmp_1",
    campaignName: "Campaña prueba",
    objective: "LEAD_GENERATION",
    currentResultsAvailable: true,
    previousResultsAvailable: true,
    current: metrics(),
    previous: metrics(),
    ...overrides,
  };
}

const scale = evaluateDecision(
  input({
    current: metrics({ spend: 200, results: 20, clicks: 120, ctr: 3, cpc: 1, costPerResult: 10 }),
    previous: metrics({ spend: 200, results: 10, clicks: 80, ctr: 2, cpc: 1.5, costPerResult: 20 }),
  })
);
assert.equal(scale.action, "SCALE", "una mejora fuerte y con volumen debe recomendar SCALE");
assert.equal(scale.confidence, "high");
assert.ok(scale.score >= 75);
assert.equal(scale.suggestedChangePercent, 15);

const insufficient = evaluateDecision(
  input({
    current: metrics({ spend: 2, reach: 120, impressions: 180, clicks: 4, results: 0, frequency: 1.5, ctr: 2.2, cpc: 0.5, costPerResult: 0 }),
    previous: metrics({ spend: 0, reach: 0, impressions: 0, clicks: 0, results: 0, frequency: 0, cpm: 0, ctr: 0, cpc: 0, costPerResult: 0 }),
  })
);
assert.equal(insufficient.action, "INSUFFICIENT_DATA", "ANLUX debe saber cuándo no hay evidencia suficiente");

const learning = evaluateDecision(
  input({
    startDate: new Date().toISOString(),
    current: metrics({ spend: 200, results: 20, clicks: 120, ctr: 3, cpc: 1, costPerResult: 10 }),
    previous: metrics({ spend: 200, results: 10, clicks: 80, ctr: 2, cpc: 1.5, costPerResult: 20 }),
  })
);
assert.equal(learning.action, "INSUFFICIENT_DATA", "una campaña en sus primeros tres días no recibe recomendaciones fuertes");

const pauseCandidate = evaluateDecision(
  input({
    objective: "MESSAGES",
    startDate: "2020-01-01T00:00:00.000Z",
    targetCostPerResult: 20,
    currentResultsAvailable: true,
    current: metrics({ spend: 300, results: 0, clicks: 100, ctr: 1, cpc: 3, costPerResult: 0 }),
    previous: metrics({ spend: 300, results: 30, clicks: 150, ctr: 2.5, cpc: 1, costPerResult: 10 }),
  })
);
assert.equal(pauseCandidate.action, "PAUSE_CANDIDATE", "solo una campaña de mensajes con los tres candados cumplidos puede ser candidata a pausa");

const conversionConversation = evaluateDecision(input({
  objective: "CONVERSIONS",
  resultType: "onsite_conversion.messaging_conversation_started_7d",
  startDate: "2020-01-01T00:00:00.000Z",
  targetCostPerResult: 20,
  currentResultsAvailable: true,
  current: metrics({ spend: 300, results: 0, clicks: 100, ctr: 1, cpc: 3, costPerResult: 0 }),
  previous: metrics({ spend: 300, results: 30, clicks: 150, ctr: 2.5, cpc: 1, costPerResult: 10 }),
}));
assert.equal(conversionConversation.action, "PAUSE_CANDIDATE", "una conversión de mensajería usa los mismos candados de pausa");
assert.equal(evaluateDecision(input({ ...conversionConversation, objective: "CONVERSIONS", targetCostPerResult: null, current: conversionConversation.currentMetrics, previous: conversionConversation.previousMetrics })).action, "INSUFFICIENT_DATA");

const pauseLocked = evaluateDecision(
  input({
    objective: "MESSAGES",
    startDate: "2020-01-01T00:00:00.000Z",
    currentResultsAvailable: true,
    current: metrics({ spend: 300, results: 0, clicks: 100, costPerResult: 0 }),
  })
);
assert.equal(pauseLocked.action, "INSUFFICIENT_DATA", "sin costo típico u objetivo confirmado no se recomienda pausar");

const creative = evaluateDecision(
  input({
    entityType: "ad",
    entityId: "ad_1",
    entityName: "Creativo A",
    objective: "TRAFFIC",
    current: metrics({ impressions: 6000, clicks: 60, ctr: 1, cpc: 2 }),
    previous: metrics({ impressions: 6000, clicks: 120, ctr: 2, cpc: 1 }),
  })
);
assert.equal(creative.action, "REFRESH_CREATIVE", "un anuncio con deterioro fuerte debe señalar creativo");

const audience = evaluateDecision(
  input({
    entityType: "adset",
    entityId: "set_1",
    entityName: "Audiencia A",
    objective: "TRAFFIC",
    current: metrics({ impressions: 8000, reach: 1900, frequency: 4.2, ctr: 1.4, cpc: 1.8 }),
    previous: metrics({ impressions: 5000, reach: 2500, frequency: 2, ctr: 2, cpc: 1.2 }),
  })
);
assert.equal(audience.action, "REFRESH_CREATIVE", "la frecuencia alta activa la protección de fatiga creativa");

const unknown = evaluateDecision(
  input({
    objective: "UNKNOWN",
    current: metrics({ results: 100, ctr: 5, cpc: 0.2 }),
    previous: metrics({ results: 1, ctr: 1, cpc: 1 }),
  })
);
assert.notEqual(unknown.action, "SCALE", "un objetivo UNKNOWN nunca debe generar escalado agresivo");
assert.notEqual(unknown.action, "PAUSE_CANDIDATE", "un objetivo UNKNOWN nunca debe generar pausa agresiva");

const lowMessageSample = evaluateDecision(input({
  objective: "MESSAGES",
  resultType: "onsite_conversion.messaging_conversation_started_7d",
  previousResultType: "onsite_conversion.messaging_conversation_started_7d",
  currentResultsAvailable: true,
  previousResultsAvailable: true,
  startDate: "2020-01-01",
  current: metrics({ spend: 58.07, impressions: 42000, clicks: 42, results: 2, cpc: 1.38, ctr: 1.3, costPerResult: 29.04 }),
  previous: metrics({ spend: 42.09, impressions: 18000, clicks: 17, results: 3, cpc: 2.48, ctr: 0.9, costPerResult: 14.03 }),
}));
assert.equal(lowMessageSample.action, "WATCH", "CPC mejor no debe contradecir CPR peor con solo dos conversaciones");
assert.equal(lowMessageSample.score, 50, "una muestra insuficiente mantiene puntaje neutral");
assert.equal(lowMessageSample.suggestedChangePercent, null);
assert.ok(lowMessageSample.signals.some((signal) => signal.code === "outcome_sample_insufficient"));
assert.ok(lowMessageSample.signals.some((signal) => signal.code === "cpc_down"), "CPC queda como diagnóstico secundario");

const differentResultTypes = evaluateDecision(input({
  objective: "MESSAGES",
  resultType: "onsite_conversion.messaging_conversation_started_7d",
  previousResultType: "purchase",
  currentResultsAvailable: true,
  previousResultsAvailable: true,
  startDate: "2020-01-01",
  current: metrics({ results: 5, cpc: 0.8, costPerResult: 10 }),
  previous: metrics({ results: 5, cpc: 1, costPerResult: 20 }),
}));
assert.equal(differentResultTypes.action, "WATCH", "acciones de resultado distintas no justifican una recomendación direccional");
assert.equal(differentResultTypes.score, 50);
assert.ok(!differentResultTypes.signals.some((signal) => signal.code === "cpr_down_strong"));

console.log("Decision Engine: guardarraíles de mensajes correctos.");
