import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateRealDecisions } from "@/lib/decisions/real-engine";
import { buildIntelligenceSuite } from "@/lib/intelligence/engine";
import { loadServiceBusinessGoals, persistServiceIntelligenceMemory } from "@/lib/memory/service-repository";
import { fetchAdAccounts } from "@/lib/meta/real/accounts";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { isMemoryEnabled } from "@/lib/memory/config";
import { startCronRun, updateCronRun } from "@/lib/memory/cron-status";

function yesterdaysRange() {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  return { from: yesterday, to: yesterday };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function dailyEmail(sections: Array<{ name: string; headline: string; attention: string[]; healthy: string[] }>) {
  const cards = sections.map((section) => {
    const attention = section.attention.length
      ? `<ul>${section.attention.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "<p>No hay acciones urgentes para esta cuenta.</p>";
    const healthy = section.healthy.length
      ? `<p><strong>Va bien</strong></p><ul>${section.healthy.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";
    return `<section style="padding:20px 0;border-bottom:1px solid #e5e7eb"><h2 style="margin:0 0 8px;font-size:18px">${escapeHtml(section.name)}</h2><p style="margin:0 0 14px">${escapeHtml(section.headline)}</p>${attention}${healthy}</section>`;
  }).join("");
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;color:#111827;font-family:Arial,sans-serif"><main style="max-width:600px;margin:0 auto;padding:24px;background:#ffffff"><h1 style="font-size:24px;margin:0 0 8px">Brief diario ANLUX</h1><p style="margin:0 0 12px;color:#4b5563">Recomendaciones basadas solo en datos reales disponibles. ANLUX no modifica Meta automáticamente.</p>${cards}</main></body></html>`;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const recipient = process.env.ANLUX_BRIEF_RECIPIENT;
  const resendKey = process.env.RESEND_API_KEY;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const service = getSupabaseServiceClient();
  if (!isMemoryEnabled() || !service) {
    console.error("[cron] Memoria de servicio no configurada.");
    return NextResponse.json({ error: "Memoria diaria no configurada." }, { status: 503 });
  }
  const range = yesterdaysRange();
  let priorEmailStatus: "pending" | "sent";
  try {
    priorEmailStatus = await startCronRun(service, range.from);
  } catch (error) {
    console.error("[cron] No se pudo iniciar registro de ejecución.", error);
    return NextResponse.json({ error: "No se pudo registrar la ejecución diaria." }, { status: 503 });
  }

  const sections = [] as Array<{ name: string; headline: string; attention: string[]; healthy: string[] }>;
  const persistenceFailures: string[] = [];
  try {
    const accounts = await fetchAdAccounts();
    if (accounts.length === 0) throw new Error("Meta no devolvió cuentas vinculadas.");
    for (const account of accounts) {
      const { goals } = await loadServiceBusinessGoals(account.id);
      const decisions = await generateRealDecisions(account.id, range, { targetCostPerResult: goals?.targetCostPerResult ?? null, service: true });
      const suite = buildIntelligenceSuite(decisions.decisions, goals ?? {}, decisions.portfolioRecommendations);
      const status = await persistServiceIntelligenceMemory(decisions, suite, goals ?? {});
      if (status.state !== "ready") persistenceFailures.push(account.id);
      sections.push({ name: account.name, headline: suite.brief.headline, attention: suite.brief.attention, healthy: suite.brief.healthy });
    }
    if (persistenceFailures.length === 0) {
      await updateCronRun(service, range.from, { snapshot_success_at: new Date().toISOString() });
    }
  } catch (error) {
    console.error("[cron] Falló la generación o persistencia diaria.", error);
    persistenceFailures.push("daily_snapshot");
  }

  let emailStatus: "sent" | "skipped" | "failed" = priorEmailStatus === "sent" ? "sent" : "skipped";
  let emailId: string | undefined;
  if (priorEmailStatus !== "sent" && recipient && resendKey && sections.length > 0) {
    try {
      const { data, error } = await new Resend(resendKey).emails.send({
        from: "ANLUX <brief@anluxagency.com>",
        to: recipient,
        subject: `Brief diario ANLUX · ${range.from}`,
        html: dailyEmail(sections),
      });
      if (error) throw error;
      emailStatus = "sent";
      emailId = data?.id;
    } catch (error) {
      console.error("[cron] Resend no pudo enviar el informe.", error);
      emailStatus = "failed";
    }
  }

  const snapshotOk = persistenceFailures.length === 0;
  try {
    await updateCronRun(service, range.from, {
      finished_at: new Date().toISOString(),
      last_error: snapshotOk ? emailStatus === "failed" ? "email_failed" : null : "snapshot_failed",
      email_status: emailStatus,
      ...(emailId ? { email_id: emailId } : {}),
    });
  } catch (error) {
    console.error("[cron] No se pudo actualizar el estado de ejecución.", error);
    return NextResponse.json({ error: "No se pudo registrar el estado final del cron." }, { status: 503 });
  }
  if (persistenceFailures.length) {
    return NextResponse.json({ ok: false, error: "No se guardaron todas las observaciones históricas.", emailStatus, accounts: sections.length, persistenceFailures }, { status: 503 });
  }
  return NextResponse.json({ ok: true, emailStatus, emailId: emailId ?? null, accounts: sections.length, period: range });
}
