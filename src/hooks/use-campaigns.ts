"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import type { Campaign, PerformanceMetrics } from "@/lib/types";

export interface CampaignWithMetrics extends Campaign {
  metrics: PerformanceMetrics;
}

interface Result {
  key: string;
  campaigns: CampaignWithMetrics[];
  error: string | null;
}

async function load(accountId: string, from: string, to: string): Promise<Result> {
  const key = `${accountId}|${from}|${to}`;
  if (!accountId) return { key, campaigns: [], error: null };
  try {
    const res = await fetch(`/api/meta/campaigns?accountId=${encodeURIComponent(accountId)}&from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudieron obtener las campañas.");
    return { key, campaigns: data.campaigns ?? [], error: null };
  } catch (err) {
    return { key, campaigns: [], error: err instanceof Error ? err.message : "Error al obtener campañas de Meta." };
  }
}

export function useCampaigns(): { loading: boolean; campaigns: CampaignWithMetrics[]; error: string | null } {
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
    campaigns: result?.campaigns ?? [],
    error: result?.key === key ? result.error : null,
  };
}
