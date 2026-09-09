"use client";

import { ArrowDownRight, ArrowUpRight, Eye, PauseCircle, RefreshCw, ShieldAlert, Target, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { DecisionAction, PerformanceDecision } from "@/lib/decisions/types";

const ACTION_META: Record<DecisionAction, { label: string; icon: typeof ArrowUpRight; className: string }> = {
  SCALE: { label: "Escalar", icon: ArrowUpRight, className: "text-positive" },
  MAINTAIN: { label: "Mantener", icon: Target, className: "text-foreground" },
  WATCH: { label: "Observar", icon: Eye, className: "text-warning" },
  REDUCE: { label: "Reducir", icon: ArrowDownRight, className: "text-warning" },
  PAUSE_CANDIDATE: { label: "Candidato a pausa", icon: PauseCircle, className: "text-negative" },
  REFRESH_CREATIVE: { label: "Renovar creativo", icon: RefreshCw, className: "text-warning" },
  REVIEW_AUDIENCE: { label: "Revisar audiencia", icon: Users, className: "text-warning" },
  INSUFFICIENT_DATA: { label: "Faltan datos", icon: ShieldAlert, className: "text-muted-foreground" },
};

function confidenceLabel(value: PerformanceDecision["confidence"]) {
  if (value === "high") return "Alta";
  if (value === "medium") return "Media";
  return "Baja";
}

function entityLabel(value: PerformanceDecision["entityType"]) {
  if (value === "campaign") return "Campaña";
  if (value === "adset") return "Conjunto";
  return "Anuncio";
}

export function DecisionCard({ decision }: { decision: PerformanceDecision }) {
  const meta = ACTION_META[decision.action];
  const Icon = meta.icon;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border-subtle bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {entityLabel(decision.entityType)}
            </span>
            <span className="text-xs text-muted-foreground">{decision.campaignName}</span>
          </div>
          <h3 className="truncate text-base font-semibold text-foreground">{decision.entityName}</h3>
          <div className={`flex items-center gap-2 text-sm font-semibold ${meta.className}`}>
            <Icon className="size-4" />
            <span>{meta.label}</span>
            {decision.suggestedChangePercent !== null && (
              <span className="text-xs font-medium text-muted-foreground">
                {decision.suggestedChangePercent > 0 ? "+" : ""}{decision.suggestedChangePercent}% sugerido
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <div className="rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-center">
            <p className="text-lg font-semibold text-foreground">{decision.score}</p>
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Score</p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-center">
            <p className="text-sm font-semibold text-foreground">{confidenceLabel(decision.confidence)}</p>
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Confianza</p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">{decision.rationale}</p>

      {decision.signals.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {decision.signals.slice(0, 4).map((signal) => (
            <div key={signal.code} className="rounded-lg border border-border-subtle bg-surface-2/60 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-foreground">{signal.label}</p>
                <span className={`text-xs font-semibold ${signal.impact > 0 ? "text-positive" : signal.impact < 0 ? "text-negative" : "text-muted-foreground"}`}>
                  {signal.impact > 0 ? "+" : ""}{signal.impact}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{signal.detail}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
