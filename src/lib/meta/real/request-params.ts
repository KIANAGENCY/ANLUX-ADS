import "server-only";
import { NextResponse } from "next/server";

const ACCOUNT_ID_RE = /^act_\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

export interface AccountRangeParams {
  accountId: string;
  from: string;
  to: string;
}

function parseIsoDate(value: string): number | null {
  if (!DATE_RE.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

/**
 * Lee y valida `accountId`, `from` y `to` de la query string, comunes a
 * todos los endpoints `/api/meta/*` que necesitan cuenta + rango de fechas.
 *
 * Además de validar formato, limita el rango para evitar consultas
 * accidentalmente enormes a Meta y rechaza fechas imposibles/invertidas.
 */
export function parseAccountRangeParams(
  searchParams: URLSearchParams
): { ok: true; params: AccountRangeParams } | { ok: false; response: NextResponse } {
  const accountId = searchParams.get("accountId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!accountId || !ACCOUNT_ID_RE.test(accountId)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "El parámetro accountId es obligatorio y debe tener el formato 'act_XXXXXXXXXX'." },
        { status: 400 }
      ),
    };
  }

  if (!from || !to) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Los parámetros from y to son obligatorios, con formato YYYY-MM-DD." },
        { status: 400 }
      ),
    };
  }

  const fromTs = parseIsoDate(from);
  const toTs = parseIsoDate(to);
  const rangeDays = fromTs !== null && toTs !== null ? (toTs - fromTs) / 86_400_000 + 1 : null;

  if (fromTs === null || toTs === null || fromTs > toTs || rangeDays === null || rangeDays > MAX_RANGE_DAYS) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `El rango debe contener fechas reales, estar en orden y no superar ${MAX_RANGE_DAYS} días.` },
        { status: 400 }
      ),
    };
  }

  return { ok: true, params: { accountId, from, to } };
}
