"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import { getMetaAdsService } from "@/lib/meta";
import type { Ad, AdSet, Campaign, PerformanceMetrics } from "@/lib/types";
import { aggregateMetrics } from "@/lib/utils/metrics";

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

async function loadReal(accountId: string, from: string, to: string): Promise<Result> {
  const key = `${accountId}|${from}|${to}`;
  try {
    const res = await fetch(`/api/meta/ads?accountId=${encodeURIComponent(accountId)}&from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudieron obtener los anuncios.");
    return { key, ads: data.ads ?? [], error: null };
  } catch (err) {
    return { key, ads: [], error: err instanceof Error ? err.message : "Error al obtener anuncios reales." };
  }
}

async function loadMock(clientId: string, dateRange: { from: string; to: string }): Promise<Result> {
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const service = getMetaAdsService();
  const [ads, adSets, campaigns] = await Promise.all([
    service.getAds(clientId),
    service.getAdSets(clientId),
    service.getCampaigns(clientId),
  ]);
  const adSetsById = new Map<string, AdSet>(adSets.map((a) => [a.id, a]));
  const campaignsById = new Map<string, Campaign>(campaigns.map((c) => [c.id, c]));

  const withMetrics = await Promise.all(
    ads.map(async (ad) => {
      const rows = await service.getDailyMetrics("ad", ad.id, dateRange);
      return {
        ...ad,
        campaignName: campaignsById.get(ad.campaignId)?.name ?? "—",
        adSetName: adSetsById.get(ad.adSetId)?.name ?? "—",
        metrics: aggregateMetrics(rows),
      };
    })
  );
  return { key, ads: withMetrics, error: null };
}

export function useAds(): { loading: boolean; ads: AdWithMetrics[]; error: string | null } {
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
    ads: result?.ads ?? [],
    error: result?.key === key ? result.error : null,
  };
}
