/**
 * Configuración de la Meta Marketing API real.
 *
 * NADA de esto se usa todavía: mientras estas variables no estén definidas
 * en `.env.local`, la aplicación funciona en modo mock (ver `lib/meta/index.ts`).
 *
 * Cuando llegue el momento de conectar la API real:
 *   1. Rellenar estas variables en `.env.local` (nunca en el código).
 *   2. Implementar `MetaAdsService` (en `lib/meta/real-service.ts`, por crear)
 *      implementando `IMetaAdsService` con llamadas reales a la Graph API.
 *   3. Actualizar `getMetaAdsService()` en `lib/meta/index.ts` para
 *      devolver esa implementación cuando `isMetaApiConfigured()` sea `true`.
 *
 * IMPORTANTE: META_APP_SECRET y META_ACCESS_TOKEN son secretos de servidor.
 * No deben tener el prefijo `NEXT_PUBLIC_` ni ser importados desde ningún
 * componente cliente ("use client").
 */
export const metaConfig = {
  appId: process.env.META_APP_ID,
  appSecret: process.env.META_APP_SECRET,
  accessToken: process.env.META_ACCESS_TOKEN,
  adAccountId: process.env.META_AD_ACCOUNT_ID,
};

export function isMetaApiConfigured(): boolean {
  return Boolean(
    metaConfig.appId && metaConfig.appSecret && metaConfig.accessToken && metaConfig.adAccountId
  );
}
