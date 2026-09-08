import "server-only";
import { MetaApiError, metaGraphGet } from "./graph-client";
import { metaConfig } from "../config";
import type { MetaAdAccountSummary } from "@/lib/types";

/**
 * Estados posibles de la conexión con Meta. Se distinguen entre sí porque
 * cada uno se arregla de forma distinta: confundirlos hace perder tiempo
 * buscando en el sitio equivocado.
 */
export type MetaHealthStatus =
  /** Todo correcto: el token responde y hay al menos una cuenta accesible. */
  | "ok"
  /** `META_ACCESS_TOKEN` no está definido en el servidor. */
  | "missing_token"
  /** El token existe pero Meta lo rechaza: caducado o revocado. */
  | "token_expired"
  /** El token es válido pero le faltan permisos (p. ej. `ads_read`). */
  | "insufficient_permissions"
  /** El token funciona, pero el Business Manager configurado no es accesible. */
  | "business_unreachable"
  /** El token funciona pero no hay ninguna cuenta publicitaria asignada. */
  | "no_accounts"
  /** Fallo pasajero de Meta (rate limit, red, 5xx): reintentar más tarde. */
  | "temporary_error"
  /**
   * La petición no llegó a Meta: la rechazó un intermediario de red (proxy,
   * firewall, WAF) con un 401/403 sin cuerpo de error de Graph API.
   */
  | "blocked_by_network";

export interface MetaHealthCheck {
  /** Identificador de la comprobación, para poder mostrarlas por separado. */
  id: "token" | "business";
  label: string;
  ok: boolean;
  /** Mensaje ya saneado: nunca contiene el token. */
  detail: string;
}

export interface MetaHealthReport {
  status: MetaHealthStatus;
  /** Resumen accionable en una frase. */
  summary: string;
  checks: MetaHealthCheck[];
  /** Cuentas accesibles con el token actual. Vacío si no se pudieron leer. */
  accounts: MetaAdAccountSummary[];
  /** ¿Hay un Business Manager configurado? Si no, esa comprobación se omite. */
  businessConfigured: boolean;
  /** Momento de la comprobación, en ISO. Lo genera el servidor. */
  checkedAt: string;
}

interface RawAdAccount {
  id: string;
  name?: string;
  account_status?: number;
  currency?: string;
}

/**
 * Traduce el `kind` de `MetaApiError` al estado de salud equivalente. La
 * clasificación de la causa ya la hace `graph-client.ts` a partir del código
 * HTTP y del código de error de Meta; aquí solo se reagrupa.
 */
function statusFromError(err: unknown): MetaHealthStatus {
  if (!(err instanceof MetaApiError)) return "temporary_error";
  // Un 401/403 que no trae el cuerpo de error de Meta no lo emitió Meta:
  // lo emitió algo por el camino (proxy corporativo, firewall, WAF). Decir
  // "token vencido" o "faltan permisos" ahí manda a rehacer un token que
  // probablemente esté bien.
  if (!err.fromMeta && (err.status === 401 || err.status === 403)) return "blocked_by_network";
  switch (err.kind) {
    case "missing_token":
      return "missing_token";
    case "invalid_token":
      return "token_expired";
    case "insufficient_permissions":
      return "insufficient_permissions";
    case "rate_limited":
    case "network_error":
    case "empty_response":
      return "temporary_error";
    default:
      return "temporary_error";
  }
}

const SUMMARIES: Record<MetaHealthStatus, string> = {
  ok: "Conexión con Meta operativa.",
  missing_token:
    "META_ACCESS_TOKEN no está configurado en el servidor. Define la variable de entorno y vuelve a desplegar.",
  token_expired:
    "Meta rechazó el token: ha caducado o fue revocado. Genera uno nuevo y actualiza META_ACCESS_TOKEN.",
  insufficient_permissions:
    "El token es válido pero le faltan permisos de lectura de anuncios (ads_read). Revisa los permisos concedidos a la app.",
  business_unreachable:
    "El token funciona, pero el Business Manager configurado en META_BUSINESS_ID no es accesible con él. Revisa el ID y que el usuario del token tenga acceso al negocio.",
  no_accounts:
    "El token es válido pero no hay ninguna cuenta publicitaria asignada. Asigna las cuentas al usuario o System User del token.",
  temporary_error:
    "Meta no respondió correctamente. Suele ser un fallo pasajero: vuelve a comprobar en unos minutos.",
  blocked_by_network:
    "La petición fue rechazada antes de llegar a Meta (respuesta sin cuerpo de error de Graph API). Suele ser un proxy, firewall o WAF bloqueando graph.facebook.com desde el servidor; el token probablemente no es el problema.",
};

/**
 * Comprueba el estado de la conexión con Meta **sin exponer la credencial**:
 * el token nunca se devuelve, ni se registra, ni aparece en los mensajes —
 * `metaGraphGet` es el único punto que lo adjunta a la URL y `MetaApiError`
 * ya viene saneado.
 *
 * Es de solo lectura: hace exactamente dos GET (`/me/adaccounts` y, si hay
 * `META_BUSINESS_ID`, los datos básicos del negocio). No renueva tokens, no
 * pide `ads_management` y no toca ninguna campaña.
 */
export async function checkMetaHealth(): Promise<MetaHealthReport> {
  const checkedAt = new Date().toISOString();
  const businessId = metaConfig.businessId;
  const businessConfigured = Boolean(businessId);
  const checks: MetaHealthCheck[] = [];

  // ── 1. El token responde y devuelve cuentas ──────────────────────────────
  let accounts: MetaAdAccountSummary[] = [];
  try {
    const res = await metaGraphGet<{ data: RawAdAccount[] }>("/me/adaccounts", {
      fields: "id,name,account_status,currency",
      limit: 200,
    });
    accounts = (res.data ?? []).map((a) => ({
      id: a.id,
      name: a.name?.trim() || a.id,
      accountStatus: a.account_status ?? 0,
      currency: a.currency ?? "USD",
    }));
    checks.push({
      id: "token",
      label: "Token de acceso",
      ok: true,
      detail: `Meta aceptó el token. Cuentas propias visibles: ${accounts.length}.`,
    });
  } catch (err) {
    const status = statusFromError(err);
    const blocked = status === "blocked_by_network";
    checks.push({
      id: "token",
      label: "Token de acceso",
      ok: false,
      // Si la petición ni siquiera llegó a Meta, el mensaje de `MetaApiError`
      // (deducido del código HTTP) hablaría de permisos o de token vencido y
      // contradiría al resumen. Ahí manda la causa real.
      detail: blocked
        ? "No se pudo comprobar: la petición fue rechazada antes de llegar a Graph API."
        : err instanceof MetaApiError
          ? err.message
          : "No se pudo verificar el token.",
    });
    if (businessConfigured) {
      checks.push({
        id: "business",
        label: "Business Manager",
        ok: false,
        detail: blocked
          ? "No se comprobó: la petición no llegó a Meta."
          : "No se comprobó: el token no es utilizable.",
      });
    }
    return { status, summary: SUMMARIES[status], checks, accounts: [], businessConfigured, checkedAt };
  }

  // ── 2. El Business Manager configurado es accesible ──────────────────────
  let businessOk = true;
  if (businessId) {
    try {
      const business = await metaGraphGet<{ id: string; name?: string }>(`/${businessId}`, { fields: "id,name" });
      checks.push({
        id: "business",
        label: "Business Manager",
        ok: true,
        detail: `Acceso confirmado a "${business.name ?? business.id}".`,
      });
    } catch (err) {
      businessOk = false;
      checks.push({
        id: "business",
        label: "Business Manager",
        ok: false,
        detail: err instanceof MetaApiError ? err.message : "No se pudo verificar el Business Manager.",
      });
    }
  }

  const status: MetaHealthStatus = !businessOk
    ? "business_unreachable"
    : accounts.length === 0
      ? "no_accounts"
      : "ok";

  return { status, summary: SUMMARIES[status], checks, accounts, businessConfigured, checkedAt };
}
