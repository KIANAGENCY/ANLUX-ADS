import "server-only";
import type { CampaignObjective } from "@/lib/types";

export interface ActionBreakdownItem {
  actionType: string;
  value: number;
}

interface RawActionItem {
  action_type: string;
  value: string;
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function parseActionsArray(raw: RawActionItem[] | undefined): ActionBreakdownItem[] {
  if (!raw) return [];
  return raw.map((a) => ({ actionType: a.action_type, value: toNumber(a.value) }));
}

/**
 * Acción primaria por objetivo. UNKNOWN deliberadamente no tiene candidatos:
 * si el objetivo no se conoce, no se interpreta una acción arbitraria como resultado.
 */
const PRIMARY_ACTION_TYPES_BY_OBJECTIVE: Record<CampaignObjective, string[]> = {
  LEAD_GENERATION: ["lead", "onsite_conversion.lead_grouped"],
  MESSAGES: [
    "onsite_conversion.messaging_conversation_started_7d",
    "onsite_conversion.total_messaging_connection",
  ],
  CONVERSIONS: ["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"],
  SALES: ["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"],
  TRAFFIC: ["link_click"],
  BRAND_AWARENESS: ["post_engagement"],
  UNKNOWN: [],
};

function findPrimaryValue(items: ActionBreakdownItem[], objective: CampaignObjective): number | null {
  const candidates = PRIMARY_ACTION_TYPES_BY_OBJECTIVE[objective];
  for (const type of candidates) {
    const match = items.find((item) => item.actionType === type);
    if (match) return match.value;
  }
  return null;
}

export function getPrimaryResult(actions: ActionBreakdownItem[], objective: CampaignObjective): number | null {
  return findPrimaryValue(actions, objective);
}

export function getPrimaryCostPerResult(
  costPerActionType: ActionBreakdownItem[],
  objective: CampaignObjective
): number | null {
  return findPrimaryValue(costPerActionType, objective);
}
