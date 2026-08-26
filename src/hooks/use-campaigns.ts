"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import { getMetaAdsService } from "@/lib/meta";
import type { Campaign, PerformanceMetrics } from "@/lib/types";
import { aggregateMetrics } from "@/lib/utils/metrics";

export interface CampaignWithMetrics extends Campaign {
  metrics: PerformanceMetrics;
}

interface Result {
  key: string;
  campaigns: CampaignWithMetrics[];
}

export function useCampaigns(): { loading: boolean; campaigns: CampaignWithMetrics[] } {
  const { clientId, dateRange } = useFilters();
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const service = getMetaAdsService();
      const campaigns = await service.getCampaigns(clientId);
      const withMetrics = await Promise.all(
        campaigns.map(async (campaign) => {
          const rows = await service.getDailyMetrics("campaign", campaign.id, dateRange);
          return { ...campaign, metrics: aggregateMetrics(rows) };
        })
      );
      if (cancelled) return;
      setResult({ key, campaigns: withMetrics });
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, dateRange.from, dateRange.to]);

  return { loading: result?.key !== key, campaigns: result?.campaigns ?? [] };
}
