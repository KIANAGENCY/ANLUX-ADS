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
  error: string | null;
}

interface AccountMetricsState {
  loading: boolean;
  comparison: MetricComparison | null;
  dailyRows: DailyMetrics[];
  error: string | null;
}

async function loadReal(clientId: string, from: string, to: string): Promise<AccountMetricsResult> {
  const key = `${clientId}|${from}|${to}`;
  try {
    const res = await fetch(`/api/meta/overview?accountId=${encodeURIComponent(clientId)}&from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudieron obtener las métricas de la cuenta.");
    return { key, comparison: data.comparison, dailyRows: data.dailyRows ?? [], error: null };
  } catch (err) {
    return {
      key,
      comparison: compareMetrics(aggregateMetrics([]), aggregateMetrics([])),
      dailyRows: [],
      error: err instanceof Error ? err.message : "Error al obtener métricas reales de Meta.",
    };
  }
}

async function loadMock(clientId: string, dateRange: { from: string; to: string }, previousDateRange: { from: string; to: string }): Promise<AccountMetricsResult> {
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const client = MOCK_CLIENTS.find((c) => c.id === clientId);
  if (!client) {
    return { key, comparison: compareMetrics(aggregateMetrics([]), aggregateMetrics([])), dailyRows: [], error: null };
  }
  const service = getMetaAdsService();
  const [currentRows, previousRows] = await Promise.all([
    service.getDailyMetrics("account", client.adAccountId, dateRange),
    service.getDailyMetrics("account", client.adAccountId, previousDateRange),
  ]);
  const comparison = compareMetrics(aggregateMetrics(currentRows), aggregateMetrics(previousRows));
  return { key, comparison, dailyRows: currentRows, error: null };
}

/** Trae y agrega las métricas de cuenta (actual + periodo anterior) del cliente/cuenta seleccionada. */
export function useAccountMetrics(): AccountMetricsState {
  const { clientId, dateRange, previousDateRange, isRealAccount } = useFilters();
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const [result, setResult] = useState<AccountMetricsResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    const promise = isRealAccount
      ? loadReal(clientId, dateRange.from, dateRange.to)
      : loadMock(clientId, dateRange, previousDateRange);

    promise.then((r) => {
      if (!cancelled) setResult(r);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, dateRange.from, dateRange.to, previousDateRange.from, previousDateRange.to, isRealAccount]);

  return {
    loading: result?.key !== key,
    comparison: result?.comparison ?? null,
    dailyRows: result?.dailyRows ?? [],
    error: result?.key === key ? result.error : null,
  };
}
