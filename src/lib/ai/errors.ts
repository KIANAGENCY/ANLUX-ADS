import "server-only";

/**
 * Taxonomía de errores del analista de IA. Es del dominio, no de ningún SDK:
 * cada proveedor traduce sus propias excepciones a estos `kind`, y
 * `error-response.ts` los mapea a códigos HTTP. Así el contrato del endpoint
 * `/api/ai/analyze` no cambia al cambiar de proveedor.
 *
 * `configuration` es el único añadido posterior: cubre un `AI_PROVIDER` con
 * un valor no reconocido, que es un fallo de configuración del servidor y no
 * de la credencial.
 */
export type AIAnalystErrorKind =
  | "rate_limited"
  | "auth"
  | "connection"
  | "invalid_response"
  | "refusal"
  | "configuration"
  | "unknown";

/** Error tipado para fallos al hablar con el proveedor de IA — mismo patrón que `MetaApiError`. */
export class AIAnalystError extends Error {
  readonly kind: AIAnalystErrorKind;
  constructor(kind: AIAnalystErrorKind, message: string) {
    super(message);
    this.name = "AIAnalystError";
    this.kind = kind;
  }
}
