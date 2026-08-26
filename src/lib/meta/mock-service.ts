import type { Ad, AdSet, Campaign, Client, DateRange, DailyMetrics, EntityType } from "@/lib/types";
import { MOCK_ADS, MOCK_AD_SETS, MOCK_CAMPAIGNS, MOCK_CLIENTS, MOCK_AD_ACCOUNTS } from "@/lib/mock/entities";
import { getAggregatedDailyMetrics, getAllAdDailyMetrics } from "@/lib/mock/metrics-generator";
import type { IMetaAdsService } from "./service";

/** Pequeña latencia simulada para que los estados de carga (skeletons) tengan sentido. */
function simulateLatency<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function filterByRange(rows: DailyMetrics[], range: DateRange): DailyMetrics[] {
  return rows.filter((r) => r.date >= range.from && r.date <= range.to);
}

/**
 * Implementación de `IMetaAdsService` respaldada por datos generados
 * localmente (ver `lib/mock/`). No realiza ninguna llamada de red.
 *
 * Se usa mientras no haya credenciales reales de Meta configuradas —
 * ver `lib/meta/index.ts` para el criterio de selección de adaptador.
 */
export class MockMetaAdsService implements IMetaAdsService {
  async getClients(): Promise<Client[]> {
    return simulateLatency(MOCK_CLIENTS);
  }

  async getClient(clientId: string): Promise<Client | undefined> {
    return simulateLatency(MOCK_CLIENTS.find((c) => c.id === clientId));
  }

  async getCampaigns(clientId: string): Promise<Campaign[]> {
    const account = MOCK_AD_ACCOUNTS.find((a) => a.clientId === clientId);
    if (!account) return simulateLatency([]);
    return simulateLatency(MOCK_CAMPAIGNS.filter((c) => c.adAccountId === account.id));
  }

  async getCampaign(campaignId: string): Promise<Campaign | undefined> {
    return simulateLatency(MOCK_CAMPAIGNS.find((c) => c.id === campaignId));
  }

  async getAdSets(clientId: string, campaignId?: string): Promise<AdSet[]> {
    const account = MOCK_AD_ACCOUNTS.find((a) => a.clientId === clientId);
    if (!account) return simulateLatency([]);
    const campaignIds = new Set(
      MOCK_CAMPAIGNS.filter((c) => c.adAccountId === account.id).map((c) => c.id)
    );
    const adSets = MOCK_AD_SETS.filter(
      (as) => campaignIds.has(as.campaignId) && (!campaignId || as.campaignId === campaignId)
    );
    return simulateLatency(adSets);
  }

  async getAdSet(adSetId: string): Promise<AdSet | undefined> {
    return simulateLatency(MOCK_AD_SETS.find((a) => a.id === adSetId));
  }

  async getAdSetsByCampaign(campaignId: string): Promise<AdSet[]> {
    return simulateLatency(MOCK_AD_SETS.filter((a) => a.campaignId === campaignId));
  }

  async getAds(clientId: string, filters?: { campaignId?: string; adSetId?: string }): Promise<Ad[]> {
    const account = MOCK_AD_ACCOUNTS.find((a) => a.clientId === clientId);
    if (!account) return simulateLatency([]);
    const campaignIds = new Set(
      MOCK_CAMPAIGNS.filter((c) => c.adAccountId === account.id).map((c) => c.id)
    );
    const ads = MOCK_ADS.filter((ad) => {
      if (!campaignIds.has(ad.campaignId)) return false;
      if (filters?.campaignId && ad.campaignId !== filters.campaignId) return false;
      if (filters?.adSetId && ad.adSetId !== filters.adSetId) return false;
      return true;
    });
    return simulateLatency(ads);
  }

  async getAd(adId: string): Promise<Ad | undefined> {
    return simulateLatency(MOCK_ADS.find((a) => a.id === adId));
  }

  async getAdsByAdSet(adSetId: string): Promise<Ad[]> {
    return simulateLatency(MOCK_ADS.filter((a) => a.adSetId === adSetId));
  }

  async getDailyMetrics(entityType: EntityType, entityId: string, range: DateRange): Promise<DailyMetrics[]> {
    if (entityType === "ad") {
      const rows = getAllAdDailyMetrics().filter((r) => r.entityId === entityId);
      return simulateLatency(filterByRange(rows, range));
    }
    const rows = getAggregatedDailyMetrics(entityType, entityId);
    return simulateLatency(filterByRange(rows, range));
  }
}
