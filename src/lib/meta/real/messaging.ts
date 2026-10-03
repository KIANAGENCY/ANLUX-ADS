import "server-only";
import { MetaApiError, metaGraphGet } from "./graph-client";
import {
  buildMessagingReport,
  CONVERSATION_ACTION,
  type MessagingInsight,
  type MessagingReport,
} from "../messaging";

interface Page<T> { data: T[]; paging?: { next?: string; cursors?: { after?: string } } }

/** Follow opaque cursors on the same account path, never a token-bearing next URL. */
async function allInsights(accountId: string, params: Record<string, string | number>, signal?: AbortSignal): Promise<MessagingInsight[]> {
  const rows: MessagingInsight[] = [];
  const seen = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 100; page++) {
    const result = await metaGraphGet<Page<MessagingInsight>>(`/${accountId}/insights`, { ...params, after }, signal);
    if (!Array.isArray(result.data)) throw new MetaApiError("empty_response", "Meta no devolvió un informe válido de conversaciones.");
    rows.push(...result.data);
    if (!result.paging?.next) return rows;
    after = result.paging.cursors?.after;
    if (!after || seen.has(after)) throw new MetaApiError("empty_response", "Meta no permitió completar todas las páginas de conversaciones.");
    seen.add(after);
  }
  throw new MetaApiError("empty_response", "El informe de conversaciones es demasiado grande. Reduce el rango de fechas.");
}

export async function fetchMessagingReport(accountId: string, from: string, to: string, signal?: AbortSignal): Promise<MessagingReport> {
  const baseParams = {
    fields: "campaign_id,campaign_name,actions",
    time_range: JSON.stringify({ since: from, until: to }), limit: 500,
    use_unified_attribution_setting: "true",
  };
  // Keep a clean campaign total, then request destination attribution separately.
  const totals = await allInsights(accountId, { ...baseParams, level: "campaign" }, signal);
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
  let campaigns = buildMessagingReport(totals, []);
  for (const query of levels) {
    try {
      const rows = await allInsights(accountId, {
        ...destinationParams, ...query,
        fields: query.fields.replace(/actions$/, "actions{action_type,value,action_destination,action_event_channel,action_link_click_destination}"),
      } as Record<string, string | number>, signal);
      // Log only the response shape and destination labels, never tokens, IDs or messages.
      const conversationActions = rows.flatMap(row => row.actions ?? []).filter(action => action.action_type === CONVERSATION_ACTION);
      console.info("[messaging-breakdown]", JSON.stringify({
        level: query.level, breakdown: query.breakdowns ?? query.action_breakdowns ?? "action_destination", rows: rows.length, conversations: conversationActions.length,
        actionKeys: [...new Set(conversationActions.flatMap(action => Object.keys(action)))],
        destinations: [...new Set(conversationActions.map(action => action.conversion_destination ?? action.action_destination ?? "missing"))],
        rowDestinations: [...new Set(rows.map(row => row.conversion_destination ?? "missing"))],
        channels: [...new Set(conversationActions.map(action => (action as unknown as Record<string, unknown>).action_event_channel ?? "missing"))],
        clickDestinations: [...new Set(conversationActions.map(action => (action as unknown as Record<string, unknown>).action_link_click_destination ?? "missing"))],
      }));
      const candidate = buildMessagingReport(totals, rows);
      // Pick one independent response per campaign. Never sum overlapping queries.
      campaigns = campaigns.map(current => {
        const next = candidate.find(campaign => campaign.campaignId === current.campaignId)!;
        if (current.attributionStatus === "complete") return current;
        if (next.attributionStatus === "complete") return next;
        const known = (campaign: typeof current) => campaign.details.reduce((sum, detail) => sum + (detail.conversations ?? 0), 0);
        if (known(next) > known(current)) return next;
        if (current.attributionStatus === "unavailable" && next.attributionStatus === "inconsistent") return next;
        return current;
      });
      if (campaigns.every(campaign => campaign.conversations === 0 || campaign.attributionStatus === "complete")) break;
    } catch (error) {
      if (signal?.aborted) throw error;
      console.warn("[messaging-breakdown]", JSON.stringify({ level: query.level, breakdown: query.breakdowns ?? query.action_breakdowns ?? "action_destination",
        kind: error instanceof MetaApiError ? error.kind : "unexpected",
        status: error instanceof MetaApiError ? error.status : undefined,
        message: error instanceof MetaApiError ? error.message : "Unexpected breakdown failure",
      }));
      // Some accounts or date ranges reject a breakdown at a given level. Try finer levels.
    }
  }

  const warnings = campaigns.filter(campaign => campaign.attributionStatus !== "complete" && campaign.conversations !== 0).map(campaign =>
    campaign.attributionStatus === "inconsistent"
      ? `${campaign.campaignName}: el desglose de Meta no coincide con el total. Se conservó el total y se descartó el desglose incompatible.`
      : `${campaign.campaignName}: Meta no identificó el destino de ${campaign.unattributedConversations ?? "las"} conversaciones. No se asignaron destinos usando la configuración actual de los anuncios.`);
  return { campaigns, warnings };
}
