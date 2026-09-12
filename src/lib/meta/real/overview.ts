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

  let results = 0;
  for (const [campaignId, row] of campaignRows) {
    const objective = campaignObjectives.get(campaignId) ?? "UNKNOWN";
    const actions = parseActionsArray(row.actions);
    results += getPrimaryResult(actions, objective) ?? 0;
  }

  if (accountRow) {
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

  /**
   * Meta puede devolver filas de insights a nivel campaña y, de forma
   * transitoria, omitir la fila agregada de cuenta. Antes ANLUX interpretaba
   * ese caso como "cero actividad" y descartaba campañas reales.
   *
   * Spend, impressions, clicks y results son aditivos entre campañas, así que
   * se pueden recuperar de forma segura. Reach NO se suma porque personas
   * alcanzadas por varias campañas quedarían duplicadas; se mantiene en 0
   * hasta que Meta entregue el agregado de cuenta correcto.
   */
  if (campaignRows.size > 0) {
    const fallbackRows: DailyMetrics[] = [];
    for (const [campaignId, row] of campaignRows) {
      const objective = campaignObjectives.get(campaignId) ?? "UNKNOWN";
      const actions = parseActionsArray(row.actions);
      fallbackRows.push({
        date: row.date_start ?? since,
        entityId: campaignId,
        entityType: "campaign",
        spend: toNumber(row.spend),
        impressions: toNumber(row.impressions),
        reach: 0,
        clicks: toNumber(row.clicks),
        results: getPrimaryResult(actions, objective) ?? 0,
      });
    }
    return aggregateMetrics(fallbackRows);
  }

  return aggregateMetrics([]);
}
