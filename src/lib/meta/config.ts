/**
 * Configuración de la Meta Marketing API real.
 *
 * `META_ACCESS_TOKEN` es la única variable requerida para el modo de lectura
 * real (cuentas publicitarias se descubren dinámicamente vía `/me/adaccounts`,
 * no hace falta fijar `META_AD_ACCOUNT_ID`). Es un secreto de servidor: no
 * tiene el prefijo `NEXT_PUBLIC_` y solo debe leerse desde código de servidor
 * (API routes bajo `app/api/meta/*`, vía `lib/meta/real/`).
 *
 * `META_APP_ID` / `META_APP_SECRET` / `META_AD_ACCOUNT_ID` se mantienen
 * documentadas en `.env.example` para una fase futura (p. ej. `appsecret_proof`
 * o flujos de OAuth), pero no son necesarias para la integración de lectura
 * actual y no se usan en ningún sitio del código todavía.
 */
export const metaConfig = {
  accessToken: process.env.META_ACCESS_TOKEN,
  appId: process.env.META_APP_ID,
  appSecret: process.env.META_APP_SECRET,
  adAccountId: process.env.META_AD_ACCOUNT_ID,
  /**
   * Business Manager cuyas cuentas de cliente deben incluirse en el
   * descubrimiento de cuentas (ver `lib/meta/real/accounts.ts`). Opcional:
   * sin él, solo se consulta `/me/adaccounts`, como antes.
   */
  businessId: process.env.META_BUSINESS_ID,
};

/**
 * Versión de Graph API centralizada. Configurable vía `META_GRAPH_API_VERSION`
 * si algún día hace falta fijarla a otra distinta sin tocar código; si no se
 * define, usa el valor por defecto de abajo.
 */
export const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";

export function isMetaApiConfigured(): boolean {
  return Boolean(metaConfig.accessToken);
}
