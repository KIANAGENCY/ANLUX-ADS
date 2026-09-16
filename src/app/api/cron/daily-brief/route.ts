import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateRealDecisions } from "@/lib/decisions/real-engine";
import { buildIntelligenceSuite } from "@/lib/intelligence/engine";
import { loadServiceBusinessGoals, persistServiceIntelligenceMemory } from "@/lib/memory/service-repository";
import { fetchAdAccounts } from "@/lib/meta/real/accounts";

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
  const cronSecret = process.env.ANLUX_CRON_SECRET;
  const recipient = process.env.ANLUX_BRIEF_RECIPIENT;
  const resendKey = process.env.RESEND_API_KEY;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!recipient || !resendKey) {
    return NextResponse.json({ error: "Falta RESEND_API_KEY o ANLUX_BRIEF_RECIPIENT; no se envió ningún correo." }, { status: 503 });
  }

  const accounts = await fetchAdAccounts();
  if (accounts.length === 0) return NextResponse.json({ error: "Meta no devolvió cuentas para el informe; no se envió ningún correo." }, { status: 503 });

  const range = yesterdaysRange();
  const sections = [] as Array<{ name: string; headline: string; attention: string[]; healthy: string[] }>;
  for (const account of accounts) {
    const { goals } = await loadServiceBusinessGoals(account.id);
    const decisions = await generateRealDecisions(account.id, range, { targetCostPerResult: goals?.targetCostPerResult ?? null });
    const suite = buildIntelligenceSuite(decisions.decisions, goals ?? {});
    try {
      await persistServiceIntelligenceMemory(decisions, suite, goals ?? {});
    } catch (error) {
      console.error("No se pudo persistir memoria desde el informe diario.", error);
    }
    sections.push({ name: account.name, headline: suite.brief.headline, attention: suite.brief.attention, healthy: suite.brief.healthy });
  }

  const { data, error } = await new Resend(resendKey).emails.send({
    from: "ANLUX <onboarding@resend.dev>",
    to: recipient,
    subject: "Brief diario ANLUX",
    html: dailyEmail(sections),
  });
  if (error) return NextResponse.json({ error: "Resend no pudo enviar el informe." }, { status: 502 });
  return NextResponse.json({ ok: true, id: data?.id ?? null, accounts: sections.length });
}

