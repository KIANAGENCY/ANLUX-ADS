import "server-only";
import type { CampaignObjective, EntityStatus } from "@/lib/types";

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

/**
 * Nunca convierte un valor desconocido en otro objetivo conocido. Si Meta
 * introduce un objetivo nuevo o lo omite, se conserva como UNKNOWN y el
 * sistema evita interpretar una acción arbitraria como “resultado”.
 */
export function mapObjective(raw: string | undefined): CampaignObjective {
  if (!raw) return "UNKNOWN";
  return OBJECTIVE_MAP[raw] ?? "UNKNOWN";
}

export function minorUnitsToAmount(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  return n / 100;
}
