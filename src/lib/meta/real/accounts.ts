import "server-only";
import type { MetaAdAccountSummary } from "@/lib/types";
import { metaGraphGet } from "./graph-client";

interface RawAdAccount {
  id: string;
  name?: string;
  account_status?: number;
  currency?: string;
}

interface AdAccountsResponse {
  data: RawAdAccount[];
}

/** Descubre las cuentas publicitarias accesibles con el token actual. */
export async function fetchAdAccounts(): Promise<MetaAdAccountSummary[]> {
  const res = await metaGraphGet<AdAccountsResponse>("/me/adaccounts", {
    fields: "id,name,account_status,currency",
    limit: 200,
  });

  return (res.data ?? []).map((a) => ({
    id: a.id,
    name: a.name?.trim() || a.id,
    accountStatus: a.account_status ?? 0,
    currency: a.currency ?? "USD",
  }));
}
