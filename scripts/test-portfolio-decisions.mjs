import assert from "node:assert/strict";
import { recommendPortfolio } from "../src/lib/decisions/portfolio.ts";

function campaign(id, cost, results, previousCost, previousResults, resultType = "onsite_conversion.messaging_conversation_started_7d") {
  return {
    entityType: "campaign", entityId: id, entityName: id, campaignId: id,
    objective: "SALES", resultType, previousResultType: resultType,
    confidence: "medium", currentResultsAvailable: true, previousResultsAvailable: true,
    currentMetrics: { spend: cost * results, results, costPerResult: cost },
    previousMetrics: { spend: previousCost * previousResults, results: previousResults, costPerResult: previousCost },
  };
}

const efficient = campaign("A", 12.88, 34, 13, 10);
const expensive = campaign("B", 19.93, 37, 20, 11);
const recommendations = recommendPortfolio([efficient, expensive, { ...efficient, entityType: "ad", entityId: "A-ad" }], "MXN");
assert.equal(recommendations.length, 1, "campaign/ad hierarchy must not be double counted");
assert.equal(recommendations[0].action, "TEST_REALLOCATION");
assert.equal(recommendations[0].toCampaignId, "A");
assert.equal(recommendations[0].fromCampaignId, "B");
assert.match(recommendations[0].nextStep, /10%/);

assert.equal(recommendPortfolio([efficient, { ...expensive, resultType: "purchase" }], "MXN").length, 0,
  "a message must not be compared with a purchase");
assert.equal(recommendPortfolio([efficient, { ...expensive, currentMetrics: { spend: 100, results: 3, costPerResult: 33.33 } }], "MXN").length, 0,
  "weak volume must not trigger budget advice");
assert.equal(recommendPortfolio([efficient, { ...expensive, currentMetrics: { spend: 500, results: 37, costPerResult: 13.51 } }], "MXN").length, 0,
  "a small gap must not trigger budget advice");
const shortHistory = recommendPortfolio([efficient, { ...expensive, previousMetrics: { spend: 0, results: 0, costPerResult: 0 } }], "MXN");
assert.equal(shortHistory[0].action, "COMPARE_QUALITY", "missing comparison period cannot justify an immediate shift");
assert.equal(recommendPortfolio([efficient, { ...expensive, objective: "MESSAGES" }], "MXN").length, 0,
  "different objectives are not interchangeable");
console.log("Portfolio: resultados comparables, evidencia y presupuesto protegidos.");
