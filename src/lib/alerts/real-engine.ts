import "server-only";
import { fetchRealCampaigns } from "@/lib/meta/real/campaigns";
import { fetchRealAdSets } from "@/lib/meta/real/adsets";
import { fetchAggregatedInsightsByEntity, mapInsightsRowToDailyMetrics } from "@/lib/meta/real/insights";
import type { AlertSeverity, Campaign, DateRange, PerformanceAlert, PerformanceMetrics } from "@/lib/types";
import { getPreviousPeriod } from "@/lib/utils/dates";
import { aggregateMetrics, combineAccountMetrics } from "@/lib/utils/metrics";

let alertIdCounter = 0;
function nextId(): string {
  alertIdCounter += 1;
  return `alert_${alertIdCounter}`;
}

function pushAlert(
  alerts: PerformanceAlert[],
  severity: AlertSeverity,
  title: string,
  description: string,
  entityType: PerformanceAlert["entityType"],
  entityName: string,
  metric?: PerformanceAlert["metric"],
  entityId?: string
) {
  alerts.push({
    id: nextId(),
    severity,
    title,
    description,
    entityType,
    entityId,
    entityName,
    metric,
    createdAt: new Date().toISOString(),
  });
}

/** Reglas de negocio sobre campañas: CTR, CPC, gasto sin resultados. */
function applyCampaignRules(
  alerts: PerformanceAlert[],
  campaign: Pick<Campaign, "id" | "name" | "objective">,
  current: PerformanceMetrics,
  previous: PerformanceMetrics
) {
  if (previous.ctr > 0 && current.ctr > 0) {
    const ctrChange = ((current.ctr - previous.ctr) / previous.ctr) * 100;
    if (ctrChange <= -35) {
      pushAlert(
        alerts,
        "critical",
        "Caída fuerte de CTR",
        `El CTR de "${campaign.name}" cayó ${Math.abs(ctrChange).toFixed(1)}% frente al periodo anterior (${previous.ctr.toFixed(2)}% → ${current.ctr.toFixed(2)}%).`,
        "campaign",
        campaign.name,
        "ctr",
        campaign.id
      );
    } else if (ctrChange <= -20) {
      pushAlert(
        alerts,
        "warning",
        "CTR cayó más de 20%",
        `El CTR de "${campaign.name}" bajó ${Math.abs(ctrChange).toFixed(1)}% respecto al periodo anterior.`,
        "campaign",
        campaign.name,
        "ctr",
        campaign.id
      );
    }
  }

  if (previous.cpc > 0 && current.cpc > 0) {
    const cpcChange = ((current.cpc - previous.cpc) / previous.cpc) * 100;
    if (cpcChange >= 50) {
      pushAlert(
        alerts,
        "critical",
        "CPC disparado",
        `El CPC de "${campaign.name}" subió ${cpcChange.toFixed(1)}% ($${previous.cpc.toFixed(2)} → $${current.cpc.toFixed(2)}).`,
        "campaign",
        campaign.name,
        "cpc",
        campaign.id
      );
    } else if (cpcChange >= 25) {
      pushAlert(
        alerts,
        "warning",
        "CPC aumentó más de 25%",
        `El CPC de "${campaign.name}" subió ${cpcChange.toFixed(1)}% respecto al periodo anterior.`,
        "campaign",
        campaign.name,
        "cpc",
        campaign.id
      );
    }
  }

  if (current.spend > 5 && current.results === 0 && campaign.objective !== "BRAND_AWARENESS") {
    pushAlert(
      alerts,
      "critical",
      "Gasto sin resultados",
      `"${campaign.name}" invirtió $${current.spend.toFixed(2)} en el periodo sin generar ningún resultado.`,
      "campaign",
      campaign.name,
      "results",
      campaign.id
    );
  } else if (current.spend > 5 && current.results === 0 && campaign.objective === "BRAND_AWARENESS") {
    pushAlert(
      alerts,
      "info",
      "Campaña de reconocimiento sin conversiones",
      `"${campaign.name}" es una campaña de awareness: genera alcance pero no está optimizada para resultados directos.`,
      "campaign",
      campaign.name,
      "results",
      campaign.id
    );
  }
}

/** Regla de negocio sobre el conjunto de campañas: costo por resultado muy por encima del promedio de cuenta. */
function applyCostPerResultOutlierRule(
  alerts: PerformanceAlert[],
  campaignMetrics: { campaignId: string; name: string; current: PerformanceMetrics }[]
) {
  const withResults = campaignMetrics.filter((c) => c.current.results > 0);
  if (withResults.length <= 1) return;

  const account = combineAccountMetrics(withResults.map((c) => c.current));
  for (const { campaignId, name, current } of withResults) {
    if (account.costPerResult > 0 && current.costPerResult >= account.costPerResult * 1.6) {
      const timesAvg = current.costPerResult / account.costPerResult;
      pushAlert(
        alerts,
        "warning",
        "Costo por resultado muy por encima del promedio",
        `"${name}" tiene un costo por resultado de $${current.costPerResult.toFixed(2)}, ${timesAvg.toFixed(1)}x el promedio de la cuenta ($${account.costPerResult.toFixed(2)}).`,
        "campaign",
        name,
        "costPerResult",
        campaignId
      );
    }
  }
}

function sortBySeverity(alerts: PerformanceAlert[]): PerformanceAlert[] {
  const severityWeight: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => severityWeight[a.severity] - severityWeight[b.severity]);
}

/**
 * Evalúa las reglas de negocio de performance (CTR, CPC, gasto sin
 * resultados, costo por resultado fuera de rango, frecuencia) exclusivamente
 * sobre datos obtenidos de Meta Marketing API (`lib/meta/real/`).
 * Server-only: nunca se importa desde un componente/hook cliente.
 *
 * Si Meta no devuelve campañas o ad sets, simplemente no hay alertas que
 * generar: la lista vuelve vacía y la UI muestra su estado vacío.
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
