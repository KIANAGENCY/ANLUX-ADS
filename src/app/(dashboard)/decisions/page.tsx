"use client";

import { BrainCircuit, ShieldCheck } from "lucide-react";
import { DecisionCard } from "@/components/decisions/decision-card";
import { PortfolioCard } from "@/components/decisions/portfolio-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { useDecisions } from "@/hooks/use-decisions";

export default function DecisionsPage() {
  const { loading, result, error } = useDecisions();
  const campaigns = result?.decisions.filter((decision) => decision.entityType === "campaign") ?? [];
  const details = result?.decisions.filter((decision) => decision.entityType !== "campaign") ?? [];
  const count = (...actions: string[]) => campaigns.filter((decision) => actions.includes(decision.action)).length;

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-border-subtle bg-surface-2 p-2.5 text-accent-light">
            <BrainCircuit className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Decisiones para tus campañas</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Primero verás qué decisión revisar para cada campaña y por qué. Los conjuntos y anuncios están disponibles abajo como detalle. ANLUX nunca cambia Meta automáticamente.
            </p>
          </div>
        </div>
      </Card>

      {result && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Summary label="Campañas para aumentar" value={count("SCALE")} />
          <Summary label="Campañas para mantener" value={count("MAINTAIN")} />
          <Summary label="Campañas para observar" value={count("WATCH", "INSUFFICIENT_DATA")} />
          <Summary label="Campañas para reducir" value={count("REDUCE")} />
          <Summary label="Campañas para revisar" value={count("PAUSE_CANDIDATE", "REFRESH_CREATIVE", "REVIEW_AUDIENCE")} />
          <Summary label="Campañas con confianza alta" value={campaigns.filter((decision) => decision.confidence === "high").length} />
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {error ? null : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : !result || result.decisions.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Sin recomendaciones para este periodo"
          description="No hay actividad evaluable suficiente con los datos disponibles para emitir una recomendación responsable."
        />
      ) : (
        <div className="space-y-3">
          {result.portfolioRecommendations.length > 0 && <section className="space-y-3"><h3 className="text-base font-semibold">Optimización del presupuesto entre campañas</h3>{result.portfolioRecommendations.map((recommendation) => <PortfolioCard key={recommendation.id} recommendation={recommendation}/>)}</section>}
          <h3 className="text-base font-semibold">Evaluación por campaña</h3>
          {campaigns.map((decision) => (
            <DecisionCard key={decision.id} decision={decision} />
          ))}
          {details.length > 0 && <details className="rounded-xl border border-border-subtle bg-surface p-5"><summary className="cursor-pointer text-sm font-semibold">Ver {details.length} evaluaciones de conjuntos y anuncios</summary><div className="mt-4 space-y-3">{details.map((decision) => <DecisionCard key={decision.id} decision={decision}/>)}</div></details>}
          <p className="text-xs leading-5 text-muted-foreground">Costo por resultado significa cuánto invertiste, en promedio, por cada resultado del tipo reportado por Meta. Antes de cambiar presupuesto, confirma si esos resultados se convirtieron en clientes valiosos.</p>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3.5 text-center">
      <p className="text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </Card>
  );
}
