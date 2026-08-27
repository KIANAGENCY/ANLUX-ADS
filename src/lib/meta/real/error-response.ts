import "server-only";
import { NextResponse } from "next/server";
import { MetaApiError, type MetaApiErrorKind } from "./graph-client";

const STATUS_BY_KIND: Record<MetaApiErrorKind, number> = {
  missing_token: 503,
  invalid_token: 401,
  insufficient_permissions: 403,
  rate_limited: 429,
  not_found: 404,
  empty_response: 502,
  network_error: 502,
  unknown: 502,
};

/**
 * Convierte cualquier error lanzado al hablar con Meta en una respuesta JSON
 * segura. `MetaApiError.message` ya está saneado (nunca incluye el token);
 * para errores inesperados no tipados, tampoco se propaga el objeto de error
 * crudo al cliente ni a los logs — solo su mensaje.
 */
export function metaErrorResponse(err: unknown): NextResponse {
  if (err instanceof MetaApiError) {
    return NextResponse.json({ error: err.message, kind: err.kind }, { status: STATUS_BY_KIND[err.kind] });
  }
  console.error("[meta] error inesperado:", err instanceof Error ? err.message : "error desconocido");
  return NextResponse.json({ error: "Error inesperado al consultar Meta Marketing API." }, { status: 500 });
}
