export interface CronRunHealthRecord {
  period: string;
  started_at: string;
  finished_at: string | null;
  snapshot_success_at: string | null;
  last_error: string | null;
  email_status: string;
}

/** A configured variable is never evidence of a successful scheduled run. */
export function evaluateCronHealth(latest: CronRunHealthRecord | null, lastSuccess: string | null, now = Date.now()) {
  if (!latest) return { state: "never_run", message: "No hay ejecuciones registradas. La persistencia diaria no está verificada." };
  const age = now - Date.parse(latest.started_at);
  const successAge = lastSuccess ? now - Date.parse(lastSuccess) : Infinity;
  if (!Number.isFinite(age) || age < 0 || age > 26 * 60 * 60 * 1000) {
    return { state: "stale", message: "La tarea diaria no registra un intento reciente. Revisa el programador." };
  }
  if (!latest.finished_at) return age < 10 * 60 * 1000
    ? { state: "running", message: "La tarea diaria está en ejecución." }
    : { state: "failed", message: "La última ejecución no registró su finalización." };
  if ((latest.last_error !== null && latest.last_error !== "email_failed") || !latest.snapshot_success_at || !Number.isFinite(successAge) || successAge < 0 || successAge > 26 * 60 * 60 * 1000) {
    return { state: "failed", message: "La persistencia diaria necesita atención: no hay un guardado exitoso reciente." };
  }
  return { state: "healthy", message: "La última ejecución guardó la memoria diaria correctamente." };
}
