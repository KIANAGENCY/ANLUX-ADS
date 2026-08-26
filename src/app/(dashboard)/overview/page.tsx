"use client";

import { MetricsGrid } from "@/components/dashboard/metrics-grid";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { Funnel } from "@/components/dashboard/funnel";
import { useAccountMetrics } from "@/hooks/use-account-metrics";
import { useFilters } from "@/components/providers/filters-provider";
import { buildFunnelStages } from "@/lib/utils/funnel";
import { formatDateLong } from "@/lib/utils/dates";
import { Card } from "@/components/ui/card";

export default function OverviewPage() {
  const { loading, comparison, dailyRows } = useAccountMetrics();
  const { clientId, dateRange } = useFilters();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {formatDateLong(dateRange.from)} — {formatDateLong(dateRange.to)}
        </p>
      </div>

      <MetricsGrid />

      <PerformanceChart rows={dailyRows} loading={loading} />

      {loading || !comparison ? (
        <Card className="h-64 animate-pulse" />
      ) : (
        <Funnel stages={buildFunnelStages(comparison.current, clientId)} />
      )}
    </div>
  );
}
