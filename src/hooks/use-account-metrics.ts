"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import { getMetaAdsService } from "@/lib/meta";
import { MOCK_CLIENTS } from "@/lib/mock/entities";
import type { DailyMetrics, MetricComparison } from "@/lib/types";
import { aggregateMetrics, compareMetrics } from "@/lib/utils/metrics";

interface AccountMetricsResult {
  key: string;
  comparison: MetricComparison;
  dailyRows: DailyMetrics[];
}

interface AccountMetricsState {
  loading: boolean;
  comparison: MetricComparison | null;
  dailyRows: DailyMetrics[];
}

/** Trae y agrega las métricas de cuenta (actual + periodo anterior) del cliente seleccionado. */
export function useAccountMetrics(): AccountMetricsState {
  const { clientId, dateRange, previousDateRange } = useFilters();
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const [result, setResult] = useState<AccountMetricsResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const client = MOCK_CLIENTS.find((c) => c.id === clientId);
      if (!client) return;
      const service = getMetaAdsService();

      const [currentRows, previousRows] = await Promise.all([
        service.getDailyMetrics("account", client.adAccountId, dateRange),
        service.getDailyMetrics("account", client.adAccountId, previousDateRange),
      ]);

      if (cancelled) return;
      const comparison = compareMetrics(aggregateMetrics(currentRows), aggregateMetrics(previousRows));
      setResult({ key, comparison, dailyRows: currentRows });
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, dateRange.from, dateRange.to, previousDateRange.from, previousDateRange.to]);

  return {
    loading: result?.key !== key,
    comparison: result?.comparison ?? null,
    dailyRows: result?.dailyRows ?? [],
  };
}
