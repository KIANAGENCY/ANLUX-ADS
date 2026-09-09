import type { CampaignObjective, PerformanceMetrics } from "@/lib/types";
import type {
  DecisionAction,
  DecisionConfidence,
  DecisionEntityInput,
  DecisionRisk,
  DecisionSignal,
  PerformanceDecision,
} from "./types";

const DIRECT_RESPONSE_OBJECTIVES = new Set<CampaignObjective>([
  "LEAD_GENERATION",
  "MESSAGES",
  "CONVERSIONS",
  "SALES",
]);

function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function addSignal(signals: DecisionSignal[], code: string, label: string, detail: string, impact: number) {
  signals.push({ code, label, detail, impact });
}

function objectiveFamily(objective: CampaignObjective): "direct" | "traffic" | "awareness" | "unknown" {
  if (DIRECT_RESPONSE_OBJECTIVES.has(objective)) return "direct";
  if (objective === "TRAFFIC") return "traffic";
  if (objective === "BRAND_AWARENESS") return "awareness";
  return "unknown";
}

function determineConfidence(
  objective: CampaignObjective,
  current: PerformanceMetrics,
  previous: PerformanceMetrics
): DecisionConfidence {
  const family = objectiveFamily(objective);

  if (family === "direct") {
    if (current.results >= 15 && previous.results >= 5 && current.clicks >= 50) return "high";
    if ((current.results >= 5 && previous.results >= 2) || (current.clicks >= 50 && previous.clicks >= 20)) return "medium";
    return "low";
  }

  if (family === "traffic") {
    if (current.clicks >= 100 && previous.clicks >= 50) return "high";
    if (current.clicks >= 30 && previous.clicks >= 15) return "medium";
    return "low";
  }

  if (family === "awareness") {
    if (current.impressions >= 10_000 && previous.impressions >= 5_000) return "high";
    if (current.impressions >= 3_000 && previous.impressions >= 1_000) return "medium";
    return "low";
  }

  if (current.impressions >= 5_000 && previous.impressions >= 2_000) return "medium";
  return "low";
}

function hasMinimumEvidence(objective: CampaignObjective, current: PerformanceMetrics): boolean {
  const family = objectiveFamily(objective);
  if (family === "direct") {
    return current.results >= 3 || current.clicks >= 30 || current.impressions >= 2_000;
  }
  if (family === "traffic") {
    return current.clicks >= 20 || current.impressions >= 2_000;
  }
  if (family === "awareness") {
    return current.impressions >= 3_000 || current.reach >= 2_000;
  }
  return current.impressions >= 3_000 || current.clicks >= 30;
}

function scoreCommonSignals(signals: DecisionSignal[], current: PerformanceMetrics, previous: PerformanceMetrics): number {
  let score = 0;
  const ctrChange = percentChange(current.ctr, previous.ctr);
  const cpcChange = percentChange(current.cpc, previous.cpc);

  if (ctrChange !== null) {
    if (ctrChange >= 20) {
      score += 12;
      addSignal(signals, "ctr_up_strong", "CTR mejoró", `El CTR subió ${ctrChange.toFixed(1)}% frente al periodo anterior.`, 12);
    } else if (ctrChange >= 10) {
      score += 6;
      addSignal(signals, "ctr_up", "CTR mejoró", `El CTR subió ${ctrChange.toFixed(1)}%.`, 6);
    } else if (ctrChange <= -25) {
      score -= 12;
      addSignal(signals, "ctr_down_strong", "CTR deteriorado", `El CTR cayó ${Math.abs(ctrChange).toFixed(1)}%.`, -12);
    } else if (ctrChange <= -12) {
      score -= 6;
      addSignal(signals, "ctr_down", "CTR deteriorado", `El CTR cayó ${Math.abs(ctrChange).toFixed(1)}%.`, -6);
    }
  }

  if (cpcChange !== null) {
    if (cpcChange <= -15) {
      score += 10;
      addSignal(signals, "cpc_down", "CPC mejoró", `El CPC bajó ${Math.abs(cpcChange).toFixed(1)}%.`, 10);
    } else if (cpcChange >= 25) {
      score -= 10;
      addSignal(signals, "cpc_up", "CPC empeoró", `El CPC subió ${cpcChange.toFixed(1)}%.`, -10);
    }
  }

  return score;
}

function scoreDirectResponse(signals: DecisionSignal[], current: PerformanceMetrics, previous: PerformanceMetrics): number {
  let score = 0;
  const cprChange = percentChange(current.costPerResult, previous.costPerResult);
  const resultsChange = percentChange(current.results, previous.results);
  const spendChange = percentChange(current.spend, previous.spend);

  if (current.results >= 3 && previous.results >= 3 && cprChange !== null) {
    if (cprChange <= -20) {
      score += 25;
      addSignal(signals, "cpr_down_strong", "Costo por resultado mejoró mucho", `El costo por resultado bajó ${Math.abs(cprChange).toFixed(1)}%.`, 25);
    } else if (cprChange <= -10) {
      score += 12;
      addSignal(signals, "cpr_down", "Costo por resultado mejoró", `El costo por resultado bajó ${Math.abs(cprChange).toFixed(1)}%.`, 12);
    } else if (cprChange >= 30) {
      score -= 25;
      addSignal(signals, "cpr_up_strong", "Costo por resultado empeoró mucho", `El costo por resultado subió ${cprChange.toFixed(1)}%.`, -25);
    } else if (cprChange >= 15) {
      score -= 12;
      addSignal(signals, "cpr_up", "Costo por resultado empeoró", `El costo por resultado subió ${cprChange.toFixed(1)}%.`, -12);
    }
  }

  if (resultsChange !== null && spendChange !== null) {
    if (resultsChange >= 20 && spendChange <= 10) {
      score += 15;
      addSignal(signals, "results_efficiency_up", "Más resultados con gasto controlado", `Los resultados crecieron ${resultsChange.toFixed(1)}% con una variación de gasto de ${spendChange.toFixed(1)}%.`, 15);
    } else if (resultsChange <= -25 && spendChange >= -10) {
      score -= 15;
      addSignal(signals, "results_efficiency_down", "Menos resultados sin ahorro proporcional", `Los resultados cayeron ${Math.abs(resultsChange).toFixed(1)}% mientras el gasto varió ${spendChange.toFixed(1)}%.`, -15);
    }
  }

  if (current.results === 0 && current.clicks >= 40) {
    score -= 20;
    addSignal(signals, "clicks_no_results", "Tráfico sin resultados", `Hay ${current.clicks} clics y ningún resultado atribuido en el periodo.`, -20);
  }

  return score;
}

function scoreTraffic(signals: DecisionSignal[], current: PerformanceMetrics, previous: PerformanceMetrics): number {
  let score = 0;
  const clicksChange = percentChange(current.clicks, previous.clicks);
  const spendChange = percentChange(current.spend, previous.spend);
  const cpmChange = percentChange(current.cpm, previous.cpm);

  if (clicksChange !== null && spendChange !== null) {
    if (clicksChange >= 20 && spendChange <= 10) {
      score += 18;
      addSignal(signals, "traffic_efficiency_up", "Tráfico más eficiente", `Los clics crecieron ${clicksChange.toFixed(1)}% con gasto controlado.`, 18);
    } else if (clicksChange <= -25 && spendChange >= -10) {
      score -= 18;
      addSignal(signals, "traffic_efficiency_down", "Tráfico deteriorado", `Los clics cayeron ${Math.abs(clicksChange).toFixed(1)}% sin una reducción equivalente del gasto.`, -18);
    }
  }

  if (cpmChange !== null) {
    if (cpmChange <= -15) {
      score += 6;
      addSignal(signals, "cpm_down", "CPM mejoró", `El CPM bajó ${Math.abs(cpmChange).toFixed(1)}%.`, 6);
    } else if (cpmChange >= 25) {
      score -= 6;
      addSignal(signals, "cpm_up", "CPM subió", `El CPM aumentó ${cpmChange.toFixed(1)}%.`, -6);
    }
  }
  return score;
}

function scoreAwareness(signals: DecisionSignal[], current: PerformanceMetrics, previous: PerformanceMetrics): number {
  let score = 0;
  const reachChange = percentChange(current.reach, previous.reach);
  const spendChange = percentChange(current.spend, previous.spend);
  const cpmChange = percentChange(current.cpm, previous.cpm);

  if (reachChange !== null && spendChange !== null) {
    if (reachChange >= 20 && spendChange <= 10) {
      score += 20;
      addSignal(signals, "reach_efficiency_up", "Alcance más eficiente", `El alcance creció ${reachChange.toFixed(1)}% con gasto controlado.`, 20);
    } else if (reachChange <= -25 && spendChange >= -10) {
      score -= 20;
      addSignal(signals, "reach_efficiency_down", "Alcance deteriorado", `El alcance cayó ${Math.abs(reachChange).toFixed(1)}% sin una reducción equivalente del gasto.`, -20);
    }
  }

  if (cpmChange !== null) {
    if (cpmChange <= -15) score += 8;
    else if (cpmChange >= 25) score -= 8;
  }
  return score;
}

function deriveAction(
  input: DecisionEntityInput,
  score: number,
  confidence: DecisionConfidence,
  signals: DecisionSignal[]
): DecisionAction {
  if (!hasMinimumEvidence(input.objective, input.current)) return "INSUFFICIENT_DATA";

  const family = objectiveFamily(input.objective);
  const ctrChange = percentChange(input.current.ctr, input.previous.ctr);
  const cpcChange = percentChange(input.current.cpc, input.previous.cpc);

  if (
    input.entityType === "ad" &&
    input.current.impressions >= 1_500 &&
    ((ctrChange !== null && ctrChange <= -25) || (cpcChange !== null && cpcChange >= 35))
  ) {
    return "REFRESH_CREATIVE";
  }

  if (
    input.entityType === "adset" &&
    input.current.frequency >= 3.5 &&
    ((ctrChange !== null && ctrChange <= -10) || (cpcChange !== null && cpcChange >= 15))
  ) {
    return "REVIEW_AUDIENCE";
  }

  if (family === "unknown") {
    return score >= 60 ? "MAINTAIN" : "WATCH";
  }

  if (score >= 75 && confidence !== "low") {
    if (family === "direct" && input.current.results === 0) return "WATCH";
    return "SCALE";
  }
  if (score >= 60) return "MAINTAIN";
  if (score >= 45) return "WATCH";
  if (score >= 30) return confidence === "low" ? "WATCH" : "REDUCE";
  if (family === "direct" && confidence === "high") return "PAUSE_CANDIDATE";

  if (signals.some((signal) => signal.impact <= -20) && confidence !== "low") return "REDUCE";
  return "WATCH";
}

function riskFor(action: DecisionAction, confidence: DecisionConfidence): DecisionRisk {
  if (action === "PAUSE_CANDIDATE") return "high";
  if (action === "SCALE" || action === "REDUCE" || action === "REFRESH_CREATIVE" || action === "REVIEW_AUDIENCE") {
    return confidence === "high" ? "medium" : "high";
  }
  return "low";
}

function suggestedChange(action: DecisionAction, confidence: DecisionConfidence): number | null {
  if (action === "SCALE") return confidence === "high" ? 15 : 10;
  if (action === "REDUCE") return confidence === "high" ? -15 : -10;
  return null;
}

function rationaleFor(action: DecisionAction, confidence: DecisionConfidence, score: number): string {
  const suffix = `Score ${score}/100 · confianza ${confidence === "high" ? "alta" : confidence === "medium" ? "media" : "baja"}.`;
  switch (action) {
    case "SCALE":
      return `El rendimiento muestra una mejora consistente y suficiente evidencia para probar un aumento gradual, no un salto brusco. ${suffix}`;
    case "MAINTAIN":
      return `El rendimiento es saludable o estable; no hay evidencia suficiente para justificar un cambio agresivo. ${suffix}`;
    case "WATCH":
      return `Hay señales mixtas o todavía no son suficientemente fuertes para intervenir. Conviene observar antes de modificar la entrega. ${suffix}`;
    case "REDUCE":
      return `El deterioro es consistente y la evidencia justifica reducir exposición de forma gradual mientras se diagnostica la causa. ${suffix}`;
    case "PAUSE_CANDIDATE":
      return `El rendimiento presenta deterioro fuerte con evidencia suficiente. Es candidato a pausa, pero ANLUX no ejecuta la acción automáticamente. ${suffix}`;
    case "REFRESH_CREATIVE":
      return `El patrón apunta a fatiga o pérdida de respuesta del anuncio; conviene revisar o renovar el creativo antes de tocar otras variables. ${suffix}`;
    case "REVIEW_AUDIENCE":
      return `La frecuencia y el deterioro de respuesta sugieren saturación de audiencia; conviene revisar segmentación o ampliar alcance. ${suffix}`;
    case "INSUFFICIENT_DATA":
      return `Todavía no hay volumen suficiente para distinguir una tendencia real de variación normal. No conviene tomar una decisión fuerte. ${suffix}`;
  }
}

export function evaluateDecision(input: DecisionEntityInput): PerformanceDecision {
  const signals: DecisionSignal[] = [];
  let score = 50;
  score += scoreCommonSignals(signals, input.current, input.previous);

  const family = objectiveFamily(input.objective);
  if (family === "direct") score += scoreDirectResponse(signals, input.current, input.previous);
  else if (family === "traffic") score += scoreTraffic(signals, input.current, input.previous);
  else if (family === "awareness") score += scoreAwareness(signals, input.current, input.previous);
  else {
    addSignal(
      signals,
      "objective_unknown",
      "Objetivo no interpretable",
      "Meta no devolvió un objetivo que ANLUX pueda mapear con certeza; se bloquean decisiones agresivas.",
      0
    );
  }

  if (input.current.frequency > 4.5) {
    score -= 15;
    addSignal(signals, "frequency_high", "Frecuencia alta", `La frecuencia es ${input.current.frequency.toFixed(2)}.`, -15);
  } else if (input.current.frequency > 3.2) {
    score -= 8;
    addSignal(signals, "frequency_rising", "Frecuencia elevada", `La frecuencia es ${input.current.frequency.toFixed(2)}.`, -8);
  }

  score = clampScore(score);
  const confidence = determineConfidence(input.objective, input.current, input.previous);
  const action = deriveAction(input, score, confidence, signals);

  return {
    id: `decision_${input.entityType}_${input.entityId}`,
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: input.entityName,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    objective: input.objective,
    action,
    score,
    confidence,
    risk: riskFor(action, confidence),
    suggestedChangePercent: suggestedChange(action, confidence),
    rationale: rationaleFor(action, confidence, score),
    signals: signals.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
    currentMetrics: input.current,
    previousMetrics: input.previous,
    generatedAt: new Date().toISOString(),
  };
}
