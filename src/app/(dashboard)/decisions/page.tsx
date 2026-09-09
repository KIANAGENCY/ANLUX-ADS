"use client";

import { BrainCircuit, ShieldCheck } from "lucide-react";
import { DecisionCard } from "@/components/decisions/decision-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { useDecisions } from "@/hooks/use-decisions";

export default function DecisionsPage() {
  const { loading, result, error } = useDecisions();
  const summary = result?.summary;

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-border-subtle bg-surface-2 p-2.5 text-accent-light">
            <BrainCircuit className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Decision Engine</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              ANLUX evalúa campañas, conjuntos y anuncios con reglas determinísticas. Las acciones son recomendaciones read-only:
              nunca modifican Meta automáticamente.
            </p>
          </div>
        </div>
      </Card>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Summary label="Escalar" value={summary.scale} />
          <Summary label="Mantener" value={summary.maintain} />
          <Summary label="Observar" value={summary.watch} />
          <Summary label="Reducir" value={summary.reduce} />
          <Summary label="Intervención" value={summary.pauseCandidate + summary.refreshCreative + summary.reviewAudience} />
          <Summary label="Confianza alta" value={summary.highConfidence} />
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : !result || result.decisions.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No hay decisiones pendientes"
          description="No se detectó actividad suficiente en el periodo seleccionado para emitir recomendaciones."
        />
      ) : (
        <div className="space-y-3">
          {result.decisions.map((decision) => (
            <DecisionCard key={decision.id} decision={decision} />
          ))}
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
