import "server-only";
import { META_GRAPH_API_VERSION, metaConfig } from "../config";

const GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

export type MetaApiErrorKind =
  | "missing_token"
  | "invalid_token"
  | "insufficient_permissions"
  | "rate_limited"
  | "not_found"
  | "empty_response"
  | "network_error"
  | "unknown";

/**
 * Error tipado para cualquier fallo al hablar con Meta Graph API. El
 * `message` siempre es seguro para mostrarse al usuario o loguearse: nunca
 * contiene el access token (que solo aparece en la URL de la petición,
 * nunca en el cuerpo de este error).
 */
export class MetaApiError extends Error {
  readonly kind: MetaApiErrorKind;
  readonly status?: number;

  constructor(kind: MetaApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "MetaApiError";
    this.kind = kind;
    this.status = status;
  }
}

interface MetaGraphErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Traduce un error de la Graph API (código HTTP + cuerpo `error`) a un
 * `MetaApiError` con una categoría clara. Los códigos de error de Meta usados
 * aquí son los documentados para fallos de autenticación (190), permisos
 * (10, 200) y límite de solicitudes (4, 17, 32, y HTTP 429).
 */
function classifyMetaError(status: number, body: MetaGraphErrorBody | null): MetaApiError {
  const code = body?.error?.code;
  const message = body?.error?.message?.trim();

  if (status === 401 || code === 190) {
    return new MetaApiError(
      "invalid_token",
      "El token de acceso de Meta no es válido o ha expirado. Genera uno nuevo y actualiza META_ACCESS_TOKEN.",
      status
    );
  }
  if (status === 403 || code === 200 || code === 10) {
    return new MetaApiError(
      "insufficient_permissions",
      "El token no tiene permisos suficientes para esta operación (revisa los permisos ads_read / ads_management concedidos).",
      status
    );
  }
  if (status === 429 || code === 4 || code === 17 || code === 32) {
    return new MetaApiError(
      "rate_limited",
      "Se alcanzó el límite de solicitudes de Meta Graph API. Intenta de nuevo en unos minutos.",
      status
    );
  }
  if (status === 404) {
    return new MetaApiError(
      "not_found",
      "El recurso solicitado no existe o no es accesible con este token (revisa el ID de cuenta/campaña).",
      status
    );
  }
  return new MetaApiError("unknown", message || `Meta Graph API respondió con estado ${status}.`, status);
}

/**
 * GET autenticado contra Meta Graph API. Único punto del proyecto que añade
 * `access_token` a una URL — nunca loguear `url.toString()` ni pasar la URL
 * completa a un error.
 */
export async function metaGraphGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  if (!metaConfig.accessToken) {
    throw new MetaApiError(
      "missing_token",
      "META_ACCESS_TOKEN no está configurado en el servidor. Defínelo como variable de entorno privada."
    );
  }

  const url = new URL(`${GRAPH_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  url.searchParams.set("access_token", metaConfig.accessToken);

  let response: Response;
  try {
    response = await fetch(url.toString(), { cache: "no-store" });
  } catch {
    throw new MetaApiError(
      "network_error",
      "No se pudo conectar con Meta Graph API. Revisa la conectividad de red del servidor."
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Respuesta no-JSON o vacía; se resuelve según el status HTTP debajo.
  }

  if (!response.ok) {
    throw classifyMetaError(response.status, body as MetaGraphErrorBody);
  }

  if (body === null || body === undefined) {
    throw new MetaApiError("empty_response", "Meta Graph API devolvió una respuesta vacía.");
  }

  return body as T;
}
