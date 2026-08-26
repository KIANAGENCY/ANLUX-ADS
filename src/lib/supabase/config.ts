/**
 * Estado de configuración de Supabase.
 *
 * Mientras `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
 * no estén definidas en `.env.local`, la aplicación entera funciona en
 * "modo demo": el login acepta cualquier credencial y no hay persistencia
 * real de sesión. Esto permite navegar y evaluar el dashboard sin depender
 * de un proyecto de Supabase todavía.
 *
 * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` es la nomenclatura actual de
 * Supabase para la clave pública del proyecto (sustituye a la antigua
 * "anon key" en la misma posición del SDK: sigue siendo segura para
 * exponerse en el cliente).
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabasePublishableKey);
}
