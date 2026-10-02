/** Conversations are separate from clicks, contacts and individual chat messages. */
export const CONVERSATION_ACTION = "onsite_conversion.messaging_conversation_started_7d";

export interface MessagingAction {
  action_type: string;
  value?: string | number;
  action_destination?: string;
}

export interface MessagingDetail {
  destination: string;
  conversations: number | null;
}

export interface CampaignMessaging {
  campaignId: string;
  campaignName: string;
  conversations: number | null;
  details: MessagingDetail[];
}

export interface MessagingReport {
  campaigns: CampaignMessaging[];
  warnings: string[];
}

export function conversationCount(actions?: MessagingAction[]): number | null {
  const items = actions?.filter(a => a.action_type === CONVERSATION_ACTION) ?? [];
  if (!items.length) return null;
  let total = 0;
  for (const item of items) {
    if (item.value === undefined || item.value === "" || item.value === null) return null;
    const value = Number(item.value);
    if (!Number.isFinite(value) || value < 0) return null;
    total += value;
  }
  return total;
}

export function destinationLabel(value?: string): string {
  const key = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (key === "whatsapp" || key === "whats_app") return "WhatsApp";
  if (key === "messenger" || key === "facebook_messenger") return "Messenger";
  if (["instagram_direct", "instagram", "ig_direct", "instagram_messaging"].includes(key ?? "")) return "Instagram Direct";
  return "Destino no identificado";
}

export interface MessagingInsight {
  campaign_id?: string;
  ad_id?: string;
  adset_id?: string;
  campaign_name?: string;
  actions?: MessagingAction[];
}

/** Only exact conversation events are grouped; totals never get added to their breakdown. */
export function buildMessagingReport(
  totals: MessagingInsight[],
  breakdown: MessagingInsight[],
): CampaignMessaging[] {
  const campaigns = new Map<string, CampaignMessaging>();
  for (const row of totals) {
    if (!row.campaign_id) throw new Error("Meta devolvió una fila sin campaña.");
    if (campaigns.has(row.campaign_id)) throw new Error("Meta devolvió totales duplicados de una campaña.");
    campaigns.set(row.campaign_id, {
      campaignId: row.campaign_id, campaignName: row.campaign_name ?? row.campaign_id,
      conversations: conversationCount(row.actions), details: [],
    });
  }
  for (const row of breakdown) {
    if (!row.campaign_id) throw new Error("Meta devolvió un desglose sin campaña.");
    const campaign = campaigns.get(row.campaign_id);
    if (!campaign) continue;
    const groups = new Map<string, MessagingAction[]>();
    for (const action of row.actions ?? []) {
      if (action.action_type !== CONVERSATION_ACTION) continue;
      const destination = destinationLabel(action.action_destination);
      // Do not assign a historic result to the ad set's current destination.
      if (destination === "Destino no identificado") continue;
      const groupKey = destination;
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), action]);
    }
    for (const [destination, actions] of groups) {
      const count = conversationCount(actions);
      const existing = campaign.details.find(d => d.destination === destination);
      if (existing) existing.conversations = existing.conversations === null || count === null ? null : existing.conversations + count;
      else campaign.details.push({ destination, conversations: count });
    }
  }
  return [...campaigns.values()];
}
