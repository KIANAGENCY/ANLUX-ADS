import "server-only";
import { MetaApiError, metaGraphGet } from "./graph-client";
import { buildMessagingReport, type MessagingInsight, type MessagingReport } from "../messaging";

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
  const params = {
    level: "campaign", fields: "campaign_id,campaign_name,actions",
    time_range: JSON.stringify({ since: from, until: to }), limit: 500,
    use_unified_attribution_setting: "true",
  };
  // A breakdown failure must not erase the independent campaign totals.
  const totals = await allInsights(accountId, params);
  let breakdown: MessagingInsight[] = [];
  const warnings: string[] = [];
  try {
    breakdown = await allInsights(accountId, {
      ...params, breakdowns: "publisher_platform", action_breakdowns: "action_type,action_destination",
    });
  } catch {
    warnings.push("Meta no permitió el desglose conjunto por origen y destino. Se muestran los totales por campaña.");
    try {
      breakdown = await allInsights(accountId, { ...params, action_breakdowns: "action_type,action_destination" });
    } catch {
      warnings.push("El destino tampoco está disponible para este periodo.");
    }
  }
  return { campaigns: buildMessagingReport(totals, breakdown), warnings };
}
