import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const site = "https://anlux-ads.vercel.app";
const headers = {
  "Access-Control-Allow-Origin": site,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

Deno.serve(async (req: Request) => {
  const reply = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "Método no permitido." }, 405);
  if (req.headers.get("origin") && req.headers.get("origin") !== site) {
    return reply({ error: "Origen no permitido." }, 403);
  }

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return reply({ error: "Inicia sesión." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return reply({ error: "Servicio de invitaciones no configurado." }, 503);

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const token = authorization.slice("Bearer ".length);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Sesión inválida." }, 401);
    if (authData.user.app_metadata?.anlux_role !== "admin") {
      return reply({ error: "Solo el administrador puede invitar usuarios." }, 403);
    }

    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply({ error: "Introduce un correo válido." }, 400);
    }

    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${site}/reset-password`,
    });

    if (inviteError) {
      const message = inviteError.message.toLowerCase();
      if (message.includes("already") || message.includes("exists")) {
        return reply({ error: "Ese correo ya tiene cuenta. Utiliza recuperación de contraseña." }, 409);
      }
      if (inviteError.status === 429) {
        return reply({ error: "Límite de correos alcanzado. Espera unos minutos." }, 429);
      }
      return reply({ error: "El proveedor de correo rechazó la invitación. Revisa SMTP en Supabase." }, 502);
    }

    const invitedUser = inviteData.user;
    if (!invitedUser) {
      return reply({ error: "La invitación se creó sin un usuario asociado." }, 502);
    }

    const { error: roleError } = await supabase.auth.admin.updateUserById(invitedUser.id, {
      app_metadata: {
        ...(invitedUser.app_metadata ?? {}),
        anlux_role: "member",
      },
    });

    if (roleError) {
      return reply({ error: "La invitación fue enviada, pero no se pudo habilitar el acceso. Revisa el usuario antes de reenviar." }, 502);
    }

    return reply({ success: true });
  } catch {
    return reply({ error: "No se pudo conectar con el servicio de invitaciones." }, 502);
  }
});
