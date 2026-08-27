import "server-only";
import type { CampaignObjective, EntityStatus } from "@/lib/types";

/**
 * Mapea `effective_status` (o, en su defecto, `status`) de Meta a nuestro
 * `EntityStatus` cerrado. Se prefiere `effective_status` porque refleja el
 * estado real de entrega (una campaña con `status: ACTIVE` pero con la
 * cuenta pausada puede tener `effective_status: ACCOUNT_PAUSED`).
 */
export function mapEffectiveStatus(raw: string | undefined): EntityStatus {
  switch (raw) {
    case "ACTIVE":
      return "ACTIVE";
    case "PAUSED":
    case "CAMPAIGN_PAUSED":
    case "ADSET_PAUSED":
    case "ACCOUNT_PAUSED":
      return "PAUSED";
    case "PENDING_REVIEW":
    case "PENDING_BILLING_INFO":
    case "IN_PROCESS":
    case "WITH_ISSUES":
    case "CAMPAIGN_PENDING_REVIEW":
    case "ADSET_PENDING_REVIEW":
      return "IN_REVIEW";
    case "DELETED":
    case "ARCHIVED":
    case "DISAPPROVED":
    default:
      return "ARCHIVED";
  }
}

/**
 * Bucket del objetivo de Meta (cubre tanto los `OUTCOME_*` actuales como los
 * legados) a nuestro `CampaignObjective` cerrado, usado solo para elegir
 * etiqueta y la acción "resultado" primaria (ver `actions.ts`). El valor
 * crudo de Meta se conserva siempre en `Campaign.rawObjective` — nunca se
 * pierde, solo se agrupa para la UI.
 */
const OBJECTIVE_MAP: Record<string, CampaignObjective> = {
  OUTCOME_LEADS: "LEAD_GENERATION",
  LEAD_GENERATION: "LEAD_GENERATION",
  OUTCOME_ENGAGEMENT: "MESSAGES",
  MESSAGES: "MESSAGES",
  OUTCOME_SALES: "CONVERSIONS",
  CONVERSIONS: "CONVERSIONS",
  PRODUCT_CATALOG_SALES: "SALES",
  STORE_VISITS: "SALES",
  OUTCOME_TRAFFIC: "TRAFFIC",
  LINK_CLICKS: "TRAFFIC",
  TRAFFIC: "TRAFFIC",
  OUTCOME_AWARENESS: "BRAND_AWARENESS",
  BRAND_AWARENESS: "BRAND_AWARENESS",
  REACH: "BRAND_AWARENESS",
  OUTCOME_APP_PROMOTION: "CONVERSIONS",
  APP_INSTALLS: "CONVERSIONS",
};

export function mapObjective(raw: string | undefined): CampaignObjective {
  if (!raw) return "TRAFFIC";
  return OBJECTIVE_MAP[raw] ?? "TRAFFIC";
}

/**
 * `daily_budget` / `lifetime_budget` de Meta se devuelven en la unidad menor
 * de la moneda (p. ej. centavos para USD) — convención documentada
 * históricamente en Marketing API. Distinto de los campos de Insights como
 * `spend`, que ya vienen en la unidad principal (ver `insights.ts`).
 * Verifica este comportamiento contra la documentación vigente de tu versión
 * de Graph API si algo no cuadra con lo que ves en Ads Manager.
 */
export function minorUnitsToAmount(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  return n / 100;
}
