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
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabasePublishableKey);
}
