import "server-only";
import type { CampaignObjective, DailyMetrics, EntityType } from "@/lib/types";
import { metaGraphGet } from "./graph-client";
import { getPrimaryResult, parseActionsArray, toNumber, type ActionBreakdownItem } from "./actions";

const INSIGHTS_FIELDS = "spend,impressions,reach,frequency,clicks,cpc,cpm,ctr,actions,cost_per_action_type";

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
}

interface InsightsResponse {
  data: RawInsightsRow[];
}

type InsightsLevel = "account" | "campaign" | "adset" | "ad";

async function fetchInsights(
  adAccountId: string,
  level: InsightsLevel,
  since: string,
  until: string,
  timeIncrement?: 1
): Promise<RawInsightsRow[]> {
  const params: Record<string, string | number> = {
    level,
    fields: INSIGHTS_FIELDS,
    time_range: JSON.stringify({ since, until }),
    limit: 500,
  };
  if (timeIncrement) params.time_increment = timeIncrement;

  const res = await metaGraphGet<InsightsResponse>(`/${adAccountId}/insights`, params);
  return res.data ?? [];
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
