"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import type { AdSet, PerformanceMetrics } from "@/lib/types";

export interface AdSetWithMetrics extends AdSet {
  campaignName: string;
  metrics: PerformanceMetrics;
}

interface Result {
  key: string;
  adSets: AdSetWithMetrics[];
  error: string | null;
}

async function load(accountId: string, from: string, to: string): Promise<Result> {
  const key = `${accountId}|${from}|${to}`;
  if (!accountId) return { key, adSets: [], error: null };
  try {
    const res = await fetch(`/api/meta/adsets?accountId=${encodeURIComponent(accountId)}&from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudieron obtener los conjuntos de anuncios.");
    return { key, adSets: data.adSets ?? [], error: null };
  } catch (err) {
    return { key, adSets: [], error: err instanceof Error ? err.message : "Error al obtener conjuntos de Meta." };
  }
}

export function useAdSets(): { loading: boolean; adSets: AdSetWithMetrics[]; error: string | null } {
  const { clientId, dateRange } = useFilters();
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;

    load(clientId, dateRange.from, dateRange.to).then((r) => {
      if (!cancelled) setResult(r);
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, dateRange.from, dateRange.to]);

  return {
    loading: result?.key !== key,
    adSets: result?.adSets ?? [],
    error: result?.key === key ? result.error : null,
  };
}
