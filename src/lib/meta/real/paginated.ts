import "server-only";
import { metaGraphGet } from "./graph-client";

interface Page<T> {
  data?: T[];
  paging?: { next?: string; cursors?: { after?: string } };
}

/** Exhaust Meta cursor pages without ever following a token-bearing next URL. */
export async function metaGraphGetAll<T>(path: string, params: Record<string, string | number>): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 100; page += 1) {
    const response = await metaGraphGet<Page<T>>(path, { ...params, after });
    rows.push(...(response.data ?? []));
    if (!response.paging?.next) return rows;
    after = response.paging.cursors?.after;
    if (!after || seen.has(after)) throw new Error("Meta no permitió completar todas las páginas de entidades.");
    seen.add(after);
  }
  throw new Error("Meta devolvió demasiadas páginas de entidades; no se puede presentar una lista parcial.");
}
