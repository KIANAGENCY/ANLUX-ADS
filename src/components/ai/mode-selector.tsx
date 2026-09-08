"use client";

import { BarChart3, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { AnalysisMode } from "./use-ai-analysis";

const MODES: { value: AnalysisMode; label: string; icon: typeof Lightbulb; hint: string }[] = [
  {
    value: "general",
    label: "Consulta estratégica",
    icon: Lightbulb,
    hint: "Recomendaciones generales de Meta Ads. No usa datos de tu cuenta.",
  },
  {
    value: "performance",
    label: "Analizar rendimiento",
    icon: BarChart3,
    hint: "Analiza las métricas reales de la cuenta y el periodo seleccionados.",
  },
];

/**
 * Selección explícita del modo de consulta. El valor elegido viaja al
 * endpoint y se valida en el servidor: la UI no es la única barrera, pero sí
 * hace visible cuál de los dos comportamientos se va a ejecutar.
 */
export function ModeSelector({
  value,
  onChange,
  disabled,
  accountSelected,
}: {
  value: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
  disabled?: boolean;
  /** Sin cuenta seleccionada, "Analizar rendimiento" no puede ejecutarse. */
  accountSelected: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="inline-flex rounded-lg border border-border-subtle bg-surface p-0.5">
        {MODES.map(({ value: mode, label, icon: Icon, hint }) => {
          const active = value === mode;
          const unavailable = mode === "performance" && !accountSelected;
          return (
            <button
              key={mode}
              type="button"
              title={unavailable ? "Selecciona una cuenta de Meta para analizar su rendimiento." : hint}
              disabled={disabled || unavailable}
              onClick={() => onChange(mode)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground",
                (disabled || unavailable) && "cursor-not-allowed opacity-40 hover:text-muted-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground-2">
        {value === "general"
          ? "Recomendaciones generales de Meta Ads. La respuesta no se basa en métricas de tu cuenta."
          : accountSelected
            ? "Se analizarán las métricas reales de la cuenta y el periodo seleccionados."
            : "Selecciona una cuenta de Meta para poder analizar su rendimiento."}
      </p>
    </div>
  );
}
