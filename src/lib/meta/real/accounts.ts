import "server-only";
import type { MetaAdAccountSummary } from "@/lib/types";
import { metaGraphGet } from "./graph-client";
import { metaConfig } from "../config";

interface RawAdAccount {
  id: string;
  name?: string;
  account_status?: number;
  currency?: string;
}

interface AdAccountsResponse {
  data: RawAdAccount[];
}

const ACCOUNT_FIELDS = "id,name,account_status,currency";

function mapAccounts(res: AdAccountsResponse): MetaAdAccountSummary[] {
  return (res.data ?? []).map((a) => ({
    id: a.id,
    name: a.name?.trim() || a.id,
    accountStatus: a.account_status ?? 0,
    currency: a.currency ?? "USD",
  }));
}

/** Cuentas sobre las que el usuario del token tiene acceso directo. */
async function fetchOwnedAdAccounts(): Promise<MetaAdAccountSummary[]> {
  const res = await metaGraphGet<AdAccountsResponse>("/me/adaccounts", {
    fields: ACCOUNT_FIELDS,
    limit: 200,
  });
  return mapAccounts(res);
}

/**
 * Cuentas de cliente del Business Manager: cuentas de terceros administradas
 * por el negocio a las que el token tiene acceso, pero que no aparecen en
 * `/me/adaccounts` porque no pertenecen al usuario.
 */
async function fetchClientAdAccounts(businessId: string): Promise<MetaAdAccountSummary[]> {
  const res = await metaGraphGet<AdAccountsResponse>(`/${businessId}/client_ad_accounts`, {
    fields: ACCOUNT_FIELDS,
    limit: 200,
  });
  return mapAccounts(res);
}

/**
 * Descubre las cuentas publicitarias accesibles con el token actual.
 *
 * Combina dos orígenes porque `/me/adaccounts` solo devuelve las cuentas
 * propias del usuario: las cuentas de cliente administradas desde un Business
 * Manager quedan fuera aunque el token tenga acceso real a ellas. Cuando
 * `META_BUSINESS_ID` está definido, se consulta también
 * `/{business_id}/client_ad_accounts` y se fusionan ambas listas.
 *
 * Tolerancia a fallos: cada origen se resuelve por separado. Si uno falla
 * (permisos, business inexistente, rate limit...) se devuelven las cuentas del
 * otro. Solo si fallan todos se propaga el error, para que el endpoint siga
 * distinguiendo token ausente / inválido / sin permisos como hasta ahora.
 */
export async function fetchAdAccounts(): Promise<MetaAdAccountSummary[]> {
  const { businessId } = metaConfig;

  const sources: { label: string; promise: Promise<MetaAdAccountSummary[]> }[] = [
    { label: "/me/adaccounts", promise: fetchOwnedAdAccounts() },
  ];
  if (businessId) {
    sources.push({ label: "client_ad_accounts", promise: fetchClientAdAccounts(businessId) });
  }

  const settled = await Promise.allSettled(sources.map((s) => s.promise));

  const accounts: MetaAdAccountSummary[] = [];
  const seen = new Set<string>();
  const failures: unknown[] = [];

  settled.forEach((result, i) => {
    if (result.status === "rejected") {
      failures.push(result.reason);
      console.warn(
        `[meta] no se pudieron leer las cuentas desde ${sources[i].label}:`,
        result.reason instanceof Error ? result.reason.message : "error desconocido"
      );
      return;
    }
    for (const account of result.value) {
      if (seen.has(account.id)) continue;
      seen.add(account.id);
      accounts.push(account);
    }
  });

  // Ningún origen respondió: se propaga el primer error para conservar el
  // `kind` de MetaApiError que la ruta traduce a su código HTTP.
  if (failures.length === settled.length) {
    throw failures[0];
  }

  return accounts;
}
