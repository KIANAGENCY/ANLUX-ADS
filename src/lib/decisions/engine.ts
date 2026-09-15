import type { CampaignObjective, PerformanceMetrics } from "@/lib/types";
import type { DecisionAction, DecisionConfidence, DecisionEntityInput, DecisionRisk, DecisionSignal, PerformanceDecision } from "./types";

// Calibrables con datos reales tras el periodo inicial de uso.
export const MIN_LEARNING_DAYS = 3;
export const FATIGUE_FREQUENCY_THRESHOLD = 3.5;
export const CPC_ACCOUNT_MULTIPLIER = 2;
export const PAUSE_TYPICAL_COST_MULTIPLIER = 3;

const DIRECT_RESPONSE_OBJECTIVES = new Set<CampaignObjective>(["LEAD_GENERATION", "MESSAGES", "CONVERSIONS", "SALES"]);

function percentChange(current: number, previous: number): number | null {
  return Number.isFinite(current) && Number.isFinite(previous) && previous !== 0 ? ((current - previous) / previous) * 100 : null;
}
function clampScore(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function addSignal(signals: DecisionSignal[], code: string, label: string, detail: string, impact: number) { signals.push({ code, label, detail, impact }); }
function family(objective: CampaignObjective): "direct" | "traffic" | "awareness" | "unknown" {
  if (DIRECT_RESPONSE_OBJECTIVES.has(objective)) return "direct";
  if (objective === "TRAFFIC") return "traffic";
  if (objective === "BRAND_AWARENESS") return "awareness";
  return "unknown";
}
function ageInDays(startDate?: string | null): number | null {
  if (!startDate) return null;
  const started = new Date(startDate).getTime();
  if (!Number.isFinite(started)) return null;
  return Math.floor((Date.now() - started) / 86_400_000);
}
function confidence(objective: CampaignObjective, current: PerformanceMetrics, previous: PerformanceMetrics): DecisionConfidence {
  if (family(objective) === "direct") return current.results >= 15 && previous.results >= 5 && current.clicks >= 50 ? "high" : (current.results >= 5 || current.clicks >= 50 ? "medium" : "low");
  if (family(objective) === "traffic") return current.clicks >= 100 && previous.clicks >= 50 ? "high" : current.clicks >= 30 ? "medium" : "low";
  return current.impressions >= 5_000 && previous.impressions >= 2_000 ? "medium" : "low";
}
function hasEvidence(objective: CampaignObjective, current: PerformanceMetrics) {
  if (family(objective) === "direct") return current.results >= 3 || current.clicks >= 30 || current.impressions >= 2_000;
  return current.impressions >= 2_000 || current.clicks >= 20;
}
function scoreCommon(signals: DecisionSignal[], current: PerformanceMetrics, previous: PerformanceMetrics) {
  let score = 0;
  const ctr = percentChange(current.ctr, previous.ctr), cpc = percentChange(current.cpc, previous.cpc);
  if (ctr !== null) {
    if (ctr >= 20) { score += 12; addSignal(signals, "ctr_up_strong", "Respuesta mejoró", `La respuesta al anuncio subió ${ctr.toFixed(1)}%.`, 12); }
    else if (ctr <= -25) { score -= 12; addSignal(signals, "ctr_down_strong", "Respuesta deteriorada", `La respuesta al anuncio cayó ${Math.abs(ctr).toFixed(1)}%.`, -12); }
    else if (ctr <= -12) { score -= 6; addSignal(signals, "ctr_down", "Respuesta deteriorada", `La respuesta al anuncio cayó ${Math.abs(ctr).toFixed(1)}%.`, -6); }
  }
  if (cpc !== null) {
    if (cpc <= -15) { score += 10; addSignal(signals, "cpc_down", "Visitas más eficientes", `El costo por visita bajó ${Math.abs(cpc).toFixed(1)}%.`, 10); }
    else if (cpc >= 25) { score -= 10; addSignal(signals, "cpc_up", "Visitas más caras", `El costo por visita subió ${cpc.toFixed(1)}%.`, -10); }
  }
  return score;
}
function scoreDirect(signals: DecisionSignal[], current: PerformanceMetrics, previous: PerformanceMetrics, target?: number | null, resultsAvailable?: boolean) {
  let score = 0;
  const cpr = percentChange(current.costPerResult, previous.costPerResult);
  if (current.results >= 3 && previous.results >= 3 && cpr !== null) {
    if (cpr <= -20) { score += 25; addSignal(signals, "cpr_down_strong", "Costo por conversación mejoró", `El costo bajó ${Math.abs(cpr).toFixed(1)}%.`, 25); }
    else if (cpr >= 30) { score -= 25; addSignal(signals, "cpr_up_strong", "Costo por conversación empeoró", `El costo subió ${cpr.toFixed(1)}%.`, -25); }
    else if (cpr >= 15) { score -= 12; addSignal(signals, "cpr_up", "Costo por conversación empeoró", `El costo subió ${cpr.toFixed(1)}%.`, -12); }
  }
  if (target != null && current.results > 0 && current.costPerResult > 0) {
    if (current.costPerResult <= target) { score += 10; addSignal(signals, "target_met", "Objetivo confirmado cumplido", "El costo por conversación está dentro del objetivo confirmado.", 10); }
    else if (current.costPerResult >= target * 1.5) { score -= 15; addSignal(signals, "target_missed", "Objetivo confirmado superado", "El costo por conversación excede de forma importante el objetivo confirmado.", -15); }
  }
  if (resultsAvailable === true && current.results === 0 && current.clicks >= 40) { score -= 20; addSignal(signals, "clicks_no_results", "Tráfico sin conversaciones", "Hay actividad, pero Meta reportó cero conversaciones solo cuando el dato está confirmado.", -20); }
  return score;
}
function scoreTraffic(signals: DecisionSignal[], current: PerformanceMetrics, previous: PerformanceMetrics) {
  const clicks = percentChange(current.clicks, previous.clicks), spend = percentChange(current.spend, previous.spend);
  if (clicks !== null && spend !== null && clicks >= 20 && spend <= 10) { addSignal(signals, "traffic_efficiency_up", "Tráfico más eficiente", "Las visitas crecieron con gasto controlado.", 18); return 18; }
  if (clicks !== null && spend !== null && clicks <= -25 && spend >= -10) { addSignal(signals, "traffic_efficiency_down", "Tráfico deteriorado", "Las visitas cayeron sin ahorro proporcional.", -18); return -18; }
  return 0;
}
function pauseThreshold(input: DecisionEntityInput): number | null {
  const basis = input.typicalCostPerResult ?? input.targetCostPerResult ?? null;
  return basis != null && basis > 0 ? basis * PAUSE_TYPICAL_COST_MULTIPLIER : null;
}
function deriveAction(input: DecisionEntityInput, score: number, level: DecisionConfidence, signals: DecisionSignal[]): DecisionAction {
  const days = ageInDays(input.startDate);
  if (!hasEvidence(input.objective, input.current)) return "INSUFFICIENT_DATA";
  if (days !== null && days < MIN_LEARNING_DAYS) return "INSUFFICIENT_DATA";

  const ctrChange = percentChange(input.current.ctr, input.previous.ctr);
  const cpcChange = percentChange(input.current.cpc, input.previous.cpc);
  if (input.entityType === "ad" && input.current.impressions >= 1_500 &&
    ((ctrChange !== null && ctrChange <= -25) || (cpcChange !== null && cpcChange >= 35))) return "REFRESH_CREATIVE";
  if (input.current.frequency > FATIGUE_FREQUENCY_THRESHOLD) return "REFRESH_CREATIVE";
  if (input.accountAverageCpc != null && input.accountAverageCpc > 0 && input.current.cpc >= input.accountAverageCpc * CPC_ACCOUNT_MULTIPLIER) return "REVIEW_AUDIENCE";

  if (input.objective === "MESSAGES" && input.currentResultsAvailable === true && input.current.results === 0) {
    const threshold = pauseThreshold(input);
    if (days === null || days < MIN_LEARNING_DAYS || threshold === null || input.current.spend < threshold) {
      const detail = threshold == null ? "Falta un costo típico u objetivo confirmado para juzgar esta campaña." : `Lleva al menos ${MIN_LEARNING_DAYS} días, pero se han invertido ${input.current.spend.toFixed(2)}; revisaremos al llegar a ${threshold.toFixed(2)}.`;
      addSignal(signals, "pause_locks_incomplete", "Aún no se puede recomendar pausar", detail, 0);
      return "INSUFFICIENT_DATA";
    }
    return "PAUSE_CANDIDATE";
  }

  if (family(input.objective) === "unknown") return score >= 60 ? "MAINTAIN" : "WATCH";
  if (score >= 75 && level !== "low") return "SCALE";
  if (score >= 60) return "MAINTAIN";
  if (score >= 45) return "WATCH";
  if (score >= 30) return level === "low" ? "WATCH" : "REDUCE";
  return signals.some((signal) => signal.impact <= -20) && level !== "low" ? "REDUCE" : "WATCH";
}
function risk(action: DecisionAction, level: DecisionConfidence): DecisionRisk {
  if (action === "PAUSE_CANDIDATE") return "high";
  return ["SCALE", "REDUCE", "REFRESH_CREATIVE", "REVIEW_AUDIENCE"].includes(action) ? (level === "high" ? "medium" : "high") : "low";
}
function rationale(action: DecisionAction, level: DecisionConfidence, score: number) {
  const suffix = `Score ${score}/100 · confianza ${level === "high" ? "alta" : level === "medium" ? "media" : "baja"}.`;
  if (action === "INSUFFICIENT_DATA") return `Aún no hay información suficiente para una intervención fuerte. ${suffix}`;
  if (action === "PAUSE_CANDIDATE") return `Meta confirmó cero conversaciones y se cumplieron los tres candados de seguridad. ANLUX no pausa campañas automáticamente. ${suffix}`;
  if (action === "REFRESH_CREATIVE") return `La repetición del anuncio indica fatiga; conviene renovar el creativo. ${suffix}`;
  if (action === "REVIEW_AUDIENCE") return `El costo de visita exige revisar la audiencia. ${suffix}`;
  if (action === "SCALE") return `El rendimiento permite probar un aumento gradual. ${suffix}`;
  if (action === "REDUCE") return `El deterioro justifica reducir exposición de forma gradual. ${suffix}`;
  if (action === "MAINTAIN") return `El rendimiento es saludable o estable. ${suffix}`;
  return `Hay señales mixtas; conviene observar antes de cambiar. ${suffix}`;
}
export function evaluateDecision(input: DecisionEntityInput): PerformanceDecision {
  const signals: DecisionSignal[] = [];
  let score = 50 + scoreCommon(signals, input.current, input.previous);
  if (family(input.objective) === "direct") score += scoreDirect(signals, input.current, input.previous, input.targetCostPerResult, input.currentResultsAvailable);
  else if (family(input.objective) === "traffic") score += scoreTraffic(signals, input.current, input.previous);
  if (input.current.frequency > FATIGUE_FREQUENCY_THRESHOLD) { score -= 15; addSignal(signals, "frequency_fatigue", "Exposición repetida", `La audiencia vio el anuncio ${input.current.frequency.toFixed(2)} veces en promedio.`, -15); }
  score = clampScore(score);
  const level = confidence(input.objective, input.current, input.previous);
  const action = deriveAction(input, score, level, signals);
  return { id: `decision_${input.entityType}_${input.entityId}`, entityType: input.entityType, entityId: input.entityId, entityName: input.entityName, campaignId: input.campaignId, campaignName: input.campaignName, objective: input.objective, action, score, confidence: level, risk: risk(action, level), suggestedChangePercent: action === "SCALE" ? (level === "high" ? 15 : 10) : action === "REDUCE" ? (level === "high" ? -15 : -10) : null, rationale: rationale(action, level, score), signals: signals.sort((a,b) => Math.abs(b.impact) - Math.abs(a.impact)), currentMetrics: input.current, previousMetrics: input.previous, currentResultsAvailable: input.currentResultsAvailable, previousResultsAvailable: input.previousResultsAvailable, generatedAt: new Date().toISOString() };
}
