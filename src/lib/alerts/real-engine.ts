import "server-only";
import { fetchAdAccounts } from "@/lib/meta/real/accounts";
import { fetchRealCampaigns } from "@/lib/meta/real/campaigns";
import { fetchRealAdSets } from "@/lib/meta/real/adsets";
import { fetchAggregatedInsightsByEntity, mapInsightsRowToDailyMetrics } from "@/lib/meta/real/insights";
import type { AdSet, AlertSeverity, Campaign, DateRange, PerformanceAlert, PerformanceMetrics } from "@/lib/types";
import { getPreviousPeriod } from "@/lib/utils/dates";
import { formatCurrency } from "@/lib/utils/format";
import { aggregateMetrics } from "@/lib/utils/metrics";

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

/** Reglas de negocio sobre campañas: CTR, CPC y gasto sin resultados cuando el objetivo es conocido. */
function applyCampaignRules(
  alerts: PerformanceAlert[],
  campaign: Pick<Campaign, "id" | "name" | "objective">,
  current: PerformanceMetrics,
  previous: PerformanceMetrics,
  currency: string | null
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
        `El CPC de "${campaign.name}" subió ${cpcChange.toFixed(1)}% (${formatCurrency(previous.cpc, currency)} → ${formatCurrency(current.cpc, currency)}).`,
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

  // Con objetivo UNKNOWN no podemos saber qué action_type representa el resultado,
  // así que una ausencia de "results" no demuestra que haya gasto sin resultado.
  const canEvaluateResults = campaign.objective !== "UNKNOWN";
  if (
    canEvaluateResults &&
    current.spend > 5 &&
    current.results === 0 &&
    campaign.objective !== "BRAND_AWARENESS"
  ) {
    pushAlert(
      alerts,
      "critical",
      "Gasto sin resultados",
      `"${campaign.name}" invirtió ${formatCurrency(current.spend, currency)} en el periodo sin generar ningún resultado.`,
      "campaign",
      campaign.name,
      "results",
      campaign.id
    );
  } else if (
    canEvaluateResults &&
    current.spend > 5 &&
    current.results === 0 &&
    campaign.objective === "BRAND_AWARENESS"
  ) {
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

/** Regla sobre costo por resultado. Solo usa gasto/resultados, ambas métricas aditivas. */
function applyCostPerResultOutlierRule(
  alerts: PerformanceAlert[],
  campaignMetrics: { campaignId: string; name: string; current: PerformanceMetrics }[],
  currency: string | null
) {
  const withResults = campaignMetrics.filter((c) => c.current.results > 0);
  if (withResults.length <= 1) return;

  const totals = withResults.reduce(
    (acc, item) => {
      acc.spend += item.current.spend;
      acc.results += item.current.results;
      return acc;
    },
    { spend: 0, results: 0 }
  );
  const accountCostPerResult = totals.results > 0 ? totals.spend / totals.results : 0;

  for (const { campaignId, name, current } of withResults) {
    if (accountCostPerResult > 0 && current.costPerResult >= accountCostPerResult * 1.6) {
      const timesAvg = current.costPerResult / accountCostPerResult;
      pushAlert(
        alerts,
        "warning",
        "Costo por resultado muy por encima del promedio",
        `"${name}" tiene un costo por resultado de ${formatCurrency(current.costPerResult, currency)}, ${timesAvg.toFixed(1)}x el promedio de la cuenta (${formatCurrency(accountCostPerResult, currency)}).`,
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

export interface RealAlertEvaluationInput {
  campaigns: Campaign[];
  currentCampaignMetrics: Record<string, PerformanceMetrics>;
  previousCampaignMetrics: Record<string, PerformanceMetrics>;
  adSets: AdSet[];
  adSetMetrics: Record<string, PerformanceMetrics>;
  currency: string | null;
}

/** Motor puro de alertas sobre datos ya obtenidos de Meta. */
export function buildRealAlertsFromMetrics(input: RealAlertEvaluationInput): PerformanceAlert[] {
  const alerts: PerformanceAlert[] = [];
  const activeCampaigns = input.campaigns.filter((c) => c.status !== "ARCHIVED");
  const campaignMetrics: { campaignId: string; name: string; current: PerformanceMetrics }[] = [];

  for (const campaign of activeCampaigns) {
    const current = input.currentCampaignMetrics[campaign.id] ?? aggregateMetrics([]);
    const previous = input.previousCampaignMetrics[campaign.id] ?? aggregateMetrics([]);
    campaignMetrics.push({ campaignId: campaign.id, name: campaign.name, current });
    applyCampaignRules(alerts, campaign, current, previous, input.currency);
  }

  applyCostPerResultOutlierRule(alerts, campaignMetrics, input.currency);

  for (const adSet of input.adSets) {
    if (adSet.status !== "ACTIVE") continue;
    const metrics = input.adSetMetrics[adSet.id];
    if (!metrics) continue;
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

/**
 * Evalúa las reglas de negocio exclusivamente sobre datos obtenidos de Meta.
 * El AI Analyst reutiliza el motor puro para evitar repetir llamadas a Graph API.
 */
export async function generateRealAlerts(accountId: string, range: DateRange): Promise<PerformanceAlert[]> {
  const previousRange = getPreviousPeriod(range);

  const [campaigns, accounts] = await Promise.all([fetchRealCampaigns(accountId), fetchAdAccounts()]);
  const currency = accounts.find((account) => account.id === accountId)?.currency ?? null;
  const activeCampaigns = campaigns.filter((c) => c.status !== "ARCHIVED");

  if (activeCampaigns.length === 0) return [];

  const [currentInsights, previousInsights, adSets, adSetInsights] = await Promise.all([
    fetchAggregatedInsightsByEntity(accountId, "campaign", range.from, range.to),
    fetchAggregatedInsightsByEntity(accountId, "campaign", previousRange.from, previousRange.to),
    fetchRealAdSets(accountId),
    fetchAggregatedInsightsByEntity(accountId, "adset", range.from, range.to),
  ]);

  const currentCampaignMetrics: Record<string, PerformanceMetrics> = {};
  const previousCampaignMetrics: Record<string, PerformanceMetrics> = {};

  for (const campaign of activeCampaigns) {
    const currentRow = currentInsights.get(campaign.id);
    currentCampaignMetrics[campaign.id] = aggregateMetrics(
      currentRow ? [mapInsightsRowToDailyMetrics(currentRow, campaign.id, "campaign", campaign.objective, range.from)] : []
    );

    const previousRow = previousInsights.get(campaign.id);
    previousCampaignMetrics[campaign.id] = aggregateMetrics(
      previousRow
        ? [mapInsightsRowToDailyMetrics(previousRow, campaign.id, "campaign", campaign.objective, previousRange.from)]
        : []
    );
  }

  const adSetMetrics: Record<string, PerformanceMetrics> = {};
  for (const adSet of adSets) {
    const row = adSetInsights.get(adSet.id);
    if (!row) continue;
    adSetMetrics[adSet.id] = aggregateMetrics([
      mapInsightsRowToDailyMetrics(row, adSet.id, "adset", adSet.campaignObjective, range.from),
    ]);
  }

  return buildRealAlertsFromMetrics({
    campaigns: activeCampaigns,
    currentCampaignMetrics,
    previousCampaignMetrics,
    adSets,
    adSetMetrics,
    currency,
  });
}
