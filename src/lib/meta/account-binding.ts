import "server-only";

/**
 * Binding explícito del cliente activo de ANLUX.
 *
 * Hotel Expert debe leer exclusivamente esta cuenta publicitaria de Meta.
 * El portafolio comercial visible en Meta Business Suite es "Hotel Expert MX".
 * Mantener este dato fuera del estado del navegador evita que una cuenta de
 * otro portafolio pueda quedar seleccionada por orden de respuesta o localStorage.
 */
export const ACTIVE_META_CLIENT = {
  key: "hotel-expert",
  clientName: "Hotel Expert",
  portfolioName: "Hotel Expert MX",
  adAccountId: "act_1574477574179117",
} as const;

export function isActiveMetaAdAccount(accountId: string): boolean {
  return accountId === ACTIVE_META_CLIENT.adAccountId;
}
