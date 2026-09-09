import type { PerformanceDecision } from "@/lib/decisions/types";
import type { BusinessGoals, IntelligenceSuiteResult } from "./types";

function pct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function guarded(decision: PerformanceDecision) {
  const m = decision.currentMetrics;
  const direct = ["LEAD_GENERATION", "MESSAGES", "CONVERSIONS", "SALES"].includes(decision.objective);
  const blocked = decision.confidence === "low" || (direct ? m.results < 3 && m.clicks < 30 : m.impressions < 2000);
  return {
    entityId: decision.entityId,
    entityName: decision.entityName,
    blocked,
    reason: blocked ? "Volumen insuficiente para recomendar un cambio fuerte con confianza." : null,
  };
}

export function buildIntelligenceSuite(decisions: PerformanceDecision[], goals: BusinessGoals = {}): IntelligenceSuiteResult {
  const learningGuards = decisions.map(guarded);
  const blocked = new Set(learningGuards.filter((g) => g.blocked).map((g) => g.entityId));

  const anomalies = decisions.flatMap((d) => {
    const changes = [
      ["CTR", pct(d.currentMetrics.ctr, d.previousMetrics.ctr)],
      ["CPC", pct(d.currentMetrics.cpc, d.previousMetrics.cpc)],
      ["Costo por resultado", pct(d.currentMetrics.costPerResult, d.previousMetrics.costPerResult)],
      ["Resultados", pct(d.currentMetrics.results, d.previousMetrics.results)],
    ] as const;
    return changes
      .filter(([, change]) => change !== null && Math.abs(change) >= 30)
      .map(([metric, change]) => ({
        entityId: d.entityId,
        entityName: d.entityName,
        severity: Math.abs(change!) >= 60 ? "critical" as const : "warning" as const,
        metric,
        changePercent: Math.round(change! * 10) / 10,
        message: `${metric} cambió ${change! > 0 ? "+" : ""}${change!.toFixed(1)}% frente al periodo anterior.`,
      }));
  });

  if (goals.targetCostPerResult && goals.targetCostPerResult > 0) {
    for (const d of decisions) {
      if (d.currentMetrics.results <= 0) continue;
      const variance = ((d.currentMetrics.costPerResult - goals.targetCostPerResult) / goals.targetCostPerResult) * 100;
      if (Math.abs(variance) >= 20) anomalies.push({
        entityId: d.entityId,
        entityName: d.entityName,
        severity: variance > 40 ? "critical" : "warning",
        metric: "Costo por resultado vs objetivo",
        changePercent: Math.round(variance * 10) / 10,
        message: `El costo por resultado está ${Math.abs(variance).toFixed(1)}% ${variance > 0 ? "por encima" : "por debajo"} del objetivo configurado.`,
      });
    }
  }

  const scalable = decisions.filter((d) => d.action === "SCALE" && !blocked.has(d.entityId));
  const reducible = decisions.filter((d) => ["REDUCE", "PAUSE_CANDIDATE"].includes(d.action) && !blocked.has(d.entityId));
  const budgetRecommendations = scalable.slice(0, 5).map((to, index) => {
    const from = reducible[index] ?? null;
    return {
      fromEntityId: from?.entityId ?? null,
      fromEntityName: from?.entityName ?? null,
      toEntityId: to.entityId,
      toEntityName: to.entityName,
      suggestedPercent: Math.min(to.suggestedChangePercent ?? 10, goals.riskTolerance === "conservative" ? 10 : 15),
      confidence: to.confidence,
      rationale: from
        ? `Simulación: reasignar gradualmente desde ${from.entityName} hacia ${to.entityName}; no se ejecuta en Meta.`
        : `Simulación de incremento gradual para ${to.entityName}; no se ejecuta en Meta.`,
    };
  });

  const ads = decisions.filter((d) => d.entityType === "ad");
  const creativeInsights = ads.map((d) => ({
    adId: d.entityId,
    adName: d.entityName,
    status: d.action === "REFRESH_CREATIVE" ? "needs_refresh" as const : d.action === "SCALE" ? "winner" as const : d.score >= 55 ? "healthy" as const : "fatigue_risk" as const,
    score: d.score,
    message: d.action === "REFRESH_CREATIVE" ? "Hay señales de deterioro creativo; conviene preparar una variante sin tocar el anuncio actual automáticamente." : d.rationale,
  })).sort((a, b) => b.score - a.score);

  const experiments = decisions
    .filter((d) => !blocked.has(d.entityId) && ["REFRESH_CREATIVE", "REVIEW_AUDIENCE", "WATCH"].includes(d.action))
    .slice(0, 6)
    .map((d) => ({
      id: `exp:${d.entityId}:${d.action}`,
      entityId: d.entityId,
      entityName: d.entityName,
      hypothesis: d.action === "REFRESH_CREATIVE" ? "Una nueva variante creativa puede recuperar CTR sin cambiar audiencia ni presupuesto." : d.action === "REVIEW_AUDIENCE" ? "Una audiencia alternativa puede mejorar eficiencia manteniendo creativo y presupuesto." : "Aislar una sola variable permitirá confirmar si la variación observada es persistente.",
      variable: d.action === "REFRESH_CREATIVE" ? "creative" as const : d.action === "REVIEW_AUDIENCE" ? "audience" as const : "budget" as const,
      guardrail: "Cambiar una sola variable y no declarar ganador con evidencia insuficiente.",
      successMetric: ["LEAD_GENERATION", "MESSAGES", "CONVERSIONS", "SALES"].includes(d.objective) ? "Costo por resultado y volumen de resultados" : d.objective === "TRAFFIC" ? "CTR y CPC" : "Reach y CPM",
    }));

  const campaignDecisions = decisions.filter((d) => d.entityType === "campaign");
  const totalCurrentResults = campaignDecisions.reduce((s, d) => s + d.currentMetrics.results, 0);
  const totalCurrentSpend = campaignDecisions.reduce((s, d) => s + d.currentMetrics.spend, 0);
  const totalPreviousSpend = campaignDecisions.reduce((s, d) => s + d.previousMetrics.spend, 0);
  const totalPreviousResults = campaignDecisions.reduce((s, d) => s + d.previousMetrics.results, 0);
  const enoughForecast = totalCurrentSpend > 0 && (totalCurrentResults >= 5 || campaignDecisions.reduce((s,d)=>s+d.currentMetrics.clicks,0) >= 50);
  const trend = totalPreviousResults > 0 ? Math.max(0.5, Math.min(1.5, totalCurrentResults / totalPreviousResults)) : 1;
  const forecast = enoughForecast ? {
    basis: "current_period_run_rate" as const,
    projectedResults: Math.round(totalCurrentResults * trend * 10) / 10,
    projectedSpend: Math.round(totalCurrentSpend * (totalPreviousSpend > 0 ? Math.max(0.75, Math.min(1.25, totalCurrentSpend / totalPreviousSpend)) : 1) * 100) / 100,
    uncertaintyPercent: totalCurrentResults >= 20 ? 20 : 35,
    warning: "Proyección orientativa basada en run-rate y tendencia reciente; no es una garantía ni un modelo causal.",
  } : { basis: "insufficient_data" as const, projectedResults: null, projectedSpend: null, uncertaintyPercent: 50, warning: "No hay volumen suficiente para una proyección responsable." };

  const urgent = decisions.filter((d) => ["PAUSE_CANDIDATE", "REDUCE", "REFRESH_CREATIVE", "REVIEW_AUDIENCE"].includes(d.action) && d.confidence !== "low");
  const healthy = decisions.filter((d) => ["SCALE", "MAINTAIN"].includes(d.action) && d.confidence !== "low");
  const brief = {
    headline: urgent.length ? `${urgent.length} elemento(s) requieren atención; ${healthy.length} muestran señales saludables.` : `Sin decisiones urgentes de alta evidencia; ${healthy.length} elemento(s) muestran señales saludables.`,
    attention: urgent.slice(0, 5).map((d) => `${d.entityName}: ${d.rationale}`),
    healthy: healthy.slice(0, 5).map((d) => `${d.entityName}: ${d.rationale}`),
  };

  return {
    generatedAt: new Date().toISOString(), goals, decisions, anomalies,
    budgetRecommendations, creativeInsights, experiments, learningGuards,
    forecast, brief, executionMode: "recommend_only",
    limitations: [
      "ANLUX no modifica campañas ni presupuestos de Meta; las acciones son simulaciones/recomendaciones.",
      "La memoria histórica persistente requiere activar snapshots seguros en Supabase; esta versión compara el periodo actual con el anterior disponible en Meta.",
      "ROAS requiere valor de conversión fiable; no se inventa cuando Meta no lo proporciona.",
    ],
  };
}
