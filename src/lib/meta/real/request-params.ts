import "server-only";
import { NextResponse } from "next/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface AccountRangeParams {
  accountId: string;
  from: string;
  to: string;
}

/**
 * Lee y valida `accountId`, `from` y `to` de la query string, comunes a
 * todos los endpoints `/api/meta/*` que necesitan cuenta + rango de fechas.
 * Devuelve una `NextResponse` de error 400 lista para retornar si algo falta
 * o tiene formato inválido.
 */
export function parseAccountRangeParams(
  searchParams: URLSearchParams
): { ok: true; params: AccountRangeParams } | { ok: false; response: NextResponse } {
  const accountId = searchParams.get("accountId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!accountId || !accountId.startsWith("act_")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "El parámetro accountId es obligatorio y debe tener el formato 'act_XXXXXXXXXX'." },
        { status: 400 }
      ),
    };
  }
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Los parámetros from y to son obligatorios, con formato YYYY-MM-DD." },
        { status: 400 }
      ),
    };
  }

  return { ok: true, params: { accountId, from, to } };
}
