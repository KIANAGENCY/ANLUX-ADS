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
    const url = new URL(value);
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

  return value.startsWith("sb_publishable_") || value.split(".").length === 3;
}

const configuredUrl = normalizeProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const configuredKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const hasValidEnvironmentPair = Boolean(configuredUrl && isPublishableKey(configuredKey));

// The production project previously received the REST endpoint and project URL
// in the wrong Vercel fields. Keep the app available with its public project
// credentials while still preferring a complete, valid environment pair.
export const supabaseUrl = hasValidEnvironmentPair ? configuredUrl! : ANLUX_SUPABASE_URL;
export const supabasePublishableKey = hasValidEnvironmentPair
  ? configuredKey!
  : ANLUX_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabasePublishableKey);
}
