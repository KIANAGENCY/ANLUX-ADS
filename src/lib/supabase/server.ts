import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./config";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route
 * Handlers. Lee/escribe la sesión a través de las cookies de Next.js.
 * Devuelve `null` en modo demo.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // `setAll` puede fallar si se llama desde un Server Component sin
          // middleware que refresque la sesión. Es seguro ignorarlo aquí.
        }
      },
    },
  });
}

/**
 * Cliente "admin" para operaciones de servidor que requieren saltarse RLS
 * (p. ej. tareas administrativas o sincronización de datos en background).
 *
 * NUNCA importar desde un componente cliente: `SUPABASE_SERVICE_ROLE_KEY`
 * es un secreto que otorga acceso total a la base de datos.
 */
export async function getSupabaseServiceRoleClient(): Promise<SupabaseClient | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured() || !serviceRoleKey) return null;

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
