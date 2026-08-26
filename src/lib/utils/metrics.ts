import type { DailyMetrics, MetricComparison, MetricKey, PerformanceMetrics } from "@/lib/types";

/** Agrega una lista de filas diarias en un único objeto PerformanceMetrics. */
export function aggregateMetrics(rows: DailyMetrics[]): PerformanceMetrics {
  const totals = rows.reduce(
    (acc, row) => {
      acc.spend += row.spend;
      acc.impressions += row.impressions;
      acc.reach += row.reach;
      acc.clicks += row.clicks;
      acc.results += row.results;
      return acc;
    },
    { spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0 }
  );

  return {
    spend: totals.spend,
    impressions: totals.impressions,
    reach: totals.reach,
    clicks: totals.clicks,
    results: totals.results,
    frequency: totals.reach > 0 ? totals.impressions / totals.reach : 0,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    costPerResult: totals.results > 0 ? totals.spend / totals.results : 0,
  };
}

/**
 * `reach` no es aditivo entre entidades (personas se solapan), así que al
 * agregar varias entidades usamos un factor de deduplicación aproximado en
 * vez de sumarlo tal cual. Se usa únicamente para vistas "resumen de cuenta".
 */
export function combineAccountMetrics(perCampaign: PerformanceMetrics[]): PerformanceMetrics {
  const totals = perCampaign.reduce(
    (acc, m) => {
      acc.spend += m.spend;
      acc.impressions += m.impressions;
      acc.reach += m.reach * 0.85; // aproximación de solapamiento de audiencias
      acc.clicks += m.clicks;
      acc.results += m.results;
      return acc;
    },
    { spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0 }
  );

  return {
    spend: totals.spend,
    impressions: totals.impressions,
    reach: totals.reach,
    clicks: totals.clicks,
    results: totals.results,
    frequency: totals.reach > 0 ? totals.impressions / totals.reach : 0,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    costPerResult: totals.results > 0 ? totals.spend / totals.results : 0,
  };
}

const METRIC_KEYS: MetricKey[] = [
  "spend",
  "reach",
  "impressions",
  "clicks",
  "results",
  "frequency",
  "cpm",
  "ctr",
  "cpc",
  "costPerResult",
];

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / previous) * 100;
}

export function compareMetrics(
  current: PerformanceMetrics,
  previous: PerformanceMetrics
): MetricComparison {
  const changePercent = METRIC_KEYS.reduce((acc, key) => {
    acc[key] = percentChange(current[key], previous[key]);
    return acc;
  }, {} as Record<MetricKey, number | null>);

  return { current, previous, changePercent };
}

/**
 * Para cada métrica, indica si "subir" es una señal positiva o negativa.
 * Se usa para colorear correctamente los indicadores de variación: un CPC
 * al alza es una mala noticia aunque el número sea "más grande".
 */
export const METRIC_DIRECTION: Record<MetricKey, "up-is-good" | "down-is-good" | "neutral"> = {
  spend: "neutral",
  reach: "up-is-good",
  impressions: "neutral",
  clicks: "up-is-good",
  results: "up-is-good",
  frequency: "down-is-good",
  cpm: "down-is-good",
  ctr: "up-is-good",
  cpc: "down-is-good",
  costPerResult: "down-is-good",
};

/** Devuelve si una variación porcentual concreta debe pintarse como positiva o negativa. */
export function isChangePositive(metric: MetricKey, changePercent: number | null): boolean | null {
  if (changePercent === null || changePercent === 0) return null;
  const direction = METRIC_DIRECTION[metric];
  if (direction === "neutral") return null;
  const rising = changePercent > 0;
  return direction === "up-is-good" ? rising : !rising;
}

export const METRIC_LABELS: Record<MetricKey, string> = {
  spend: "Inversión",
  reach: "Alcance",
  impressions: "Impresiones",
  clicks: "Clics",
  results: "Resultados",
  frequency: "Frecuencia",
  cpm: "CPM",
  ctr: "CTR",
  cpc: "CPC",
  costPerResult: "Costo por resultado",
};
