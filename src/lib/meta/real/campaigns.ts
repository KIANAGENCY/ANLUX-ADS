import "server-only";
import type { Campaign } from "@/lib/types";
import { metaGraphGet } from "./graph-client";
import { mapEffectiveStatus, mapObjective, minorUnitsToAmount } from "./mapping";

interface RawCampaign {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

interface CampaignsResponse {
  data: RawCampaign[];
}

export async function fetchRealCampaigns(adAccountId: string): Promise<Campaign[]> {
  const res = await metaGraphGet<CampaignsResponse>(`/${adAccountId}/campaigns`, {
    fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget",
    limit: 500,
  });

  return (res.data ?? []).map((c) => ({
    id: c.id,
    adAccountId,
    name: c.name,
    status: mapEffectiveStatus(c.effective_status ?? c.status),
    effectiveStatus: c.effective_status,
    objective: mapObjective(c.objective),
    rawObjective: c.objective,
    dailyBudget: minorUnitsToAmount(c.daily_budget),
    lifetimeBudget: minorUnitsToAmount(c.lifetime_budget),
  }));
}

/** Versión ligera usada internamente para asociar cada campaña a su objetivo (ver `overview.ts`). */
export async function fetchCampaignObjectives(adAccountId: string): Promise<Map<string, ReturnType<typeof mapObjective>>> {
  const res = await metaGraphGet<{ data: { id: string; objective?: string }[] }>(`/${adAccountId}/campaigns`, {
    fields: "id,objective",
    limit: 500,
  });
  const map = new Map<string, ReturnType<typeof mapObjective>>();
  for (const c of res.data ?? []) {
    map.set(c.id, mapObjective(c.objective));
  }
  return map;
}
