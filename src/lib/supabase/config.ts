/**
 * Estado de configuración de Supabase Auth.
 *
 * ANLUX no dispone de modo demo de autenticación: si estas variables faltan,
 * las rutas protegidas permanecen cerradas y el login muestra un error de
 * configuración. Esto evita sesiones locales simuladas.
 *
 * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` es la clave pública del proyecto y
 * puede exponerse al navegador; la autorización real depende de Supabase Auth
 * y de sus políticas, no de mantener esta clave en secreto.
 */
const ANLUX_SUPABASE_URL = "https://maxdkrehemltjwdbdvkc.supabase.co";
const ANLUX_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_RZ_uPRxE_OwlLybbNbUSqQ_HCccusNP";

function normalizeProjectUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function isPublishableKey(value: string | undefined): value is string {
  if (!value) return false;

  const candidate = value.trim();

  // Modern Supabase publishable keys use this explicit prefix.
  if (candidate.startsWith("sb_publishable_")) return true;

  // Legacy anon keys are JWTs. Require a JWT-like base64url structure instead
  // of merely checking for two dots; a Supabase URL such as
  // https://project.supabase.co also contains two dots and must never be
  // accepted as an API key.
  return /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(candidate);
}

const configuredUrl = normalizeProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const configuredKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const hasValidEnvironmentPair = Boolean(configuredUrl && isPublishableKey(configuredKey));
const hasKnownBrokenProductionPair = Boolean(
  configuredUrl === ANLUX_SUPABASE_URL &&
  normalizeProjectUrl(configuredKey) === ANLUX_SUPABASE_URL,
);

// The production project previously received the REST endpoint and project URL
// in the wrong Vercel fields. Keep the app available with its public project
// credentials while still preferring a complete, valid environment pair. The
// fallback only applies to that exact known pair so missing configuration still
// fails closed in CI and in new deployments.
export const supabaseUrl = hasValidEnvironmentPair
  ? configuredUrl!
  : hasKnownBrokenProductionPair
    ? ANLUX_SUPABASE_URL
    : undefined;
export const supabasePublishableKey = hasValidEnvironmentPair
  ? configuredKey!
  : hasKnownBrokenProductionPair
    ? ANLUX_SUPABASE_PUBLISHABLE_KEY
    : undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabasePublishableKey);
}
