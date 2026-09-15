import type { CampaignObjective } from "@/lib/types";
import { evaluateDecision } from "./engine";
import type { DecisionEntityInput, PerformanceDecision } from "./types";

const DIRECT_RESPONSE_OBJECTIVES = new Set<CampaignObjective>([
  "LEAD_GENERATION",
  "MESSAGES",
  "CONVERSIONS",
  "SALES",
]);

const RESULT_DEPENDENT_SIGNALS = new Set([
  "clicks_no_results",
  "cpr_down_strong",
  "cpr_down",
  "cpr_up_strong",
  "cpr_up",
  "results_efficiency_up",
  "results_efficiency_down",
]);

/**
 * Safety wrapper around the deterministic decision engine.
 *
 * PerformanceMetrics stays numeric for charting/backward compatibility, but a
 * zero in `results` is not proof of zero outcomes unless Meta actually returned
 * the objective-specific action. When that action is missing for a direct-
 * response objective, ANLUX must not reduce/pause/scale based on the placeholder.
 */
export function evaluateDecisionSafely(input: DecisionEntityInput): PerformanceDecision {
  const base = evaluateDecision(input);
  const currentAvailable = input.currentResultsAvailable !== false;
  const previousAvailable = input.previousResultsAvailable !== false;

  if (!DIRECT_RESPONSE_OBJECTIVES.has(input.objective) || currentAvailable) {
    return {
      ...base,
      currentResultsAvailable: currentAvailable,
      previousResultsAvailable: previousAvailable,
    };
  }

  const nonResultSignals = base.signals.filter((signal) => !RESULT_DEPENDENT_SIGNALS.has(signal.code));
  return {
    ...base,
    action: "INSUFFICIENT_DATA",
    score: 50,
    confidence: "low",
    risk: "low",
    suggestedChangePercent: null,
    rationale:
      "Meta no devolvió la métrica primaria de resultados para este objetivo en el periodo. ANLUX conserva gasto, impresiones y clics, pero bloquea cualquier cambio fuerte hasta contar con resultados verificables.",
    signals: [
      {
        code: "results_unavailable",
        label: "Resultados no disponibles",
        detail:
          "El valor numérico de resultados es un marcador estructural, no un cero confirmado. No debe usarse para inferir ausencia de conversaciones, leads o ventas.",
        impact: 0,
      },
      ...nonResultSignals,
    ],
    currentResultsAvailable: false,
    previousResultsAvailable: previousAvailable,
  };
}
