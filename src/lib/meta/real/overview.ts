import "server-only";
import type { DailyMetrics, PerformanceMetrics } from "@/lib/types";
import { fetchCampaignObjectives } from "./campaigns";
import {
  fetchAccountAggregatedInsight,
  fetchAccountDailyInsights,
  fetchAggregatedInsightsByEntity,
  fetchCampaignDailyInsights,
} from "./insights";
import { getPrimaryResult, parseActionsArray, toNumber } from "./actions";
import { aggregateMetrics } from "@/lib/utils/metrics";

export async function fetchAccountDailyMetrics(
  adAccountId: string,
  since: string,
  until: string
): Promise<DailyMetrics[]> {
  const [accountRows, campaignObjectives, campaignRows] = await Promise.all([
    fetchAccountDailyInsights(adAccountId, since, until),
    fetchCampaignObjectives(adAccountId),
    fetchCampaignDailyInsights(adAccountId, since, until),
  ]);

  const resultsByDate = new Map<string, number>();
  for (const row of campaignRows) {
    const date = row.date_start ?? since;
    const objective = (row.campaign_id && campaignObjectives.get(row.campaign_id)) || "UNKNOWN";
    const actions = parseActionsArray(row.actions);
    const result = getPrimaryResult(actions, objective) ?? 0;
    resultsByDate.set(date, (resultsByDate.get(date) ?? 0) + result);
  }

  return accountRows.map((row) => {
    const date = row.date_start ?? since;
    return {
      date,
      entityId: adAccountId,
      entityType: "account",
      spend: toNumber(row.spend),
      impressions: toNumber(row.impressions),
      reach: toNumber(row.reach),
      clicks: toNumber(row.clicks),
      results: resultsByDate.get(date) ?? 0,
    };
  });
}

/** KPIs exactos de cuenta para un rango completo. */
export async function fetchAccountRangeMetrics(
  adAccountId: string,
  since: string,
  until: string
): Promise<PerformanceMetrics> {
  const [accountRow, campaignObjectives, campaignRows] = await Promise.all([
    fetchAccountAggregatedInsight(adAccountId, since, until),
    fetchCampaignObjectives(adAccountId),
    fetchAggregatedInsightsByEntity(adAccountId, "campaign", since, until),
  ]);

  if (!accountRow) return aggregateMetrics([]);

  let results = 0;
  for (const [campaignId, row] of campaignRows) {
    const objective = campaignObjectives.get(campaignId) ?? "UNKNOWN";
    const actions = parseActionsArray(row.actions);
    results += getPrimaryResult(actions, objective) ?? 0;
  }

  return aggregateMetrics([
    {
      date: accountRow.date_start ?? since,
      entityId: adAccountId,
      entityType: "account",
      spend: toNumber(accountRow.spend),
      impressions: toNumber(accountRow.impressions),
      reach: toNumber(accountRow.reach),
      clicks: toNumber(accountRow.clicks),
      results,
    },
  ]);
}
