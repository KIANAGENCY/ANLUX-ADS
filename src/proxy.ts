import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

/** Prefijos de rutas que requieren sesión iniciada. */
const PROTECTED_PREFIXES = [
  "/overview",
  "/campaigns",
  "/adsets",
  "/ads",
  "/creatives",
  "/ai-analyst",
  "/alerts",
  "/settings",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Protege las rutas del dashboard a nivel de servidor: un usuario no
 * autenticado que intente entrar directamente por URL es redirigido a
 * `/login` antes de que la página llegue a renderizarse.
 *
 * En modo demo (sin Supabase configurado) no hay sesión que verificar aquí
 * — la protección la maneja el guard del cliente (`hooks/use-auth-state.ts`,
 * basado en `localStorage`), tal como ya funcionaba antes de conectar
 * Supabase.
 *
 * Nota: en Next.js 16 este archivo se llama "Proxy" (antes "Middleware");
 * la convención de archivo (`proxy.ts` en la raíz de `src/`) y el
 * comportamiento son los mismos, solo cambió el nombre.
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl!, supabasePublishableKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // `getUser()` revalida el token contra el servidor de Supabase Auth (a
  // diferencia de `getSession()`, que solo confía en la cookie) — es la
  // forma recomendada de verificar sesión en middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/overview", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
