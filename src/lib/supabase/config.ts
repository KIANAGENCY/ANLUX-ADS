/**
 * Estado de configuración de Supabase.
 *
 * Mientras `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` no
 * estén definidas en `.env.local`, la aplicación entera funciona en
 * "modo demo": el login acepta cualquier credencial y no hay persistencia
 * real de sesión. Esto permite navegar y evaluar el dashboard sin depender
 * de un proyecto de Supabase todavía.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
