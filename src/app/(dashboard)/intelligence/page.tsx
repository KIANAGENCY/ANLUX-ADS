"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, BrainCircuit, ShieldCheck } from "lucide-react";
import { useFilters } from "@/components/providers/filters-provider";
import { Card } from "@/components/ui/card";
import { PortfolioCard } from "@/components/decisions/portfolio-card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntelligence } from "@/hooks/use-intelligence";
import type { BusinessGoals } from "@/lib/intelligence/types";
import type { PerformanceDecision } from "@/lib/decisions/types";

const ACTION_LABELS: Record<PerformanceDecision["action"], string> = {
  SCALE: "Oportunidad de crecimiento", MAINTAIN: "Mantener", WATCH: "Observar",
  REDUCE: "Revisar inversión", PAUSE_CANDIDATE: "Revisar continuidad",
  REFRESH_CREATIVE: "Actualizar creativo", REVIEW_AUDIENCE: "Revisar audiencia",
  INSUFFICIENT_DATA: "Datos insuficientes",
};
const ACTIONABLE = new Set<PerformanceDecision["action"]>(["REDUCE", "PAUSE_CANDIDATE", "REFRESH_CREATIVE", "REVIEW_AUDIENCE", "SCALE"]);
const PRIORITY: Record<PerformanceDecision["action"], number> = {
  PAUSE_CANDIDATE: 0, REDUCE: 1, REFRESH_CREATIVE: 2, REVIEW_AUDIENCE: 3,
  SCALE: 4, WATCH: 5, MAINTAIN: 6, INSUFFICIENT_DATA: 7,
};

export default function IntelligencePage() {
  const { loading, result, error, goals, setGoals, saveGoals, savingGoals, saveMemory, savingMemory, memorySaved } = useIntelligence();
  const { dateRange, currency } = useFilters();
  const campaigns = result?.decisions.filter((decision) => decision.entityType === "campaign") ?? [];
  const verifiedResults = campaigns.filter((decision) => decision.currentResultsAvailable !== false);
  // Campaigns, sets and ads share the same spend. Show one recommendation per
  // campaign in this overview; the Decisions page retains every entity.
  const proposals = result ? [...result.decisions]
    .filter((decision) => ACTIONABLE.has(decision.action) && decision.confidence !== "low"
      && !result.learningGuards.some((guard) => guard.entityId === decision.entityId && guard.blocked))
    .sort((a, b) => PRIORITY[a.action] - PRIORITY[b.action])
    .filter((decision, index, all) => all.findIndex((item) => item.campaignId === decision.campaignId) === index)
    .slice(0, 3) : [];
  return <div className="space-y-5">
    <Card className="p-5"><div className="flex gap-3"><BrainCircuit className="mt-0.5 size-5 shrink-0 text-accent-light"/><div><h2 className="font-semibold">Resumen para decidir</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Cuenta y periodo seleccionados: {dateRange.from} al {dateRange.to}. Recomendaciones basadas en datos de Meta; ninguna cambia las campañas automáticamente.</p></div></div></Card>
    {error && <ErrorBanner message={error}/>} {loading && <Skeleton className="h-48 w-full rounded-xl"/>}
    {result && <>
      <div className="grid gap-3 sm:grid-cols-3"><Stat label="Campañas evaluadas" value={campaigns.length}/><Stat label="Resultados verificados por Meta" value={verifiedResults.length === campaigns.length ? String(verifiedResults.reduce((sum, decision) => sum + decision.currentMetrics.results, 0)) : "Parciales"}/><Stat label="Decisiones sugeridas" value={proposals.length + (result.portfolioRecommendations?.length ?? 0)}/></div>
      {(result.portfolioRecommendations?.length ?? 0) > 0 && <section className="space-y-3"><h3 className="font-semibold">Cómo optimizar el presupuesto</h3>{result.portfolioRecommendations?.map((recommendation) => <PortfolioCard key={recommendation.id} recommendation={recommendation}/>)}</section>}
      {(proposals.length > 0 || !result.portfolioRecommendations?.length) && <section aria-labelledby="recommendations-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 id="recommendations-heading" className="font-semibold">Qué revisar ahora</h3><p className="mt-1 text-sm text-muted-foreground">Hasta tres campañas distintas, ordenadas por prioridad. Revisa los datos antes de actuar.</p></div><Link href="/decisions" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent-light">Ver todas las decisiones <ArrowRight className="size-4"/></Link></div>
        {proposals.length ? proposals.map((decision) => <Card key={decision.id} className="p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-foreground">{decision.campaignName}</p><span className="rounded-full border border-border-subtle px-3 py-1 text-xs text-accent-light">{ACTION_LABELS[decision.action]}</span></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{decision.entityType === "campaign" ? "Campaña" : decision.entityType === "adset" ? "Conjunto" : "Anuncio"}: {decision.entityName}</p><p className="mt-1 text-sm leading-6 text-foreground">{decision.rationale}</p><p className="mt-2 text-xs text-muted-foreground">Confianza {decision.confidence === "high" ? "alta" : "media"} · Resultados: {decision.currentResultsAvailable === false ? "no disponibles para este objetivo" : decision.currentMetrics.results} · Inversión: {decision.currentMetrics.spend.toLocaleString("es-MX", { maximumFractionDigits: 2 })}{currency ? ` ${currency}` : ""}</p></Card>) : <Card className="p-5"><ShieldCheck className="size-5 text-accent-light"/><p className="mt-2 text-sm font-semibold">{campaigns.length ? "Observar antes de hacer cambios" : "Sin campañas evaluables en este periodo"}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{campaigns.length ? `Las campañas evaluadas no cruzaron los umbrales para recomendar un ajuste de inversión, audiencia o creativo. Revisa sus resultados abajo.${goals.targetCostPerResult ? "" : " Configura un CPA/CPL objetivo si quieres comparar el costo con una meta de negocio."}` : "Selecciona otro periodo o comprueba la actividad de la cuenta en Meta."}</p></Card>}
      </section>}
      {campaigns.length > 0 && <section className="space-y-3"><h3 className="font-semibold">Rendimiento por campaña</h3><p className="text-sm text-muted-foreground">Cifras del periodo seleccionado. Las campañas se muestran una sola vez para evitar duplicar gasto y resultados de conjuntos y anuncios.</p><div className="grid gap-3 lg:grid-cols-2">{campaigns.map((decision) => <Card key={decision.id} className="p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">{decision.entityName}</h4><span className="text-xs text-accent-light">{ACTION_LABELS[decision.action]}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Inversión</dt><dd className="mt-1 font-semibold">{decision.currentMetrics.spend.toLocaleString("es-MX", { maximumFractionDigits: 2 })}{currency ? ` ${currency}` : ""}</dd></div><div><dt className="text-xs text-muted-foreground">Resultados</dt><dd className="mt-1 font-semibold">{decision.currentResultsAvailable === false ? "No disponibles" : decision.currentMetrics.results}</dd></div><div><dt className="text-xs text-muted-foreground">Costo por resultado</dt><dd className="mt-1 font-semibold">{decision.currentResultsAvailable === false || decision.currentMetrics.results === 0 ? "Sin dato" : `${decision.currentMetrics.costPerResult.toLocaleString("es-MX", { maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`}</dd></div><div><dt className="text-xs text-muted-foreground">Clics</dt><dd className="mt-1 font-semibold">{decision.currentMetrics.clicks.toLocaleString("es-MX")}</dd></div></dl><Link href={`/campaigns/${encodeURIComponent(decision.entityId)}`} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent-light">Ver campaña <ArrowRight className="size-4"/></Link></Card>)}</div></section>}
      <details className="rounded-xl border border-border-subtle bg-surface p-5"><summary className="cursor-pointer text-sm font-semibold">Configurar metas y guardar análisis</summary><div className="mt-4 space-y-5"><Goals goals={goals} onChange={setGoals} onSave={saveGoals} saving={savingGoals}/><div className="flex flex-wrap items-center gap-3"><button type="button" onClick={()=>void saveMemory()} disabled={savingMemory} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60">{savingMemory ? "Actualizando…" : "Guardar análisis actual"}</button><p role="status" className="text-xs text-muted-foreground">{memorySaved ? "Análisis y decisiones guardados para este periodo." : "Guarda este periodo cuando quieras actualizar su historial en Supabase."}</p></div><HistoricalSave/></div></details>
    </>}
  </div>;
}

function HistoricalSave() {
  const { clientId } = useFilters();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientId || saving) return;
    setSaving(true);
    setStatus("");
    try {
      const query = new URLSearchParams({ accountId: clientId, from, to });
      const response = await fetch(`/api/meta/intelligence?${query}`, { method: "POST", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo calcular el periodo.");
      if (payload.memory?.state !== "ready") throw new Error(payload.memory?.message ?? "No se pudo guardar el periodo.");
      setStatus(`Periodo ${from} a ${to} guardado con ${payload.decisions.length} decisiones.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo guardar el periodo.");
    } finally {
      setSaving(false);
    }
  }

  return <Card className="p-5"><h3 className="text-sm font-semibold">Actualizar un periodo histórico</h3>
    <p className="mt-1 text-xs text-muted-foreground">Calcula nuevamente sus métricas y decisiones con los datos actuales de Meta. Los periodos se guardan solo al confirmar.</p>
    <form onSubmit={(event)=>void save(event)} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="space-y-1 text-xs text-muted-foreground"><span>Desde (AAAA-MM-DD)</span><input type="text" inputMode="numeric" placeholder="2026-08-25" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" maxLength={10} required value={from} onChange={(event)=>setFrom(event.target.value)} className="block min-h-11 rounded-lg border border-border-subtle bg-surface-2 px-3 text-sm text-foreground"/></label>
      <label className="space-y-1 text-xs text-muted-foreground"><span>Hasta (AAAA-MM-DD)</span><input type="text" inputMode="numeric" placeholder="2026-09-23" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" maxLength={10} required value={to} onChange={(event)=>setTo(event.target.value)} className="block min-h-11 rounded-lg border border-border-subtle bg-surface-2 px-3 text-sm text-foreground"/></label>
      <button type="submit" disabled={!clientId || saving} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Actualizando…" : "Guardar periodo"}</button>
    </form>
    {status && <p role="status" className="mt-2 text-xs text-muted-foreground">{status}</p>}
  </Card>;
}

function Goals({goals,onChange,onSave,saving}:{goals:BusinessGoals;onChange:(g:BusinessGoals)=>void;onSave:()=>Promise<void>;saving:boolean}) {
  const field=(key:keyof BusinessGoals,label:string)=><label className="space-y-1 text-xs text-muted-foreground"><span>{label}</span><input className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-foreground" type="number" min="0" value={(goals[key] as number|null|undefined) ?? ""} onChange={e=>onChange({...goals,[key]:e.target.value===""?null:Number(e.target.value)})}/></label>;
  return <Card className="p-5"><h3 className="mb-3 text-sm font-semibold">Metas del negocio</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{field("targetCostPerResult","CPA/CPL objetivo")}{field("minimumRoas","ROAS mínimo")}{field("monthlyBudget","Presupuesto mensual")}{field("grossMarginPercent","Margen bruto %")}<label className="space-y-1 text-xs text-muted-foreground"><span>Tolerancia al riesgo</span><select className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-foreground" value={goals.riskTolerance ?? "balanced"} onChange={e=>onChange({...goals,riskTolerance:e.target.value as BusinessGoals["riskTolerance"]})}><option value="conservative">Conservadora</option><option value="balanced">Balanceada</option><option value="growth">Crecimiento</option></select></label></div><p className="mt-3 text-xs text-muted-foreground">El costo objetivo sí participa en el análisis. ROAS mínimo, presupuesto mensual, margen bruto y tolerancia al riesgo se guardan como referencia; todavía no modifican las decisiones. Confirma para guardar las metas. No se envían a Meta.</p><button type="button" onClick={()=>void onSave()} disabled={saving} className="mt-3 min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60">{saving?"Guardando…":"Guardar metas"}</button></Card>;
}
function Stat({label,value}:{label:string;value:number|string}){return <Card className="p-4"><p className="text-2xl font-semibold text-foreground">{value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{label}</p></Card>}
