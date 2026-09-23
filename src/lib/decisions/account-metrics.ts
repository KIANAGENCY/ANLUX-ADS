import type { CampaignObjective, PerformanceMetrics } from "@/lib/types";
import { getPrimaryResult, parseActionsArray, toNumber } from "@/lib/meta/real/actions";
import type { RawInsightsRow } from "@/lib/meta/real/insights";

/** Preserve Meta's account aggregate (not the active-decision subset). */
export function accountObservationMetrics(
  accountRow: RawInsightsRow | null,
  campaignRows: Map<string, RawInsightsRow>,
  objectives: Map<string, CampaignObjective>
): Pick<PerformanceMetrics, "spend" | "impressions" | "reach" | "clicks" | "results"> | undefined {
  if (!accountRow) return undefined;
  return {
    spend: toNumber(accountRow.spend),
    impressions: toNumber(accountRow.impressions),
    reach: toNumber(accountRow.reach),
    clicks: toNumber(accountRow.clicks),
    results: [...campaignRows].reduce((sum, [id, row]) =>
      sum + (getPrimaryResult(parseActionsArray(row.actions), objectives.get(id) ?? "UNKNOWN") ?? 0), 0),
  };
}
