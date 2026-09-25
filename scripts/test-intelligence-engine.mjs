import assert from "node:assert/strict";
import { buildIntelligenceSuite } from "../src/lib/intelligence/engine.ts";

const m=(o={})=>({spend:100,reach:3000,impressions:5000,clicks:100,results:10,frequency:1.7,cpm:20,ctr:2,cpc:1,costPerResult:10,...o});
const base={id:"d1",entityType:"campaign",entityId:"c1",entityName:"Winner",campaignId:"c1",campaignName:"Winner",objective:"LEAD_GENERATION",action:"SCALE",score:90,confidence:"high",risk:"medium",suggestedChangePercent:15,rationale:"Mejora fuerte",signals:[],currentMetrics:m({results:20,costPerResult:8,ctr:3}),previousMetrics:m({results:10,costPerResult:12,ctr:2}),generatedAt:new Date().toISOString()};
const weak={...base,id:"d2",entityId:"c2",entityName:"Weak",campaignId:"c2",campaignName:"Weak",action:"REDUCE",score:25,currentMetrics:m({results:5,costPerResult:25,ctr:1}),previousMetrics:m({results:10,costPerResult:12,ctr:2})};
const comparison={id:"portfolio:c2:c1",action:"TEST_REALLOCATION",fromCampaignId:"c2",fromCampaignName:"Weak",toCampaignId:"c1",toCampaignName:"Winner",resultType:"lead",currentFromCost:25,currentToCost:8,currentFromResults:5,currentToResults:20,relativeCostGapPercent:68,explanation:"Costos comparables",nextStep:"Probar hasta 10% tras verificar calidad",safeguard:"Verificar calidad"};
const suite=buildIntelligenceSuite([base,weak],{targetCostPerResult:10,riskTolerance:"conservative"},[comparison]);
assert.equal(suite.executionMode,"recommend_only");
assert.ok(suite.anomalies.length>0,"debe detectar anomalías relevantes");
assert.equal(suite.budgetRecommendations.length,1,"solo propuestas de campañas comparables entran al resumen");
assert.equal(suite.budgetRecommendations[0].suggestedPercent,10,"la prueba de reasignación limita el movimiento al 10%");
assert.equal(suite.forecast.projectedResults,null,"sin horizonte futuro no debe inventar forecast");
assert.ok(suite.limitations.some(x=>x.includes("no modifica")),"debe declarar explícitamente el límite read-only");
const low={...base,id:"d3",entityId:"c3",entityName:"Nueva",confidence:"low",currentMetrics:m({spend:2,impressions:100,clicks:2,results:0}),previousMetrics:m({spend:0,impressions:0,clicks:0,results:0})};
const guarded=buildIntelligenceSuite([low],{});
assert.equal(guarded.learningGuards[0].blocked,true,"Learning Guard debe bloquear evidencia insuficiente");
assert.equal(guarded.budgetRecommendations.length,0,"no debe sugerir presupuesto sobre entidades bloqueadas");
console.log("Intelligence Suite v2: 7 salvaguardas correctas.");
