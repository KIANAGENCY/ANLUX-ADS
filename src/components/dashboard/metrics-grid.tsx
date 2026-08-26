"use client";

import { DollarSign, Eye, MonitorPlay, Gauge, MousePointerClick, Percent, Coins, Target, Repeat, Users } from "lucide-react";
import { useAccountMetrics } from "@/hooks/use-account-metrics";
import { MetricCard } from "./metric-card";
import { CardSkeleton } from "@/components/ui/skeleton";
import type { MetricKey } from "@/lib/types";

const METRIC_ORDER: { key: MetricKey; icon: typeof DollarSign }[] = [
  { key: "spend", icon: DollarSign },
  { key: "reach", icon: Users },
  { key: "impressions", icon: Eye },
  { key: "cpm", icon: MonitorPlay },
  { key: "clicks", icon: MousePointerClick },
  { key: "ctr", icon: Percent },
  { key: "cpc", icon: Coins },
  { key: "results", icon: Target },
  { key: "costPerResult", icon: Gauge },
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
