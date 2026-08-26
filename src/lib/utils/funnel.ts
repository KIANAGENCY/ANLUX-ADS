import type { PerformanceMetrics } from "@/lib/types";
import { createRng, hashStringToSeed, randomBetween } from "@/lib/mock/random";

export interface FunnelStage {
  label: string;
  value: number;
  /** % respecto a la etapa anterior. `null` en la primera etapa. */
  conversionFromPrevious: number | null;
}

/**
 * Deriva las 4 etapas del funnel (Impresiones → Clics → Conversaciones/Leads
 * → Resultados) a partir de las métricas agregadas. "Resultados" en Meta ya
 * representa el objetivo de la campaña (leads, mensajes, compras...), así
 * que aquí lo tratamos como el subconjunto de conversaciones que efectivamente
 * se cierran/califican, usando una tasa de cierre estable por cliente.
 */
export function buildFunnelStages(metrics: PerformanceMetrics, seedKey: string): FunnelStage[] {
  const rng = createRng(hashStringToSeed(`funnel:${seedKey}`));
  const closeRate = randomBetween(rng, 0.62, 0.82);

  const rawStages = [
    { label: "Impresiones", value: metrics.impressions },
    { label: "Clics", value: metrics.clicks },
    { label: "Conversaciones / Leads", value: metrics.results },
    { label: "Resultados", value: Math.round(metrics.results * closeRate) },
  ];

  return rawStages.map((stage, index) => ({
    ...stage,
    conversionFromPrevious:
      index === 0 || rawStages[index - 1].value === 0
        ? null
        : (stage.value / rawStages[index - 1].value) * 100,
  }));
}
