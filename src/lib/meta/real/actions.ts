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

export const MESSAGING_CONVERSATION_ACTION = "onsite_conversion.messaging_conversation_started_7d";

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
 *
 * Meta puede clasificar una campaña click-to-message bajo OUTCOME_SALES/CONVERSIONS.
 * En esos casos el evento verificable de conversación iniciada es un resultado válido
 * cuando no existe una compra. La prioridad sigue siendo compra > conversación para
 * no reemplazar una venta real por una interacción de mensajería.
 */
const PRIMARY_ACTION_TYPES_BY_OBJECTIVE: Record<CampaignObjective, string[]> = {
  LEAD_GENERATION: ["lead", "onsite_conversion.lead_grouped"],
  MESSAGES: [MESSAGING_CONVERSATION_ACTION],
  CONVERSIONS: [
    "offsite_conversion.fb_pixel_purchase",
    "omni_purchase",
    "purchase",
    MESSAGING_CONVERSATION_ACTION,
  ],
  SALES: [
    "offsite_conversion.fb_pixel_purchase",
    "omni_purchase",
    "purchase",
    MESSAGING_CONVERSATION_ACTION,
  ],
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

/** Distinguishes purchases from messaging results under SALES/CONVERSIONS. */
export function getPrimaryResultType(actions: ActionBreakdownItem[], objective: CampaignObjective): string | null {
  return PRIMARY_ACTION_TYPES_BY_OBJECTIVE[objective].find((type) => actions.some((item) => item.actionType === type)) ?? null;
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
