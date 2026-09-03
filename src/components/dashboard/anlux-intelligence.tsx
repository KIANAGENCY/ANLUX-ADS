"use client";

import { ArrowRight, ListChecks, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAIDrawer } from "@/components/ai/ai-drawer";

const PRIORITY_CONFIG = {
  low: { label: "Prioridad baja", variant: "neutral" as const },
  medium: { label: "Prioridad media", variant: "warning" as const },
  high: { label: "Prioridad alta", variant: "negative" as const },
};

/**
 * Card protagonista del Overview. No genera ni almacena análisis por su
 * cuenta: refleja el último `AIAnalysis` devuelto por `/api/ai/analyze` a
 * través del contexto compartido del AI Analyst.
 *
 * Sin análisis generado → estado vacío. Nunca muestra conclusiones,
 * porcentajes ni recomendaciones que no vengan de la respuesta real.
 */
export function AnluxIntelligence() {
  const { lastAnalysis, loading, open } = useAIDrawer();

  return (
    <section className="relative overflow-hidden rounded-xl border border-border-subtle bg-[linear-gradient(120deg,var(--surface)_0%,var(--surface)_55%,#120F22_100%)] px-5 py-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 items-center justify-center rounded-lg border border-accent-ai/30 bg-accent-ai/15">
          <Sparkles className="size-4 text-accent-ai" />
        </span>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">ANLUX Intelligence</h2>
        {lastAnalysis && (
          <Badge variant={PRIORITY_CONFIG[lastAnalysis.priority].variant}>
            {PRIORITY_CONFIG[lastAnalysis.priority].label}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2.5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-accent-ai" />
          Generando análisis del periodo seleccionado…
        </div>
      ) : lastAnalysis ? (
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div>
            <p className="max-w-[62ch] text-[17px] leading-snug font-semibold tracking-tight text-foreground">
              {lastAnalysis.summary}
            </p>
            <button
              type="button"
              onClick={open}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-2"
            >
              Ver análisis completo
              <ArrowRight className="size-3.5" />
            </button>
          </div>

          {lastAnalysis.recommendations.length > 0 && (
            <div className="rounded-lg border border-border-subtle bg-background/40 p-4">
              <div className="flex items-center gap-2">
                <ListChecks className="size-3.5 text-accent-light" />
                <p className="text-xs font-semibold text-foreground">Acciones recomendadas</p>
                <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-muted-foreground-2 uppercase">
                  Informativo
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground-2">
                ANLUX no ejecuta cambios en Meta. Estas recomendaciones se aplican manualmente en el
                Administrador de anuncios.
              </p>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
                {lastAnalysis.recommendations.map((recommendation, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground-2">·</span>
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-border-subtle px-5 py-7 text-center">
          <p className="text-sm font-medium text-foreground">Aún no hay análisis para este periodo</p>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-xs text-muted-foreground-2">
            Genera un análisis para obtener recomendaciones basadas en las métricas del rango seleccionado.
          </p>
          <button
            type="button"
            onClick={open}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-2"
          >
            <Sparkles className="size-3.5" />
            Generar análisis
          </button>
        </div>
      )}
    </section>
  );
}
