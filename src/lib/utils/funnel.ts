import type { PerformanceMetrics } from "@/lib/types";

export interface FunnelStage {
  label: string;
  value: number;
  /** % respecto a la etapa anterior. `null` en la primera etapa. */
  conversionFromPrevious: number | null;
}

/**
 * Deriva las etapas del funnel (Impresiones → Clics → Resultados) a partir de
 * las métricas reales agregadas de Meta. "Resultados" en Meta ya representa el
 * objetivo de la campaña (leads, mensajes, compras...), así que es la última
 * etapa real disponible: no se deriva ninguna etapa adicional que Meta no
 * reporte.
 */
export function buildFunnelStages(metrics: PerformanceMetrics): FunnelStage[] {
  const rawStages = [
    { label: "Impresiones", value: metrics.impressions },
    { label: "Clics", value: metrics.clicks },
    { label: "Resultados", value: metrics.results },
  ];

  return rawStages.map((stage, index) => ({
    ...stage,
    conversionFromPrevious:
      index === 0 || rawStages[index - 1].value === 0
        ? null
        : (stage.value / rawStages[index - 1].value) * 100,
  }));
}
