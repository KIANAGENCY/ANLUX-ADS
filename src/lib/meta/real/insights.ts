import "server-only";
import type { CampaignObjective, DailyMetrics, EntityType } from "@/lib/types";
import { metaGraphGet } from "./graph-client";
import { getPrimaryResult, parseActionsArray, toNumber, type ActionBreakdownItem } from "./actions";

const BASE_INSIGHTS_FIELDS = "spend,impressions,reach,frequency,clicks,cpc,cpm,ctr,actions,cost_per_action_type,action_values,purchase_roas";

interface RawActionItem {
  action_type: string;
  value: string;
}

export interface RawInsightsRow {
  date_start?: string;
  date_stop?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: RawActionItem[];
  cost_per_action_type?: RawActionItem[];
  action_values?: RawActionItem[];
  purchase_roas?: RawActionItem[];
}

interface InsightsResponse {
  data: RawInsightsRow[];
  paging?: { next?: string; cursors?: { after?: string } };
}

type InsightsLevel = "account" | "campaign" | "adset" | "ad";

function fieldsForLevel(level: InsightsLevel): string {
  if (level === "campaign") return `campaign_id,${BASE_INSIGHTS_FIELDS}`;
  if (level === "adset") return `campaign_id,adset_id,${BASE_INSIGHTS_FIELDS}`;
  if (level === "ad") return `campaign_id,adset_id,ad_id,${BASE_INSIGHTS_FIELDS}`;
  return BASE_INSIGHTS_FIELDS;
}

async function fetchInsights(
  adAccountId: string,
  level: InsightsLevel,
  since: string,
  until: string,
  timeIncrement?: 1
): Promise<RawInsightsRow[]> {
  const baseParams: Record<string, string | number> = {
    level,
    fields: fieldsForLevel(level),
    time_range: JSON.stringify({ since, until }),
    limit: 500,
  };
  if (timeIncrement) baseParams.time_increment = timeIncrement;

  const rows: RawInsightsRow[] = [];
  const seen = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 100; page++) {
    const res = await metaGraphGet<InsightsResponse>(`/${adAccountId}/insights`, { ...baseParams, after });
    rows.push(...(res.data ?? []));
    if (!res.paging?.next) return rows;
    after = res.paging.cursors?.after;
    if (!after || seen.has(after)) throw new Error("Meta no permitió completar todas las páginas de insights.");
    seen.add(after);
  }
  throw new Error("El informe de insights es demasiado grande. Reduce el rango de fechas.");
}

/** Insights diarios a nivel de cuenta, usados exclusivamente para la serie temporal. */
export function fetchAccountDailyInsights(adAccountId: string, since: string, until: string) {
  return fetchInsights(adAccountId, "account", since, until, 1);
}

/**
 * Insight agregado de cuenta para TODO el rango. Esta es la fuente correcta
 * para reach/frequency del periodo: sumar reach diario duplicaría personas que
 * fueron alcanzadas en más de un día.
 */
export async function fetchAccountAggregatedInsight(
  adAccountId: string,
  since: string,
  until: string
): Promise<RawInsightsRow | null> {
  const rows = await fetchInsights(adAccountId, "account", since, until);
  return rows[0] ?? null;
}

/** Insights diarios a nivel de campaña — usados para interpretar `actions` por campaña (ver `overview.ts`). */
export function fetchCampaignDailyInsights(adAccountId: string, since: string, until: string) {
  return fetchInsights(adAccountId, "campaign", since, until, 1);
}

/** Insights agregados (todo el rango en una sola fila por entidad) a nivel de campaña/ad set/anuncio. */
export async function fetchAggregatedInsightsByEntity(
  adAccountId: string,
  level: "campaign" | "adset" | "ad",
  since: string,
  until: string
): Promise<Map<string, RawInsightsRow>> {
  const rows = await fetchInsights(adAccountId, level, since, until);
  const idField = level === "campaign" ? "campaign_id" : level === "adset" ? "adset_id" : "ad_id";
  const map = new Map<string, RawInsightsRow>();
  for (const row of rows) {
    const id = row[idField];
    if (id) map.set(id, row);
  }
  return map;
}

export function hasPrimaryResult(row: RawInsightsRow, objective: CampaignObjective): boolean {
  return getPrimaryResult(parseActionsArray(row.actions), objective) !== null;
}

const PURCHASE_ACTION_TYPES = new Set(["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"]);

function optionalPurchaseValue(items: RawActionItem[] | undefined): number | null {
  const purchase = items?.find((item) => PURCHASE_ACTION_TYPES.has(item.action_type));
  if (!purchase) return null;
  const value = Number(purchase.value);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function extractRevenueAndRoas(row: RawInsightsRow): Pick<DailyMetrics, "revenue" | "roas"> {
  return {
    revenue: optionalPurchaseValue(row.action_values),
    roas: optionalPurchaseValue(row.purchase_roas),
  };
}

/** Convierte una fila de insights de entidad a métricas normalizadas. */
export function mapInsightsRowToDailyMetrics(
  row: RawInsightsRow,
  entityId: string,
  entityType: EntityType,
  objective: CampaignObjective,
  fallbackDate: string
): DailyMetrics {
  const actions = parseActionsArray(row.actions);
  const results = getPrimaryResult(actions, objective) ?? 0;

  return {
    date: row.date_start ?? fallbackDate,
    entityId,
    entityType,
    spend: toNumber(row.spend),
    impressions: toNumber(row.impressions),
    reach: toNumber(row.reach),
    clicks: toNumber(row.clicks),
    results,
    ...extractRevenueAndRoas(row),
  };
}

export function extractActionsFromRow(row: RawInsightsRow): {
  actions: ActionBreakdownItem[];
  costPerActionType: ActionBreakdownItem[];
} {
  return {
    actions: parseActionsArray(row.actions),
    costPerActionType: parseActionsArray(row.cost_per_action_type),
  };
}

