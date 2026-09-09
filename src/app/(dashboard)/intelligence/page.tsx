"use client";

import { BrainCircuit, FlaskConical, Gauge, Lightbulb, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntelligence } from "@/hooks/use-intelligence";
import type { BusinessGoals } from "@/lib/intelligence/types";

export default function IntelligencePage() {
  const { loading, result, error, goals, setGoals } = useIntelligence();
  return <div className="space-y-5">
    <Card className="p-5"><div className="flex gap-3"><BrainCircuit className="mt-0.5 size-5 text-accent-light"/><div><h2 className="font-semibold">Intelligence Command Center</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Contexto de negocio + Decision Engine + anomalías + presupuesto + creativos + experimentos + forecasting. Todo permanece en modo recomendación: ANLUX no escribe en Meta.</p></div></div></Card>
    <Goals goals={goals} onChange={setGoals}/>
    {error && <ErrorBanner message={error}/>} {loading && <Skeleton className="h-48 w-full rounded-xl"/>}
    {result && <>
      <div className="grid gap-3 md:grid-cols-3"><Mini icon={ShieldCheck} title="Brief ejecutivo" text={result.brief.headline}/><Mini icon={Gauge} title="Forecast" text={result.forecast.projectedResults == null ? result.forecast.warning ?? "Sin proyección" : `Resultados proyectados: ${result.forecast.projectedResults} (incertidumbre ±${result.forecast.uncertaintyPercent}%).`}/><Mini icon={Sparkles} title="Modo" text="Recommend-only · ninguna acción automática en Meta"/></div>
      <Section title="Atención prioritaria" icon={Lightbulb} items={result.brief.attention}/>
      <Section title={`Anomalías (${result.anomalies.length})`} icon={Gauge} items={result.anomalies.slice(0,10).map(a=>`${a.entityName}: ${a.message}`)}/>
      <Section title={`Budget Optimizer (${result.budgetRecommendations.length})`} icon={WalletCards} items={result.budgetRecommendations.map(b=>b.rationale)}/>
      <Section title={`Creative Intelligence (${result.creativeInsights.length})`} icon={Sparkles} items={result.creativeInsights.slice(0,10).map(c=>`${c.adName} · ${c.status}: ${c.message}`)}/>
      <Section title={`Experiment Engine (${result.experiments.length})`} icon={FlaskConical} items={result.experiments.map(e=>`${e.entityName}: ${e.hypothesis} Métrica: ${e.successMetric}.`)}/>
      <Section title="Protecciones de aprendizaje" icon={ShieldCheck} items={result.learningGuards.filter(g=>g.blocked).slice(0,10).map(g=>`${g.entityName}: ${g.reason}`)}/>
    </>}
  </div>;
}

function Goals({goals,onChange}:{goals:BusinessGoals;onChange:(g:BusinessGoals)=>void}) {
  const field=(key:keyof BusinessGoals,label:string)=><label className="space-y-1 text-xs text-muted-foreground"><span>{label}</span><input className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-foreground" type="number" min="0" value={(goals[key] as number|null|undefined) ?? ""} onChange={e=>onChange({...goals,[key]:e.target.value===""?null:Number(e.target.value)})}/></label>;
  return <Card className="p-5"><h3 className="mb-3 text-sm font-semibold">Metas del negocio</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{field("targetCostPerResult","CPA/CPL objetivo")}{field("minimumRoas","ROAS mínimo")}{field("monthlyBudget","Presupuesto mensual")}{field("grossMarginPercent","Margen bruto %")}<label className="space-y-1 text-xs text-muted-foreground"><span>Tolerancia al riesgo</span><select className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-foreground" value={goals.riskTolerance ?? "balanced"} onChange={e=>onChange({...goals,riskTolerance:e.target.value as BusinessGoals["riskTolerance"]})}><option value="conservative">Conservadora</option><option value="balanced">Balanceada</option><option value="growth">Crecimiento</option></select></label></div><p className="mt-3 text-xs text-muted-foreground">Estas metas se guardan localmente en este navegador por cuenta. No se envían a Meta.</p></Card>;
}
function Mini({icon:Icon,title,text}:{icon:typeof BrainCircuit;title:string;text:string}){return <Card className="p-4"><Icon className="size-4 text-accent-light"/><h3 className="mt-2 text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></Card>}
function Section({title,icon:Icon,items}:{title:string;icon:typeof BrainCircuit;items:string[]}){return <Card className="p-5"><div className="flex items-center gap-2"><Icon className="size-4 text-accent-light"/><h3 className="text-sm font-semibold">{title}</h3></div>{items.length?<div className="mt-3 space-y-2">{items.map((x,i)=><p key={i} className="rounded-lg bg-surface-2 px-3 py-2 text-xs leading-5 text-muted-foreground">{x}</p>)}</div>:<p className="mt-3 text-xs text-muted-foreground">Sin hallazgos con evidencia suficiente en este periodo.</p>}</Card>}
