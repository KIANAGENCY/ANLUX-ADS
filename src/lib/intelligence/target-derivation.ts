export interface TargetDerivationObservation {
  periodFrom: string;
  periodTo: string;
  objective: string | null | undefined;
  resultType?: string | null;
  resultsAvailable?: boolean | null;
  costPerResult: number | null | undefined;
  results: number | null | undefined;
}

export interface TargetProposal {
  targetCostPerResult: number;
  periods: number;
  conversations: number;
}

/**
 * Proposes the 25th percentile of verified messaging observations. It deliberately
 * returns null instead of normalising weak or incomplete historical evidence.
 */
export function deriveMessagingTarget(observations: readonly TargetDerivationObservation[]): TargetProposal | null {
  const eligible = observations.filter((observation) =>
    observation.resultType === "onsite_conversion.messaging_conversation_started_7d" &&
    observation.resultsAvailable === true &&
    Number.isFinite(observation.costPerResult) &&
    (observation.costPerResult ?? 0) > 0 &&
    Number.isFinite(observation.results) &&
    (observation.results ?? 0) >= 0
  );
  const periods = new Set(eligible.map((observation) => `${observation.periodFrom}:${observation.periodTo}`));
  const conversations = eligible.reduce((total, observation) => total + (observation.results ?? 0), 0);
  if (periods.size < 3 || conversations < 10) return null;

  const values = eligible.map((observation) => observation.costPerResult as number).sort((a, b) => a - b);
  const index = (values.length - 1) * 0.25;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const targetCostPerResult = values[lower] + (values[upper] - values[lower]) * (index - lower);
  return { targetCostPerResult, periods: periods.size, conversations };
}
