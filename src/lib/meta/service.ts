import type { Ad, AdSet, Campaign, Client, DateRange, EntityType, DailyMetrics } from "@/lib/types";

/**
 * Contrato que debe cumplir cualquier proveedor de datos de Meta Ads,
 * ya sea el mock actual o, en el futuro, un cliente real de la
 * Meta Marketing API. Todo el resto de la aplicación (páginas, componentes,
 * API routes) debe depender únicamente de esta interfaz — nunca de
 * `MockMetaAdsService` directamente — para que sustituir la implementación
 * sea un cambio de una sola línea (ver `lib/meta/index.ts`).
 */
export interface IMetaAdsService {
  getClients(): Promise<Client[]>;
  getClient(clientId: string): Promise<Client | undefined>;

  getCampaigns(clientId: string): Promise<Campaign[]>;
  getCampaign(campaignId: string): Promise<Campaign | undefined>;

  getAdSets(clientId: string, campaignId?: string): Promise<AdSet[]>;
  getAdSet(adSetId: string): Promise<AdSet | undefined>;
  /** Ad sets de una campaña, sin necesidad de conocer su clientId. */
  getAdSetsByCampaign(campaignId: string): Promise<AdSet[]>;

  getAds(clientId: string, filters?: { campaignId?: string; adSetId?: string }): Promise<Ad[]>;
  getAd(adId: string): Promise<Ad | undefined>;
  /** Anuncios de un ad set, sin necesidad de conocer su clientId. */
  getAdsByAdSet(adSetId: string): Promise<Ad[]>;

  /**
   * Serie diaria de métricas en bruto para una entidad y rango de fechas.
   * Toda métrica agregada/derivada (CTR, CPC, CPM, etc.) se calcula a partir
   * de esta serie mediante `lib/utils/metrics`, nunca se almacena directamente.
   */
  getDailyMetrics(entityType: EntityType, entityId: string, range: DateRange): Promise<DailyMetrics[]>;
}
