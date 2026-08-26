import { getMetaAdsService } from "@/lib/meta";
import type { AlertSeverity, DateRange, PerformanceAlert, PerformanceMetrics } from "@/lib/types";
import { getPreviousPeriod } from "@/lib/utils/dates";
import { aggregateMetrics, combineAccountMetrics } from "@/lib/utils/metrics";
import { FREQUENCY_HOTSPOT_ADSETS } from "@/lib/mock/metrics-generator";

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

/**
 * Evalúa un conjunto fijo de reglas de negocio sobre las campañas de un
 * cliente y genera alertas de performance. Pensado para poder ampliarse
 * fácilmente con nuevas reglas sin tocar la UI (`app/(dashboard)/alerts`
 * simplemente renderiza lo que esta función devuelva).
 */
export async function generateAlerts(clientId: string, range: DateRange): Promise<PerformanceAlert[]> {
  const service = getMetaAdsService();
  const alerts: PerformanceAlert[] = [];
  const previousRange = getPreviousPeriod(range);

  const campaigns = await service.getCampaigns(clientId);
  const activeCampaigns = campaigns.filter((c) => c.status !== "ARCHIVED");

  const campaignMetrics: { campaignId: string; name: string; current: PerformanceMetrics }[] = [];

  for (const campaign of activeCampaigns) {
    const [currentRows, previousRows] = await Promise.all([
      service.getDailyMetrics("campaign", campaign.id, range),
      service.getDailyMetrics("campaign", campaign.id, previousRange),
    ]);
    const current = aggregateMetrics(currentRows);
    const previous = aggregateMetrics(previousRows);
    campaignMetrics.push({ campaignId: campaign.id, name: campaign.name, current });

    // Regla: CTR cayó más de 20%
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

    // Regla: CPC aumentó más de 25%
    if (previous.cpc > 0 && current.cpc > 0) {
      const cpcChange = ((current.cpc - previous.cpc) / previous.cpc) * 100;
      if (cpcChange >= 50) {
        pushAlert(
          alerts,
          "critical",
          "CPC disparado",
          `El CPC de "${campaign.name}" subió ${cpcChange.toFixed(1)}% (${previous.cpc.toFixed(2)} → $${current.cpc.toFixed(2)}).`,
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

    // Regla: campaña con gasto pero sin resultados
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

  // Regla: costo por resultado muy por encima del promedio de la cuenta
  const withResults = campaignMetrics.filter((c) => c.current.results > 0);
  if (withResults.length > 1) {
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

  // Regla: frecuencia superior a 3 (ad sets con audiencia saturada)
  const adSets = await service.getAdSets(clientId);
  for (const adSet of adSets) {
    if (adSet.status !== "ACTIVE") continue;
    const rows = await service.getDailyMetrics("adset", adSet.id, range);
    const metrics = aggregateMetrics(rows);
    if (metrics.frequency > 3) {
      pushAlert(
        alerts,
        FREQUENCY_HOTSPOT_ADSETS.has(adSet.id) ? "critical" : "warning",
        "Frecuencia superior a 3",
        `El conjunto "${adSet.name}" alcanzó una frecuencia de ${metrics.frequency.toFixed(1)}: la audiencia está saturada y el rendimiento puede empezar a deteriorarse.`,
        "adset",
        adSet.name,
        "frequency",
        adSet.id
      );
    }
  }

  const severityWeight: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => severityWeight[a.severity] - severityWeight[b.severity]);
}
