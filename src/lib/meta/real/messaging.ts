import "server-only";
import { MetaApiError, metaGraphGet } from "./graph-client";
import {
  buildMessagingReport,
  CONVERSATION_ACTION,
  destinationLabel,
  type MessagingInsight,
  type MessagingReport,
} from "../messaging";

interface Page<T> { data: T[]; paging?: { next?: string; cursors?: { after?: string } } }

/** Follow opaque cursors on the same account path, never a token-bearing next URL. */
async function allInsights(accountId: string, params: Record<string, string | number>): Promise<MessagingInsight[]> {
  const rows: MessagingInsight[] = [];
  const seen = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 100; page++) {
    const result = await metaGraphGet<Page<MessagingInsight>>(`/${accountId}/insights`, { ...params, after });
    if (!Array.isArray(result.data)) throw new MetaApiError("empty_response", "Meta no devolvió un informe válido de conversaciones.");
    rows.push(...result.data);
    if (!result.paging?.next) return rows;
    after = result.paging.cursors?.after;
    if (!after || seen.has(after)) throw new MetaApiError("empty_response", "Meta no permitió completar todas las páginas de conversaciones.");
    seen.add(after);
  }
  throw new MetaApiError("empty_response", "El informe de conversaciones es demasiado grande. Reduce el rango de fechas.");
}

export async function fetchMessagingReport(accountId: string, from: string, to: string): Promise<MessagingReport> {
  const baseParams = {
    fields: "campaign_id,campaign_name,actions",
    time_range: JSON.stringify({ since: from, until: to }), limit: 500,
    use_unified_attribution_setting: "true",
  };
  // Keep a clean campaign total, then request destination attribution separately.
  const totals = await allInsights(accountId, { ...baseParams, level: "campaign" });
  const destinationParams = { ...baseParams, action_breakdowns: "action_type,action_destination" };
  const levels = [
    // Meta exposes conversion destination as both a row and action breakdown.
    // Request each independently: action_destination alone omits messaging destinations.
    { level: "ad", fields: "campaign_id,campaign_name,ad_id,actions", breakdowns: "conversion_destination", action_breakdowns: "action_type" },
    { level: "ad", fields: "campaign_id,campaign_name,ad_id,actions", action_breakdowns: "action_type,conversion_destination" },
    { level: "campaign", fields: "campaign_id,campaign_name,actions" },
    { level: "adset", fields: "campaign_id,campaign_name,adset_id,actions" },
    { level: "ad", fields: "campaign_id,campaign_name,adset_id,ad_id,actions" },
  ];
  let breakdown: MessagingInsight[] = [];
  for (const query of levels) {
    try {
      const rows = await allInsights(accountId, { ...destinationParams, ...query } as Record<string, string | number>);
      // Log only the response shape and destination labels, never tokens, IDs or messages.
      const conversationActions = rows.flatMap(row => row.actions ?? []).filter(action => action.action_type === CONVERSATION_ACTION);
      console.info("[messaging-breakdown]", JSON.stringify({
        level: query.level, breakdown: query.breakdowns ?? query.action_breakdowns ?? "action_destination", rows: rows.length, conversations: conversationActions.length,
        actionKeys: [...new Set(conversationActions.flatMap(action => Object.keys(action)))],
        destinations: [...new Set(conversationActions.map(action => action.conversion_destination ?? action.action_destination ?? "missing"))],
        rowDestinations: [...new Set(rows.map(row => row.conversion_destination ?? "missing"))],
      }));
      const hasExactDestination = rows.some(row => row.actions?.some(action =>
        action.action_type === CONVERSATION_ACTION && destinationLabel(action.conversion_destination ?? row.conversion_destination ?? action.action_destination) !== "Destino no identificado"));
      if (hasExactDestination) {
        breakdown = rows;
        break;
      }
    } catch (error) {
      console.warn("[messaging-breakdown]", JSON.stringify({ level: query.level, breakdown: query.breakdowns ?? query.action_breakdowns ?? "action_destination",
        kind: error instanceof MetaApiError ? error.kind : "unexpected",
        status: error instanceof MetaApiError ? error.status : undefined,
        message: error instanceof MetaApiError ? error.message : "Unexpected breakdown failure",
      }));
      // Some accounts or date ranges reject a breakdown at a given level. Try finer levels.
    }
  }

  const warnings = breakdown.length ? [] : [
    "Meta devolvió el total de conversaciones, pero no identificó WhatsApp, Messenger o Instagram en el desglose. No se asignaron destinos usando la configuración actual de los anuncios.",
  ];
  return { campaigns: buildMessagingReport(totals, breakdown), warnings };
}
