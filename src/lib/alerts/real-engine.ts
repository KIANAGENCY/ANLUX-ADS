import "server-only";
import { fetchRealCampaigns } from "@/lib/meta/real/campaigns";
import { fetchRealAdSets } from "@/lib/meta/real/adsets";
import { fetchAggregatedInsightsByEntity, mapInsightsRowToDailyMetrics } from "@/lib/meta/real/insights";
import type { DateRange, PerformanceAlert, PerformanceMetrics } from "@/lib/types";
import { getPreviousPeriod } from "@/lib/utils/dates";
import { aggregateMetrics } from "@/lib/utils/metrics";
import { applyCampaignRules, applyCostPerResultOutlierRule, pushAlert, sortBySeverity } from "./engine";

/**
 * Evalúa las mismas reglas de negocio que `generateMockAlerts()`, pero
 * exclusivamente sobre datos obtenidos de Meta Marketing API
 * (`lib/meta/real/`) para una cuenta REAL. Server-only: nunca se importa
 * desde un componente/hook cliente.
 *
 * No usa `getMetaAdsService()` en ningún punto. Si Meta no devuelve
 * campañas o ad sets, simplemente no hay alertas que generar — nunca se
 * recurre al dataset simulado como sustituto.
 */
export async function generateRealAlerts(accountId: string, range: DateRange): Promise<PerformanceAlert[]> {
  const alerts: PerformanceAlert[] = [];
  const previousRange = getPreviousPeriod(range);

  const campaigns = await fetchRealCampaigns(accountId);
  const activeCampaigns = campaigns.filter((c) => c.status !== "ARCHIVED");

  if (activeCampaigns.length === 0) return [];

  const [currentInsights, previousInsights] = await Promise.all([
    fetchAggregatedInsightsByEntity(accountId, "campaign", range.from, range.to),
    fetchAggregatedInsightsByEntity(accountId, "campaign", previousRange.from, previousRange.to),
  ]);

  const campaignMetrics: { campaignId: string; name: string; current: PerformanceMetrics }[] = [];

  for (const campaign of activeCampaigns) {
    const currentRow = currentInsights.get(campaign.id);
    const current = aggregateMetrics(
      currentRow ? [mapInsightsRowToDailyMetrics(currentRow, campaign.id, "campaign", campaign.objective, range.from)] : []
    );
    const previousRow = previousInsights.get(campaign.id);
    const previous = aggregateMetrics(
      previousRow
        ? [mapInsightsRowToDailyMetrics(previousRow, campaign.id, "campaign", campaign.objective, previousRange.from)]
        : []
    );
    campaignMetrics.push({ campaignId: campaign.id, name: campaign.name, current });
    applyCampaignRules(alerts, campaign, current, previous);
  }

  applyCostPerResultOutlierRule(alerts, campaignMetrics);

  const [adSets, adSetInsights] = await Promise.all([
    fetchRealAdSets(accountId),
    fetchAggregatedInsightsByEntity(accountId, "adset", range.from, range.to),
  ]);

  for (const adSet of adSets) {
    if (adSet.status !== "ACTIVE") continue;
    const row = adSetInsights.get(adSet.id);
    if (!row) continue;
    const metrics = aggregateMetrics([
      mapInsightsRowToDailyMetrics(row, adSet.id, "adset", adSet.campaignObjective, range.from),
    ]);
    if (metrics.frequency > 3) {
      pushAlert(
        alerts,
        metrics.frequency > 4.5 ? "critical" : "warning",
        "Frecuencia superior a 3",
        `El conjunto "${adSet.name}" alcanzó una frecuencia de ${metrics.frequency.toFixed(1)}: la audiencia está saturada y el rendimiento puede empezar a deteriorarse.`,
        "adset",
        adSet.name,
        "frequency",
        adSet.id
      );
    }
  }

  return sortBySeverity(alerts);
}
