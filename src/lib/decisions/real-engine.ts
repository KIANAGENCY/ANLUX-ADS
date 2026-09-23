import "server-only";
import { fetchAdAccounts } from "@/lib/meta/real/accounts";
import { fetchRealAds } from "@/lib/meta/real/ads";
import { fetchRealAdSets } from "@/lib/meta/real/adsets";
import { fetchRealCampaigns } from "@/lib/meta/real/campaigns";
import { fetchAccountAggregatedInsight, fetchAggregatedInsightsByEntity, hasPrimaryResult, mapInsightsRowToDailyMetrics } from "@/lib/meta/real/insights";
import { accountObservationMetrics } from "./account-metrics";
import type { CampaignObjective, DateRange, PerformanceMetrics } from "@/lib/types";
import { getPreviousPeriod } from "@/lib/utils/dates";
import { aggregateMetrics } from "@/lib/utils/metrics";
import { evaluateDecisionSafely } from "./safe-evaluate";
import type { DecisionEngineResult, DecisionEngineSummary, PerformanceDecision } from "./types";

function emptyMetrics(): PerformanceMetrics {
  return aggregateMetrics([]);
}

function metricsFromRow(
  row: Parameters<typeof mapInsightsRowToDailyMetrics>[0] | undefined,
  entityId: string,
  entityType: "campaign" | "adset" | "ad",
  objective: CampaignObjective,
  fallbackDate: string
): PerformanceMetrics {
  if (!row) return emptyMetrics();
  return aggregateMetrics([mapInsightsRowToDailyMetrics(row, entityId, entityType, objective, fallbackDate)]);
}

function hasCurrentActivity(metrics: PerformanceMetrics): boolean {
  return metrics.spend > 0 || metrics.impressions > 0 || metrics.clicks > 0 || metrics.results > 0;
}

function accountAverageCpc(rows: Map<string, Parameters<typeof mapInsightsRowToDailyMetrics>[0]>): number | null {
  let spend = 0;
  let clicks = 0;
  for (const row of rows.values()) {
    const rowSpend = Number(row.spend);
    const rowClicks = Number(row.clicks);
    if (Number.isFinite(rowSpend) && rowSpend >= 0) spend += rowSpend;
    if (Number.isFinite(rowClicks) && rowClicks >= 0) clicks += rowClicks;
  }
  return clicks > 0 ? spend / clicks : null;
}

function summarize(decisions: PerformanceDecision[]): DecisionEngineSummary {
  return {
    total: decisions.length,
    scale: decisions.filter((d) => d.action === "SCALE").length,
    maintain: decisions.filter((d) => d.action === "MAINTAIN").length,
    watch: decisions.filter((d) => d.action === "WATCH").length,
    reduce: decisions.filter((d) => d.action === "REDUCE").length,
    pauseCandidate: decisions.filter((d) => d.action === "PAUSE_CANDIDATE").length,
    refreshCreative: decisions.filter((d) => d.action === "REFRESH_CREATIVE").length,
    reviewAudience: decisions.filter((d) => d.action === "REVIEW_AUDIENCE").length,
    insufficientData: decisions.filter((d) => d.action === "INSUFFICIENT_DATA").length,
    highConfidence: decisions.filter((d) => d.confidence === "high").length,
  };
}

const ACTION_PRIORITY: Record<PerformanceDecision["action"], number> = {
  PAUSE_CANDIDATE: 0,
  REDUCE: 1,
  REFRESH_CREATIVE: 2,
  REVIEW_AUDIENCE: 3,
  SCALE: 4,
  WATCH: 5,
  MAINTAIN: 6,
  INSUFFICIENT_DATA: 7,
};

function sortDecisions(decisions: PerformanceDecision[]): PerformanceDecision[] {
  const confidenceWeight = { high: 0, medium: 1, low: 2 } as const;
  return decisions.sort((a, b) => {
    const actionDiff = ACTION_PRIORITY[a.action] - ACTION_PRIORITY[b.action];
    if (actionDiff !== 0) return actionDiff;
    const confidenceDiff = confidenceWeight[a.confidence] - confidenceWeight[b.confidence];
    if (confidenceDiff !== 0) return confidenceDiff;
    return Math.abs(b.score - 50) - Math.abs(a.score - 50);
  });
}

/**
 * Genera recomendaciones determinísticas usando exclusivamente datos reales de Meta.
 * No existe ninguna llamada de escritura ni al Marketing API ni a un proveedor de IA.
 */
export async function generateRealDecisions(accountId: string, range: DateRange, options?: { targetCostPerResult?: number | null }): Promise<DecisionEngineResult> {
  const previous = getPreviousPeriod(range);

  const [accounts, campaigns, adSets, ads, currentCampaignRows, previousCampaignRows, currentAdSetRows, previousAdSetRows, currentAdRows, previousAdRows, accountRow] =
    await Promise.all([
      fetchAdAccounts(),
      fetchRealCampaigns(accountId),
      fetchRealAdSets(accountId),
      fetchRealAds(accountId),
      fetchAggregatedInsightsByEntity(accountId, "campaign", range.from, range.to),
      fetchAggregatedInsightsByEntity(accountId, "campaign", previous.from, previous.to),
      fetchAggregatedInsightsByEntity(accountId, "adset", range.from, range.to),
      fetchAggregatedInsightsByEntity(accountId, "adset", previous.from, previous.to),
      fetchAggregatedInsightsByEntity(accountId, "ad", range.from, range.to),
      fetchAggregatedInsightsByEntity(accountId, "ad", previous.from, previous.to),
      fetchAccountAggregatedInsight(accountId, range.from, range.to),
    ]);

  const currency = accounts.find((account) => account.id === accountId)?.currency ?? null;
  const objectives = new Map(campaigns.map((campaign) => [campaign.id, campaign.objective]));
  const accountMetrics = accountObservationMetrics(accountRow, currentCampaignRows, objectives);
  const currentAccountAverageCpc = accountAverageCpc(currentCampaignRows);
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const decisions: PerformanceDecision[] = [];

  for (const campaign of campaigns) {
    if (campaign.status !== "ACTIVE") continue;
    const currentRow = currentCampaignRows.get(campaign.id);
    const previousRow = previousCampaignRows.get(campaign.id);
    const current = metricsFromRow(currentRow, campaign.id, "campaign", campaign.objective, range.from);
    if (!hasCurrentActivity(current)) continue;
    const previousMetrics = metricsFromRow(previousRow, campaign.id, "campaign", campaign.objective, previous.from);

    decisions.push(
      evaluateDecisionSafely({
        entityType: "campaign",
        entityId: campaign.id,
        entityName: campaign.name,
        campaignId: campaign.id,
        campaignName: campaign.name,
        objective: campaign.objective,
        current,
        previous: previousMetrics,
        currentResultsAvailable: Boolean(currentRow && hasPrimaryResult(currentRow, campaign.objective)),
        previousResultsAvailable: Boolean(previousRow && hasPrimaryResult(previousRow, campaign.objective)),
        startDate: campaign.startDate ?? null,
        targetCostPerResult: options?.targetCostPerResult ?? null,
        accountAverageCpc: currentAccountAverageCpc,
      })
    );
  }

  for (const adSet of adSets) {
    if (adSet.status !== "ACTIVE") continue;
    const campaign = campaignById.get(adSet.campaignId);
    const objective = adSet.campaignObjective ?? campaign?.objective ?? "UNKNOWN";
    const currentRow = currentAdSetRows.get(adSet.id);
    const previousRow = previousAdSetRows.get(adSet.id);
    const current = metricsFromRow(currentRow, adSet.id, "adset", objective, range.from);
    if (!hasCurrentActivity(current)) continue;
    const previousMetrics = metricsFromRow(previousRow, adSet.id, "adset", objective, previous.from);

    decisions.push(
      evaluateDecisionSafely({
        entityType: "adset",
        entityId: adSet.id,
        entityName: adSet.name,
        campaignId: adSet.campaignId,
        campaignName: adSet.campaignName || campaign?.name || adSet.campaignId,
        objective,
        current,
        previous: previousMetrics,
        currentResultsAvailable: Boolean(currentRow && hasPrimaryResult(currentRow, objective)),
        previousResultsAvailable: Boolean(previousRow && hasPrimaryResult(previousRow, objective)),
        startDate: adSet.startDate ?? campaign?.startDate ?? null,
        targetCostPerResult: options?.targetCostPerResult ?? null,
        accountAverageCpc: currentAccountAverageCpc,
      })
    );
  }

  for (const ad of ads) {
    if (ad.status !== "ACTIVE") continue;
    const campaign = campaignById.get(ad.campaignId);
    const objective = ad.campaignObjective ?? campaign?.objective ?? "UNKNOWN";
    const currentRow = currentAdRows.get(ad.id);
    const previousRow = previousAdRows.get(ad.id);
    const current = metricsFromRow(currentRow, ad.id, "ad", objective, range.from);
    if (!hasCurrentActivity(current)) continue;
    const previousMetrics = metricsFromRow(previousRow, ad.id, "ad", objective, previous.from);

    decisions.push(
      evaluateDecisionSafely({
        entityType: "ad",
        entityId: ad.id,
        entityName: ad.name,
        campaignId: ad.campaignId,
        campaignName: ad.campaignName || campaign?.name || ad.campaignId,
        objective,
        current,
        previous: previousMetrics,
        currentResultsAvailable: Boolean(currentRow && hasPrimaryResult(currentRow, objective)),
        previousResultsAvailable: Boolean(previousRow && hasPrimaryResult(previousRow, objective)),
        startDate: ad.startDate ?? campaign?.startDate ?? null,
        targetCostPerResult: options?.targetCostPerResult ?? null,
        accountAverageCpc: currentAccountAverageCpc,
      })
    );
  }

  const sorted = sortDecisions(decisions);
  return {
    accountId,
    currency,
    from: range.from,
    to: range.to,
    generatedAt: new Date().toISOString(),
    summary: summarize(sorted),
    decisions: sorted,
    accountMetrics,
  };
}
