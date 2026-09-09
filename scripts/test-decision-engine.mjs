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

const pauseCandidate = evaluateDecision(
  input({
    current: metrics({ spend: 300, results: 15, clicks: 100, ctr: 1, cpc: 3, costPerResult: 20 }),
    previous: metrics({ spend: 300, results: 30, clicks: 150, ctr: 2.5, cpc: 1, costPerResult: 10 }),
  })
);
assert.equal(pauseCandidate.confidence, "high");
assert.equal(pauseCandidate.action, "PAUSE_CANDIDATE", "deterioro fuerte con evidencia alta debe ser candidato a pausa");

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
assert.equal(audience.action, "REVIEW_AUDIENCE", "frecuencia alta + deterioro debe señalar audiencia");

const unknown = evaluateDecision(
  input({
    objective: "UNKNOWN",
    current: metrics({ results: 100, ctr: 5, cpc: 0.2 }),
    previous: metrics({ results: 1, ctr: 1, cpc: 1 }),
  })
);
assert.notEqual(unknown.action, "SCALE", "un objetivo UNKNOWN nunca debe generar escalado agresivo");
assert.notEqual(unknown.action, "PAUSE_CANDIDATE", "un objetivo UNKNOWN nunca debe generar pausa agresiva");

console.log("Decision Engine v1: 6 escenarios correctos.");
