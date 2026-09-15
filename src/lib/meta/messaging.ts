/** Conversations are separate from clicks, contacts and individual chat messages. */
export const CONVERSATION_ACTION = "onsite_conversion.messaging_conversation_started_7d";

export interface MessagingAction {
  action_type: string;
  value?: string | number;
  action_destination?: string;
}

export interface MessagingDetail {
  source: string;
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
  const key = value?.toLowerCase();
  if (key === "whatsapp") return "WhatsApp";
  if (key === "messenger") return "Messenger";
  if (key === "instagram_direct" || key === "instagram") return "Instagram Direct";
  return "Destino no identificado";
}

export function sourceLabel(value?: string): string {
  const labels: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", messenger: "Messenger", audience_network: "Audience Network", threads: "Threads" };
  return value ? labels[value] ?? "Origen no identificado" : "Origen no desglosado";
}

export interface MessagingInsight {
  campaign_id?: string;
  campaign_name?: string;
  publisher_platform?: string;
  actions?: MessagingAction[];
}

/** Reemplaza un destino desconocido solo con metadata verificada del ad set/campaña. */
export function applyInferredDestinations(
  campaigns: CampaignMessaging[],
  destinationByCampaign: Map<string, string>
): CampaignMessaging[] {
  return campaigns.map((campaign) => {
    const inferred = destinationByCampaign.get(campaign.campaignId);
    if (!inferred) return campaign;
    return {
      ...campaign,
      details: campaign.details.map((detail) =>
        detail.destination === "Destino no identificado" ? { ...detail, destination: inferred } : detail
      ),
    };
  });
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
      groups.set(destination, [...(groups.get(destination) ?? []), action]);
    }
    for (const [destination, actions] of groups) {
      const source = sourceLabel(row.publisher_platform);
      const count = conversationCount(actions);
      const existing = campaign.details.find(d => d.source === source && d.destination === destination);
      if (existing) existing.conversations = existing.conversations === null || count === null ? null : existing.conversations + count;
      else campaign.details.push({ source, destination, conversations: count });
    }
  }
  return [...campaigns.values()];
}
