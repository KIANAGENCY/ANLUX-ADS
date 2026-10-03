import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CronEmailStatus = "pending" | "sent" | "skipped" | "failed";

/** Only the service client can read or write this operational record. */
export async function startCronRun(client: SupabaseClient, period: string): Promise<"pending" | "sent"> {
  const { data, error: readError } = await client.from("anlux_cron_runs")
    .select("email_status").eq("period", period).maybeSingle();
  if (readError) throw readError;
  const { error } = await client.from("anlux_cron_runs").upsert({
    period,
    started_at: new Date().toISOString(),
    finished_at: null,
    last_error: null,
    email_status: data?.email_status === "sent" ? "sent" : "pending",
  }, { onConflict: "period" });
  if (error) throw error;
  return data?.email_status === "sent" ? "sent" : "pending";
}

export async function updateCronRun(client: SupabaseClient, period: string, changes: {
  snapshot_success_at?: string;
  finished_at?: string;
  last_error?: string | null;
  email_status?: CronEmailStatus;
  email_id?: string;
  messaging_contract?: { checkedAt: string; checks: Array<{ state: string; campaignsWithEvents?: number; campaignsComplete?: number }> };
}): Promise<void> {
  const { error } = await client.from("anlux_cron_runs").update(changes).eq("period", period);
  if (error) throw error;
}
