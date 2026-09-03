"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import type { Ad, PerformanceMetrics } from "@/lib/types";

export interface AdWithMetrics extends Ad {
  campaignName: string;
  adSetName: string;
  metrics: PerformanceMetrics;
}

interface Result {
  key: string;
  ads: AdWithMetrics[];
  error: string | null;
}

async function load(accountId: string, from: string, to: string): Promise<Result> {
  const key = `${accountId}|${from}|${to}`;
  if (!accountId) return { key, ads: [], error: null };
  try {
    const res = await fetch(`/api/meta/ads?accountId=${encodeURIComponent(accountId)}&from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudieron obtener los anuncios.");
    return { key, ads: data.ads ?? [], error: null };
  } catch (err) {
    return { key, ads: [], error: err instanceof Error ? err.message : "Error al obtener anuncios de Meta." };
  }
}

export function useAds(): { loading: boolean; ads: AdWithMetrics[]; error: string | null } {
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
    ads: result?.ads ?? [],
    error: result?.key === key ? result.error : null,
  };
}
