export interface TargetDerivationObservation {
  campaignId: string;
  periodFrom: string;
  periodTo: string;
  objective: string | null | undefined;
  resultType?: string | null;
  resultsAvailable?: boolean | null;
  spend: number | null | undefined;
  results: number | null | undefined;
}

export interface TargetProposal {
  targetCostPerResult: number;
  periods: number;
  conversations: number;
}

/**
 * Proposes the median daily account CPA from verified messaging campaign snapshots.
 * Rolling windows and duplicate campaign/day rows are excluded to avoid overlap.
 */
export function deriveMessagingTarget(observations: readonly TargetDerivationObservation[]): TargetProposal | null {
  const eligible = observations.filter((observation) =>
    observation.resultType === "onsite_conversion.messaging_conversation_started_7d" &&
    observation.resultsAvailable === true &&
    Boolean(observation.campaignId) &&
    observation.periodFrom === observation.periodTo &&
    Number.isFinite(observation.spend) &&
    (observation.spend ?? -1) >= 0 &&
    Number.isFinite(observation.results) &&
    (observation.results ?? -1) >= 0
  );
  const campaignDays = new Set<string>();
  const daily = new Map<string, { spend: number; results: number }>();
  for (const row of eligible) {
    const campaignDay = `${row.periodFrom}:${row.campaignId}`;
    if (campaignDays.has(campaignDay)) continue;
    campaignDays.add(campaignDay);
    const totals = daily.get(row.periodFrom) ?? { spend: 0, results: 0 };
    totals.spend += row.spend as number;
    totals.results += row.results as number;
    daily.set(row.periodFrom, totals);
  }
  const conversations = [...daily.values()].reduce((total, day) => total + day.results, 0);
  if (daily.size < 7 || conversations < 15) return null;

  const values = [...daily.values()].filter(({ results }) => results > 0).map(({ spend, results }) => spend / results).sort((a, b) => a - b);
  if (values.length < 7) return null;
  const middle = Math.floor(values.length / 2);
  const targetCostPerResult = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  return { targetCostPerResult, periods: daily.size, conversations };
}
