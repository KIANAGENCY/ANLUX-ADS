"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, CircleHelp, CircleStop, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntelligence } from "@/hooks/use-intelligence";
import { useFilters } from "@/components/providers/filters-provider";
import type { DecisionAction, PerformanceDecision } from "@/lib/decisions/types";

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

const HOME_FORBIDDEN_TERMS = /\b(CTR|CPM|CPC|frecuencia|alcance|impresiones|ROAS)\b/i;

function fallbackNarrative(decision: PerformanceDecision): string {
  if (decision.action === "PAUSE_CANDIDATE") return "Meta confirmó que aún no hay conversaciones y ya se cumplieron los candados de seguridad. Revisa esta campaña antes de seguir invirtiendo.";
  if (decision.action === "INSUFFICIENT_DATA") return "Aún no hay información suficiente para recomendar un cambio fuerte de forma responsable.";
  if (decision.action === "SCALE" || decision.action === "MAINTAIN") return "Los datos disponibles indican que esta campaña se mantiene saludable por ahora. Puedes observarla sin hacer cambios fuertes hoy.";
  return "Los datos disponibles sugieren revisar esta campaña antes de continuar con la misma inversión.";
}

export default function TodayPage() {
  const { loading, result, error } = useIntelligence();
  const { clientId, dateRange } = useFilters();
  const campaigns = useMemo(
    () => result?.decisions.filter((decision) => decision.entityType === "campaign") ?? [],
    [result]
  );
  const [quality, setQuality] = useState<Record<string, string>>({});
  const [savingCampaign, setSavingCampaign] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{ targetCostPerResult: number } | null>(null);
  const [confirmingTarget, setConfirmingTarget] = useState(false);
  const [narratives, setNarratives] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!clientId) return;
    void fetch(`/api/meta/memory/target-proposal?accountId=${encodeURIComponent(clientId)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => setProposal(payload?.proposal ?? null))
      .catch(() => setProposal(null));
  }, [clientId]);

  useEffect(() => {
    if (!result || campaigns.length === 0) {
      setNarratives({});
      return;
    }
    let cancelled = false;
    void Promise.all(campaigns.map(async (decision) => {
      try {
        const response = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "performance",
            clientId,
            dateRange,
            question: `Escribe una frase para la pantalla principal, solamente sobre la campaña \"${decision.entityName}\". Explica qué hacer hoy sin jerga ni siglas.`,
          }),
        });
        const payload = await response.json();
        const summary = response.ok && typeof payload.summary === "string" ? payload.summary.trim() : "";
        return [decision.id, summary && !HOME_FORBIDDEN_TERMS.test(summary) ? summary : fallbackNarrative(decision)] as const;
      } catch {
        return [decision.id, fallbackNarrative(decision)] as const;
      }
    })).then((entries) => {
      if (!cancelled) setNarratives(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [result, campaigns, clientId, dateRange.from, dateRange.to]);

  async function confirmTarget() {
    if (!result || !proposal) return;
    setConfirmingTarget(true);
    try {
      const response = await fetch("/api/meta/memory/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: clientId, goals: { targetCostPerResult: proposal.targetCostPerResult } }),
      });
      if (response.ok) setProposal(null);
    } finally {
      setConfirmingTarget(false);
    }
  }

  async function saveQuality(campaignId: string) {
    const value = Number(quality[campaignId]);
    if (!result || !Number.isFinite(value) || value < 0) return;
    setSavingCampaign(campaignId);
    try {
      const response = await fetch("/api/meta/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: clientId, campaignId, periodTo: dateRange.to, qualifiedConversations: value }),
      });
      if (!response.ok) throw new Error("No se pudo guardar.");
    } finally {
      setSavingCampaign(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <header className="px-1 pt-1">
        <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground-2 uppercase">Brief del día</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">¿Qué necesita tu atención hoy?</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{result?.brief.headline ?? "Recomendaciones basadas exclusivamente en los datos reales disponibles."}</p>
      </header>

      {error && <ErrorBanner message={error} />}

      {proposal && (
        <section className="rounded-2xl border border-accent/30 bg-accent/10 p-4">
          <p className="text-sm font-semibold text-foreground">Para esta cuenta, un costo por conversación aceptable parece ser {proposal.targetCostPerResult.toFixed(2)}. ¿Lo confirmas?</p>
          <button type="button" onClick={() => void confirmTarget()} disabled={confirmingTarget} className="mt-3 min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60">
            {confirmingTarget ? "Guardando…" : "Confirmar objetivo"}
          </button>
        </section>
      )}

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
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{narratives[decision.id] ?? fallbackNarrative(decision)}</p>
                {decision.currentResultsAvailable === true && (
                  <form
                    className="mt-4 rounded-xl border border-border-subtle bg-surface-2/50 p-3"
                    onSubmit={(event) => { event.preventDefault(); void saveQuality(decision.campaignId); }}
                  >
                    <label htmlFor={`quality-${decision.campaignId}`} className="block text-xs font-semibold text-foreground">
                      ¿Cuántas de las {decision.currentMetrics.results} conversaciones de este periodo valieron la pena?
                    </label>
                    <div className="mt-2 flex gap-2">
                      <input
                        id={`quality-${decision.campaignId}`}
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={quality[decision.campaignId] ?? ""}
                        onChange={(event) => setQuality((current) => ({ ...current, [decision.campaignId]: event.target.value }))}
                        className="min-h-11 w-20 rounded-lg border border-border-subtle bg-background px-3 text-sm text-foreground"
                        aria-label="Conversaciones que valieron la pena"
                      />
                      <button type="submit" disabled={savingCampaign === decision.campaignId} className="min-h-11 rounded-lg bg-surface px-3 text-sm font-semibold text-foreground disabled:opacity-60">
                        {savingCampaign === decision.campaignId ? "Guardando…" : "Guardar"}
                      </button>
                    </div>
                  </form>
                )}
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

