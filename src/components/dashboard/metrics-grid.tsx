"use client";

import { DollarSign, Eye, MonitorPlay, Gauge, MousePointerClick, Percent, Coins, Target, Repeat, Users } from "lucide-react";
import { useAccountMetrics } from "@/hooks/use-account-metrics";
import { MetricCard } from "./metric-card";
import { CardSkeleton } from "@/components/ui/skeleton";
import type { MetricKey } from "@/lib/types";

/**
 * Orden por relevancia de negocio: primero lo que se decide (inversión,
 * resultados, coste por resultado), después eficiencia y volumen.
 */
const METRIC_ORDER: { key: MetricKey; icon: typeof DollarSign }[] = [
  { key: "spend", icon: DollarSign },
  { key: "results", icon: Target },
  { key: "costPerResult", icon: Gauge },
  { key: "ctr", icon: Percent },
  { key: "cpc", icon: Coins },
  { key: "clicks", icon: MousePointerClick },
  { key: "impressions", icon: Eye },
  { key: "reach", icon: Users },
  { key: "cpm", icon: MonitorPlay },
  { key: "frequency", icon: Repeat },
];

export function MetricsGrid() {
  const { loading, comparison } = useAccountMetrics();

  if (loading || !comparison) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {METRIC_ORDER.map(({ key, icon }) => (
        <MetricCard
          key={key}
          metric={key}
          value={comparison.current[key]}
          changePercent={comparison.changePercent[key]}
          icon={icon}
        />
      ))}
    </div>
  );
}
