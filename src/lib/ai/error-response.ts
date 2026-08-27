import "server-only";
import { NextResponse } from "next/server";
import { AIAnalystError, type AIAnalystErrorKind } from "./claude-service";

const STATUS_BY_KIND: Record<AIAnalystErrorKind, number> = {
  rate_limited: 429,
  auth: 503,
  connection: 502,
  invalid_response: 502,
  refusal: 422,
  unknown: 500,
};

/** Convierte un error de `getAIAnalystService().analyze()` en una respuesta JSON segura (nunca incluye la API key). */
export function aiErrorResponse(err: unknown): NextResponse {
  if (err instanceof AIAnalystError) {
    return NextResponse.json({ error: err.message, kind: err.kind }, { status: STATUS_BY_KIND[err.kind] });
  }
  console.error("[ai] error inesperado:", err instanceof Error ? err.message : "error desconocido");
  return NextResponse.json({ error: "Error inesperado al generar el análisis." }, { status: 500 });
}
