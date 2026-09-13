import "server-only";
import type { MetaAdAccountSummary } from "@/lib/types";
import { ACTIVE_META_CLIENT } from "@/lib/meta/account-binding";
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
    currency: a.currency?.trim() || null,
  }));
}

async function fetchOwnedAdAccounts(): Promise<MetaAdAccountSummary[]> {
  const res = await metaGraphGet<AdAccountsResponse>("/me/adaccounts", {
    fields: ACCOUNT_FIELDS,
    limit: 200,
  });
  return mapAccounts(res);
}

async function fetchClientAdAccounts(businessId: string): Promise<MetaAdAccountSummary[]> {
  const res = await metaGraphGet<AdAccountsResponse>(`/${businessId}/client_ad_accounts`, {
    fields: ACCOUNT_FIELDS,
    limit: 200,
  });
  return mapAccounts(res);
}

/**
 * ANLUX está vinculado de forma explícita a Hotel Expert.
 *
 * Seguimos consultando las fuentes que Meta permite al token para confirmar
 * que la cuenta exista y sea accesible, pero nunca devolvemos otras cuentas
 * del usuario o de otros portafolios comerciales.
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
      if (account.id !== ACTIVE_META_CLIENT.adAccountId) continue;
      if (seen.has(account.id)) continue;
      seen.add(account.id);
      accounts.push(account);
    }
  });

  if (accounts.length > 0) return accounts;

  if (failures.length === settled.length) {
    throw failures[0];
  }

  throw new Error(
    `La cuenta configurada para ${ACTIVE_META_CLIENT.clientName} (${ACTIVE_META_CLIENT.adAccountId}) no está accesible con el token actual.`
  );
}
