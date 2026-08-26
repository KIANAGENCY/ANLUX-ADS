import type { AIAnalysis, AIAnalysisPriority } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import type { AIAnalysisRequest, IAIAnalystService } from "./types";

function pct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function bestAdBy(
  request: AIAnalysisRequest,
  compare: (a: [string, number], b: [string, number]) => number,
  metric: (id: string) => number
) {
  const entries = request.ads
    .filter((ad) => (request.adMetrics[ad.id]?.impressions ?? 0) > 0)
    .map((ad) => [ad.id, metric(ad.id)] as [string, number]);
  if (entries.length === 0) return undefined;
  const [bestId] = entries.sort(compare)[0];
  return request.ads.find((a) => a.id === bestId);
}

/**
 * Genera un análisis simulado a partir de los datos mock reales de la cuenta.
 * No usa ningún LLM: aplica reglas simples sobre las métricas para producir
 * un resultado creíble y consistente con lo que el usuario ve en el dashboard.
 *
 * Esta clase implementa el mismo contrato (`IAIAnalystService`) que usará la
 * futura integración con Claude, así que sustituirla es un cambio aislado en
 * `lib/ai/index.ts` — ver ese archivo para el criterio de selección.
 */
export class MockAIAnalystService implements IAIAnalystService {
  async analyze(request: AIAnalysisRequest): Promise<AIAnalysis> {
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 400));

    const { currentMetrics: cur, previousMetrics: prev } = request;
    const spendChange = pct(cur.spend, prev.spend);
    const resultsChange = pct(cur.results, prev.results);
    const cprChange = pct(cur.costPerResult, prev.costPerResult);
    const ctrChange = pct(cur.ctr, prev.ctr);

    const issues: string[] = [];
    const opportunities: string[] = [];
    const recommendations: string[] = [];

    const zeroResultCampaigns = request.campaigns.filter((c) => {
      const m = request.campaignMetrics[c.id];
      return m && m.spend > 5 && m.results === 0 && c.objective !== "BRAND_AWARENESS";
    });
    const wastedSpend = zeroResultCampaigns.reduce(
      (sum, c) => sum + (request.campaignMetrics[c.id]?.spend ?? 0),
      0
    );

    if (zeroResultCampaigns.length > 0) {
      issues.push(
        `${zeroResultCampaigns.length} campaña(s) con gasto sin resultados: ${zeroResultCampaigns
          .map((c) => `"${c.name}"`)
          .join(", ")} — ${formatCurrency(wastedSpend)} invertidos sin generar leads/conversiones.`
      );
      recommendations.push(
        `Pausar o reestructurar ${zeroResultCampaigns.length === 1 ? "la campaña" : "las campañas"} sin resultados y redirigir ese presupuesto (${formatCurrency(wastedSpend)}) hacia las campañas con mejor costo por resultado.`
      );
    }

    const highCPR = request.campaigns
      .map((c) => ({ c, m: request.campaignMetrics[c.id] }))
      .filter(({ m }) => m && m.results > 0 && m.costPerResult > cur.costPerResult * 1.5);
    if (highCPR.length > 0) {
      issues.push(
        `${highCPR.map(({ c }) => `"${c.name}"`).join(", ")} tiene un costo por resultado muy por encima del promedio de la cuenta.`
      );
    }

    if (cprChange !== null && cprChange > 15) {
      issues.push(
        `El costo por resultado subió ${formatPercent(cprChange, 1)} frente al periodo anterior (${formatCurrency(prev.costPerResult)} → ${formatCurrency(cur.costPerResult)}).`
      );
    } else if (cprChange !== null && cprChange < -10) {
      opportunities.push(
        `El costo por resultado mejoró ${formatPercent(Math.abs(cprChange), 1)} frente al periodo anterior: buen momento para escalar presupuesto.`
      );
    }

    if (ctrChange !== null && ctrChange < -20) {
      issues.push(
        `El CTR general cayó ${formatPercent(Math.abs(ctrChange), 1)}: puede indicar fatiga de creativos.`
      );
      recommendations.push("Renovar los creativos con más tiempo en circulación para combatir la fatiga de audiencia.");
    }

    const bestByResults = bestAdBy(
      request,
      (a, b) => b[1] - a[1],
      (id) => request.adMetrics[id]?.results ?? 0
    );
    const bestByCPR = bestAdBy(
      request,
      (a, b) => a[1] - b[1],
      (id) => request.adMetrics[id]?.costPerResult || Infinity
    );

    if (bestByCPR) {
      const m = request.adMetrics[bestByCPR.id];
      opportunities.push(
        `El anuncio "${bestByCPR.name}" tiene el mejor costo por resultado (${formatCurrency(m.costPerResult)}). Es un buen candidato para recibir más presupuesto.`
      );
      recommendations.push(`Aumentar el presupuesto del conjunto que contiene "${bestByCPR.name}" de forma gradual (10-20% cada 3-4 días) para no reiniciar el aprendizaje del algoritmo.`);
    }

    if (opportunities.length === 0) {
      opportunities.push("El rendimiento general se mantiene estable respecto al periodo anterior.");
    }
    if (recommendations.length === 0) {
      recommendations.push("Mantener la configuración actual y seguir monitoreando frecuencia y costo por resultado.");
    }

    const priority: AIAnalysisPriority =
      issues.length >= 2 || wastedSpend > cur.spend * 0.15 ? "high" : issues.length === 1 ? "medium" : "low";

    const summary = buildSummary(request, { spendChange, resultsChange, cprChange, bestByResults });

    return {
      summary,
      issues,
      opportunities,
      recommendations,
      priority,
      generatedAt: new Date().toISOString(),
    };
  }
}

function buildSummary(
  request: AIAnalysisRequest,
  deltas: {
    spendChange: number | null;
    resultsChange: number | null;
    cprChange: number | null;
    bestByResults: ReturnType<typeof bestAdBy>;
  }
): string {
  const { client, currentMetrics: cur } = request;
  const q = (request.question ?? "").toLowerCase();

  const base = `Analicé la cuenta de ${client.name} del ${request.dateRange.from} al ${request.dateRange.to}: se invirtieron ${formatCurrency(cur.spend)} generando ${Math.round(cur.results)} resultados a un costo por resultado de ${formatCurrency(cur.costPerResult)}.`;

  if (q.includes("mejor anuncio")) {
    if (deltas.bestByResults) {
      const m = request.adMetrics[deltas.bestByResults.id];
      return `Tu mejor anuncio en este periodo es "${deltas.bestByResults.name}", con ${Math.round(m.results)} resultados a ${formatCurrency(m.costPerResult)} por resultado y un CTR de ${formatPercent(m.ctr)}.`;
    }
    return `${base} No hay suficientes datos de anuncios individuales en este periodo para identificar un ganador claro.`;
  }

  if (q.includes("desperdiciando") || q.includes("desperdicio")) {
    return `${base} Revisé el gasto sin retorno campaña por campaña — los detalles están en "Problemas detectados".`;
  }

  if (q.includes("compara")) {
    const spendTxt = deltas.spendChange === null ? "sin datos comparables" : formatPercent(deltas.spendChange, 1);
    const resultsTxt = deltas.resultsChange === null ? "sin datos comparables" : formatPercent(deltas.resultsChange, 1);
    return `Comparando con el periodo anterior: la inversión varió ${spendTxt} y los resultados variaron ${resultsTxt}. ${base}`;
  }

  if (q.includes("optimizar")) {
    return `${base} La prioridad de optimización está detallada en "Recomendaciones", ordenada por impacto esperado.`;
  }

  return base;
}
