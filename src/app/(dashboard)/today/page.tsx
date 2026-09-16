"use client";

import Link from "next/link";
import { CircleAlert, CircleCheck, CircleHelp, CircleStop, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { useDecisions } from "@/hooks/use-decisions";
import type { DecisionAction } from "@/lib/decisions/types";

const PRESENTATION: Record<DecisionAction, { label: string; className: string; Icon: typeof CircleCheck }> = {
  SCALE: { label: "VA BIEN", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", Icon: CircleCheck },
  MAINTAIN: { label: "VA BIEN", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", Icon: CircleCheck },
  WATCH: { label: "NECESITA CAMBIO", className: "border-amber-500/30 bg-amber-500/10 text-amber-200", Icon: CircleAlert },
  REDUCE: { label: "NECESITA CAMBIO", className: "border-amber-500/30 bg-amber-500/10 text-amber-200", Icon: CircleAlert },
  REFRESH_CREATIVE: { label: "NECESITA CAMBIO", className: "border-amber-500/30 bg-amber-500/10 text-amber-200", Icon: CircleAlert },
  REVIEW_AUDIENCE: { label: "NECESITA CAMBIO", className: "border-amber-500/30 bg-amber-500/10 text-amber-200", Icon: CircleAlert },
  PAUSE_CANDIDATE: { label: "PARAR", className: "border-rose-500/30 bg-rose-500/10 text-rose-200", Icon: CircleStop },
  INSUFFICIENT_DATA: { label: "AÚN NO SÉ", className: "border-slate-500/30 bg-slate-500/10 text-slate-200", Icon: CircleHelp },
};

export default function TodayPage() {
  const { loading, result, error } = useDecisions();
  const campaigns = result?.decisions.filter((decision) => decision.entityType === "campaign") ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <header className="px-1 pt-1">
        <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground-2 uppercase">Brief del día</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">¿Qué necesita tu atención hoy?</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Recomendaciones basadas exclusivamente en los datos reales disponibles.</p>
      </header>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-44 w-full rounded-2xl" />)}</div>
      ) : !result || campaigns.length === 0 ? (
        <EmptyState icon={CircleHelp} title="Aún no sé qué recomendar" description="No hay campañas activas con información suficiente para emitir una recomendación responsable." />
      ) : (
        <section className="space-y-3" aria-label="Recomendaciones por campaña">
          {campaigns.map((decision) => {
            const state = PRESENTATION[decision.action];
            const Icon = state.Icon;
            return (
              <article key={decision.id} className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 text-lg font-semibold leading-snug text-foreground">{decision.entityName}</h2>
                  <span className={"inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide " + state.className}>
                    <Icon className="size-3.5" aria-hidden />{state.label}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{decision.rationale}</p>
                <Link href="/decisions" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-accent-light hover:bg-surface-2">
                  Ver detalle <ChevronRight className="size-4" aria-hidden />
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
