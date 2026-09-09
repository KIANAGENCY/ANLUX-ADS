import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

/** Prefijos de páginas del dashboard que requieren sesión iniciada. */
const PROTECTED_PAGE_PREFIXES = [
  "/overview",
  "/campaigns",
  "/adsets",
  "/ads",
  "/creatives",
  "/ai-analyst",
  "/alerts",
  "/settings",
];

/**
 * APIs internas que exponen datos reales o consumen proveedores de pago.
 * Nunca deben responder a una petición anónima.
 */
const PROTECTED_API_PREFIXES = ["/api/meta", "/api/ai"];

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isProtectedPage(pathname: string): boolean {
  return matchesPrefix(pathname, PROTECTED_PAGE_PREFIXES);
}

function isProtectedApi(pathname: string): boolean {
  return matchesPrefix(pathname, PROTECTED_API_PREFIXES);
}

function apiUnauthorized(message: string, status: 401 | 503) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

/**
 * Protege dashboard y APIs internas a nivel de servidor.
 *
 * - Las páginas anónimas se redirigen al login.
 * - Las APIs anónimas devuelven JSON 401 (nunca redirecciones HTML).
 * - Si Supabase no está configurado, todo recurso protegido falla cerrado.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedPage = isProtectedPage(pathname);
  const protectedApi = isProtectedApi(pathname);

  if (!isSupabaseConfigured()) {
    if (protectedApi) {
      return apiUnauthorized("Autenticación no disponible: Supabase no está configurado.", 503);
    }
    if (protectedPage) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
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

  // `getUser()` revalida la sesión contra Supabase Auth; no confía solo en la cookie local.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && protectedApi) {
    return apiUnauthorized("No autorizado. Inicia sesión para acceder a esta API.", 401);
  }

  if (!user && protectedPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/overview", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
