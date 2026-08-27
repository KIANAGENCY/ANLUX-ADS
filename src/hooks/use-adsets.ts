"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import { getMetaAdsService } from "@/lib/meta";
import type { AdSet, Campaign, PerformanceMetrics } from "@/lib/types";
import { aggregateMetrics } from "@/lib/utils/metrics";

export interface AdSetWithMetrics extends AdSet {
  campaignName: string;
  metrics: PerformanceMetrics;
}

interface Result {
  key: string;
  adSets: AdSetWithMetrics[];
  error: string | null;
}

async function loadReal(accountId: string, from: string, to: string): Promise<Result> {
  const key = `${accountId}|${from}|${to}`;
  try {
    const res = await fetch(`/api/meta/adsets?accountId=${encodeURIComponent(accountId)}&from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudieron obtener los conjuntos de anuncios.");
    return { key, adSets: data.adSets ?? [], error: null };
  } catch (err) {
    return { key, adSets: [], error: err instanceof Error ? err.message : "Error al obtener conjuntos reales." };
  }
}

async function loadMock(clientId: string, dateRange: { from: string; to: string }): Promise<Result> {
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const service = getMetaAdsService();
  const [adSets, campaigns] = await Promise.all([service.getAdSets(clientId), service.getCampaigns(clientId)]);
  const campaignsById = new Map<string, Campaign>(campaigns.map((c) => [c.id, c]));

  const withMetrics = await Promise.all(
    adSets.map(async (adSet) => {
      const rows = await service.getDailyMetrics("adset", adSet.id, dateRange);
      return {
        ...adSet,
        campaignName: campaignsById.get(adSet.campaignId)?.name ?? "—",
        metrics: aggregateMetrics(rows),
      };
    })
  );
  return { key, adSets: withMetrics, error: null };
}

export function useAdSets(): { loading: boolean; adSets: AdSetWithMetrics[]; error: string | null } {
  const { clientId, dateRange, isRealAccount } = useFilters();
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;

    const promise = isRealAccount ? loadReal(clientId, dateRange.from, dateRange.to) : loadMock(clientId, dateRange);

    promise.then((r) => {
      if (!cancelled) setResult(r);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, dateRange.from, dateRange.to, isRealAccount]);

  return {
    loading: result?.key !== key,
    adSets: result?.adSets ?? [],
    error: result?.key === key ? result.error : null,
  };
}
