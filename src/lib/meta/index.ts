import { MockMetaAdsService } from "./mock-service";
import type { IMetaAdsService } from "./service";
import { isMetaApiConfigured } from "./config";

export type { IMetaAdsService } from "./service";

let instance: IMetaAdsService | null = null;

/**
 * Punto de acceso al proveedor de datos MOCK de Meta Ads.
 *
 * Deliberadamente siempre devuelve `MockMetaAdsService`, incluso cuando
 * `META_ACCESS_TOKEN` está configurado: esta función se importa desde hooks
 * de cliente (`hooks/use-campaigns.ts`, etc.) para el modo demo, así que
 * nunca debe cargar código que dependa de secretos de servidor.
 *
 * La integración real con Meta Marketing API vive en `lib/meta/real/` y solo
 * se usa desde Route Handlers server-only bajo `app/api/meta/*` — nunca
 * desde aquí ni desde ningún componente cliente. El frontend en modo
 * "Meta Real" llama a esos endpoints internos, no a `getMetaAdsService()`.
 */
export function getMetaAdsService(): IMetaAdsService {
  if (!instance) {
    if (isMetaApiConfigured()) {
      console.warn(
        "[meta] META_ACCESS_TOKEN configurado, pero este código de servidor sigue usando el servicio mock. " +
          "Para datos reales, usa los endpoints /api/meta/* (lib/meta/real/) en vez de getMetaAdsService()."
      );
    }
    instance = new MockMetaAdsService();
  }
  return instance;
}
