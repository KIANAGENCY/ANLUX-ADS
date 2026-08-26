import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import type { MetricKey } from "@/lib/types";
import { formatCurrency, formatDecimal, formatNumber, formatPercent, formatSignedPercent } from "@/lib/utils/format";
import { isChangePositive, METRIC_LABELS } from "@/lib/utils/metrics";
import { cn } from "@/lib/utils/cn";

const METRIC_FORMATTERS: Record<MetricKey, (v: number) => string> = {
  spend: (v) => formatCurrency(v),
  reach: (v) => formatNumber(v),
  impressions: (v) => formatNumber(v),
  clicks: (v) => formatNumber(v),
  results: (v) => formatNumber(v),
  frequency: (v) => formatDecimal(v),
  cpm: (v) => formatCurrency(v),
  ctr: (v) => formatPercent(v),
  cpc: (v) => formatCurrency(v),
  costPerResult: (v) => formatCurrency(v),
};

const METRIC_TOOLTIPS: Record<MetricKey, string> = {
  spend: "Total invertido en el periodo seleccionado.",
  reach: "Personas únicas que vieron los anuncios (aproximado).",
  impressions: "Veces que se mostraron los anuncios, incluyendo repeticiones.",
  clicks: "Clics totales en los anuncios.",
  results: "Conversiones según el objetivo de cada campaña (leads, mensajes, ventas...).",
  frequency: "Promedio de veces que una misma persona vio el anuncio. Por encima de 3 suele indicar fatiga de audiencia.",
  cpm: "Costo por cada mil impresiones.",
  ctr: "Porcentaje de impresiones que resultaron en un clic.",
  cpc: "Costo promedio por clic.",
  costPerResult: "Inversión promedio necesaria para conseguir un resultado.",
};

export function MetricCard({
  metric,
  value,
  changePercent,
  icon: Icon,
}: {
  metric: MetricKey;
  value: number;
  changePercent: number | null;
  icon?: LucideIcon;
}) {
  const positive = isChangePositive(metric, changePercent);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <Tooltip content={METRIC_TOOLTIPS[metric]}>
          <span className="cursor-default text-xs font-medium text-muted-foreground border-b border-dotted border-white/20">
            {METRIC_LABELS[metric]}
          </span>
        </Tooltip>
        {Icon && <Icon className="size-3.5 text-muted-foreground/60" />}
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {METRIC_FORMATTERS[metric](value)}
      </p>

      <div className="mt-2 flex items-center gap-1 text-xs">
        {changePercent === null ? (
          <span className="text-muted-foreground">Sin datos del periodo anterior</span>
        ) : (
          <>
            <span
              className={cn(
                "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                positive === true && "bg-positive/10 text-positive",
                positive === false && "bg-negative/10 text-negative",
                positive === null && "bg-white/6 text-muted-foreground"
              )}
            >
              {changePercent === 0 ? (
                <Minus className="size-3" />
              ) : changePercent > 0 ? (
                <ArrowUp className="size-3" />
              ) : (
                <ArrowDown className="size-3" />
              )}
              {formatSignedPercent(changePercent)}
            </span>
            <span className="text-muted-foreground">vs. periodo anterior</span>
          </>
        )}
      </div>
    </Card>
  );
}
