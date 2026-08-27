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

/** Convierte de forma segura el string numérico que devuelve Meta a `number`. */
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
 * Acción "primaria" que Meta asocia a cada objetivo — usada para interpretar
 * `actions`/`cost_per_action_type` como un único número de "Resultados".
 *
 * Deliberadamente NO sumamos todos los `action_type` de la respuesta: son
 * tipos heterogéneos (link_click, lead, post_engagement, purchase...) y
 * sumarlos daría una cifra sin significado de negocio. En su lugar se busca,
 * en orden, el/los action_type que Meta considera el resultado principal
 * para ese objetivo; si ninguno aparece en la respuesta, se devuelve `null`
 * — nunca se fabrica un valor.
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
};

function findPrimaryValue(items: ActionBreakdownItem[], objective: CampaignObjective): number | null {
  const candidates = PRIMARY_ACTION_TYPES_BY_OBJECTIVE[objective] ?? [];
  for (const type of candidates) {
    const match = items.find((item) => item.actionType === type);
    if (match) return match.value;
  }
  return null;
}

/** `null` cuando el action_type "resultado" de este objetivo no viene en la respuesta. */
export function getPrimaryResult(actions: ActionBreakdownItem[], objective: CampaignObjective): number | null {
  return findPrimaryValue(actions, objective);
}

/** `null` cuando el action_type "resultado" de este objetivo no viene en cost_per_action_type. */
export function getPrimaryCostPerResult(
  costPerActionType: ActionBreakdownItem[],
  objective: CampaignObjective
): number | null {
  return findPrimaryValue(costPerActionType, objective);
}
