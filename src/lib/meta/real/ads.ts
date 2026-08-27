import "server-only";
import type { Ad, CampaignObjective } from "@/lib/types";
import { metaGraphGet } from "./graph-client";
import { mapEffectiveStatus, mapObjective } from "./mapping";

interface RawAd {
  id: string;
  name: string;
  adset_id: string;
  campaign_id: string;
  status?: string;
  effective_status?: string;
  campaign?: { name?: string; objective?: string };
  adset?: { name?: string };
}

interface AdsResponse {
  data: RawAd[];
}

export interface RealAd extends Ad {
  campaignName: string;
  adSetName: string;
  /** Objetivo de la campaña propietaria — necesario para interpretar `actions` en insights.ts. */
  campaignObjective: CampaignObjective;
}

/** Gradiente neutro para el placeholder visual: Meta no expone un "color de marca" por anuncio. */
const REAL_AD_PREVIEW_GRADIENT = "from-indigo-500 to-purple-600";

export async function fetchRealAds(adAccountId: string): Promise<RealAd[]> {
  const res = await metaGraphGet<AdsResponse>(`/${adAccountId}/ads`, {
    fields: "id,name,adset_id,campaign_id,status,effective_status,campaign{name,objective},adset{name}",
    limit: 500,
  });

  return (res.data ?? []).map((a) => ({
    id: a.id,
    adSetId: a.adset_id,
    campaignId: a.campaign_id,
    name: a.name,
    status: mapEffectiveStatus(a.effective_status ?? a.status),
    effectiveStatus: a.effective_status,
    // Meta no expone el tipo de creativo en estos campos sin una llamada adicional
    // al objeto de creativo; se usa un valor genérico para el ícono de la UI.
    creativeType: "IMAGE",
    previewGradient: REAL_AD_PREVIEW_GRADIENT,
    campaignName: a.campaign?.name ?? "—",
    adSetName: a.adset?.name ?? "—",
    campaignObjective: mapObjective(a.campaign?.objective),
  }));
}
