import "server-only";
import type { AdSet, CampaignObjective } from "@/lib/types";
import { metaGraphGet } from "./graph-client";
import { mapEffectiveStatus, mapObjective, minorUnitsToAmount } from "./mapping";

interface RawAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  campaign?: { name?: string; objective?: string };
}

interface AdSetsResponse {
  data: RawAdSet[];
}

export interface RealAdSet extends AdSet {
  campaignName: string;
  /** Objetivo de la campaña propietaria — necesario para interpretar `actions` en insights.ts. No se expone en la UI directamente. */
  campaignObjective: CampaignObjective;
}

export async function fetchRealAdSets(adAccountId: string): Promise<RealAdSet[]> {
  const res = await metaGraphGet<AdSetsResponse>(`/${adAccountId}/adsets`, {
    fields:
      "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,campaign{name,objective}",
    limit: 500,
  });

  return (res.data ?? []).map((a) => ({
    id: a.id,
    campaignId: a.campaign_id,
    name: a.name,
    status: mapEffectiveStatus(a.effective_status ?? a.status),
    effectiveStatus: a.effective_status,
    dailyBudget: minorUnitsToAmount(a.daily_budget),
    lifetimeBudget: minorUnitsToAmount(a.lifetime_budget),
    audience: "—",
    optimizationGoal: a.optimization_goal ?? "—",
    campaignName: a.campaign?.name ?? "—",
    campaignObjective: mapObjective(a.campaign?.objective),
  }));
}
