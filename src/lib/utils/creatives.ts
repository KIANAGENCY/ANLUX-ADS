import type { AdWithMetrics } from "@/hooks/use-ads";

export type WinnerTag = "Mejor CTR" | "Menor CPC" | "Más resultados" | "Mejor costo por resultado";

export interface CreativeWinner {
  ad: AdWithMetrics;
  tags: WinnerTag[];
}

/**
 * Identifica los anuncios "ganadores" del periodo según cuatro criterios
 * independientes. Un mismo anuncio puede acumular varias etiquetas si
 * destaca en más de una métrica.
 */
export function computeCreativeWinners(ads: AdWithMetrics[]): CreativeWinner[] {
  const withImpressions = ads.filter((a) => a.metrics.impressions > 0);
  if (withImpressions.length === 0) return [];

  const withClicks = withImpressions.filter((a) => a.metrics.clicks > 0);
  const withResults = withImpressions.filter((a) => a.metrics.results > 0);

  const bestCtr = maxBy(withImpressions, (a) => a.metrics.ctr);
  const bestCpc = minBy(withClicks, (a) => a.metrics.cpc);
  const mostResults = maxBy(withResults, (a) => a.metrics.results);
  const bestCostPerResult = minBy(withResults, (a) => a.metrics.costPerResult);

  const tagsByAdId = new Map<string, WinnerTag[]>();
  const addTag = (ad: AdWithMetrics | undefined, tag: WinnerTag) => {
    if (!ad) return;
    const existing = tagsByAdId.get(ad.id) ?? [];
    tagsByAdId.set(ad.id, [...existing, tag]);
  };

  addTag(bestCtr, "Mejor CTR");
  addTag(bestCpc, "Menor CPC");
  addTag(mostResults, "Más resultados");
  addTag(bestCostPerResult, "Mejor costo por resultado");

  return Array.from(tagsByAdId.entries())
    .map(([adId, tags]) => ({ ad: ads.find((a) => a.id === adId)!, tags }))
    .sort((a, b) => b.tags.length - a.tags.length);
}

function maxBy<T>(items: T[], selector: (item: T) => number): T | undefined {
  return items.reduce<T | undefined>((best, item) => (!best || selector(item) > selector(best) ? item : best), undefined);
}

function minBy<T>(items: T[], selector: (item: T) => number): T | undefined {
  return items.reduce<T | undefined>((best, item) => (!best || selector(item) < selector(best) ? item : best), undefined);
}
