import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { canAccessAnlux } from "@/lib/supabase/access";
import { getMemoryStatus } from "@/lib/memory/repository";
import { evaluateCronHealth, type CronRunHealthRecord } from "@/lib/memory/cron-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function MemoryHealth() {
  // Authorize before reading operational data with the privileged server client.
  const session = await getSupabaseServerClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  if (!user || !canAccessAnlux(user)) return null;
  const manual = await getMemoryStatus();
  let latest: CronRunHealthRecord | null = null;
  let lastSuccess: string | null = null;
  let unavailable = false;
  try {
    const service = getSupabaseServiceClient();
    if (!service) throw new Error("Service unavailable");
    const [attempt, success] = await Promise.all([
      service.from("anlux_cron_runs").select("period,started_at,finished_at,snapshot_success_at,last_error,email_status").order("started_at", { ascending: false }).limit(1).maybeSingle(),
      service.from("anlux_cron_runs").select("snapshot_success_at").not("snapshot_success_at", "is", null).order("snapshot_success_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (attempt.error || success.error) throw new Error("Read unavailable");
    latest = attempt.data;
    lastSuccess = success.data?.snapshot_success_at ?? null;
  } catch { unavailable = true; }
  const health = unavailable
    ? { state: "unavailable", message: "No se pudo consultar el estado de la tarea diaria." }
    : evaluateCronHealth(latest, lastSuccess);
  const date = (value?: string | null) => value ? new Date(value).toLocaleString("es-MX", { timeZone: "America/Mazatlan" }) : "Sin registro";
  const emailLabels: Record<string, string> = { sent: "Enviado", skipped: "Omitido", pending: "Pendiente", failed: "Falló el envío" };
  const errors: Record<string, string> = { snapshot_failed: "Falló el guardado del historial", email_failed: "Falló el correo; el historial se guardó" };
  const healthy = health.state === "healthy" && manual.state === "ready";
  return <Card>
    <CardHeader><CardTitle>Memoria y tarea diaria</CardTitle></CardHeader>
    <CardContent className="space-y-3 text-sm">
      <Badge variant={healthy ? "positive" : "warning"}>{healthy ? "Persistencia diaria verificada" : "Requiere comprobación"}</Badge>
      <p>{health.message}</p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <dt>Memoria manual</dt><dd>{manual.message}</dd>
        <dt>Último intento</dt><dd>{date(latest?.started_at)}</dd>
        <dt>Último guardado exitoso</dt><dd>{date(lastSuccess)}</dd>
        <dt>Periodo de la última tarea</dt><dd>{latest?.period ?? "Sin registro"}</dd>
        <dt>Último error</dt><dd>{latest?.last_error ? errors[latest.last_error] ?? "Error de ejecución" : unavailable ? "No verificable" : "Sin error registrado"}</dd>
        <dt>Correo del último intento</dt><dd>{latest ? emailLabels[latest.email_status] ?? "No verificable" : "Sin registro"}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">Horarios de La Paz. La tarea está prevista diariamente a las 06:00. Se advierte después de 26 horas sin actividad. La entrega del correo se evalúa por separado.</p>
    </CardContent>
  </Card>;
}
