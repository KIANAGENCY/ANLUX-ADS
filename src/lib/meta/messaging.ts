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
  destinationBasis?: "reported" | "configured" | "unknown";
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
  const key = value?.trim().toLowerCase();
  if (key === "whatsapp") return "WhatsApp";
  if (key === "messenger") return "Messenger";
  if (key === "instagram_direct" || key === "instagram") return "Instagram Direct";
  return "Destino no identificado";
}

/** Current delivery configuration is context, not historical result attribution. */
export function configuredDestinationLabel(type?: string, whatsapp = false): string | undefined {
  const key = type?.trim().toUpperCase();
  const multiple: Record<string, string> = {
    MESSAGING_INSTAGRAM_DIRECT_MESSENGER: "Instagram Direct / Messenger",
    MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP: "Instagram Direct / Messenger / WhatsApp",
    MESSAGING_INSTAGRAM_DIRECT_WHATSAPP: "Instagram Direct / WhatsApp",
    MESSAGING_MESSENGER_WHATSAPP: "Messenger / WhatsApp",
  };
  if (key && multiple[key]) return multiple[key];
  const label = destinationLabel(type);
  if (label !== "Destino no identificado") return label;
  if (!key && whatsapp) return "WhatsApp";
  return undefined;
}

export function sourceLabel(value?: string): string {
  const labels: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", messenger: "Messenger", audience_network: "Audience Network", threads: "Threads" };
  return value ? labels[value] ?? "Origen no identificado" : "Origen no desglosado";
}

export interface MessagingInsight {
  campaign_id?: string;
  adset_id?: string;
  configuredDestination?: string;
  campaign_name?: string;
  publisher_platform?: string;
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
      const reported = destinationLabel(action.action_destination);
      const destination = reported === "Destino no identificado" ? row.configuredDestination ?? reported : reported;
      const basis = reported !== "Destino no identificado" ? "reported" : row.configuredDestination ? "configured" : "unknown";
      const groupKey = JSON.stringify([destination, basis]);
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), action]);
    }
    for (const [groupKey, actions] of groups) {
      const [destination, destinationBasis] = JSON.parse(groupKey) as [string, MessagingDetail["destinationBasis"]];
      const source = sourceLabel(row.publisher_platform);
      const count = conversationCount(actions);
      const existing = campaign.details.find(d => d.source === source && d.destination === destination && d.destinationBasis === destinationBasis);
      if (existing) existing.conversations = existing.conversations === null || count === null ? null : existing.conversations + count;
      else campaign.details.push({ source, destination, destinationBasis, conversations: count });
    }
  }
  return [...campaigns.values()];
}
