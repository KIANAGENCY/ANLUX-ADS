import { MockMetaAdsService } from "./mock-service";
import type { IMetaAdsService } from "./service";
import { isMetaApiConfigured } from "./config";

export type { IMetaAdsService } from "./service";

let instance: IMetaAdsService | null = null;

/**
 * Punto único de acceso al proveedor de datos de Meta Ads.
 *
 * Hoy siempre devuelve `MockMetaAdsService`. Cuando implementemos el
 * cliente real (`lib/meta/real-service.ts`), el único cambio necesario es
 * este `if`:
 *
 *   if (isMetaApiConfigured()) return new RealMetaAdsService();
 *
 * Ningún componente ni página debe instanciar `MockMetaAdsService`
 * directamente: siempre deben pasar por `getMetaAdsService()`.
 */
export function getMetaAdsService(): IMetaAdsService {
  if (!instance) {
    if (isMetaApiConfigured()) {
      // TODO: sustituir por `new RealMetaAdsService()` cuando exista.
      console.warn(
        "[meta] Variables de Meta API detectadas pero el cliente real aún no está implementado. Usando datos mock."
      );
    }
    instance = new MockMetaAdsService();
  }
  return instance;
}
