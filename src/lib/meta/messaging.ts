/** Conversations are separate from clicks, contacts and individual chat messages. */
export const CONVERSATION_ACTION = "onsite_conversion.messaging_conversation_started_7d";

export interface MessagingAction {
  action_type: string;
  value?: string | number;
  action_destination?: string;
  conversion_destination?: string;
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
  attributionStatus: "complete" | "partial" | "unavailable" | "inconsistent";
  unattributedConversations: number | null;
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
  conversion_destination?: string;
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
      attributionStatus: "unavailable", unattributedConversations: null,
    });
  }
  for (const row of breakdown) {
    if (!row.campaign_id) throw new Error("Meta devolvió un desglose sin campaña.");
    const campaign = campaigns.get(row.campaign_id);
    if (!campaign) continue;
    const groups = new Map<string, MessagingAction[]>();
    for (const action of row.actions ?? []) {
      if (action.action_type !== CONVERSATION_ACTION) continue;
      const destination = destinationLabel(action.conversion_destination ?? row.conversion_destination ?? action.action_destination);
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
  for (const campaign of campaigns.values()) {
    const total = campaign.conversations;
    const known = campaign.details.reduce((sum, detail) => sum + (detail.conversations ?? 0), 0);
    const invalid = campaign.details.some(detail => detail.conversations === null);
    if (total === null) continue;
    if (known > total || invalid) {
      // An incompatible breakdown must never display duplicated channel totals.
      campaign.attributionStatus = "inconsistent";
      campaign.details = [];
      campaign.unattributedConversations = total;
    } else {
      campaign.unattributedConversations = total - known;
      campaign.attributionStatus = known === total ? "complete" : known > 0 ? "partial" : "unavailable";
    }
  }
  return [...campaigns.values()];
}

/** Sanitized evidence from a live response; absence of events is not verification. */
export function messagingContract(report: MessagingReport) {
  const withEvents = report.campaigns.filter(campaign => (campaign.conversations ?? 0) > 0);
  const complete = withEvents.filter(campaign => campaign.attributionStatus === "complete").length;
  return {
    state: withEvents.some(campaign => campaign.attributionStatus === "inconsistent") ? "inconsistent" as const
      : report.campaigns.some(campaign => campaign.conversations === null) ? "unavailable" as const
      : withEvents.length === 0 ? "no_observations" as const
      : complete === withEvents.length ? "verified" as const : "incomplete" as const,
    campaignsWithEvents: withEvents.length,
    campaignsComplete: complete,
  };
}
