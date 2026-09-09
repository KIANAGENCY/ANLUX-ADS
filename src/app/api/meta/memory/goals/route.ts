import { NextRequest, NextResponse } from "next/server";
import type { BusinessGoals } from "@/lib/intelligence/types";
import { loadBusinessGoals, saveBusinessGoals } from "@/lib/memory/repository";

const ACCOUNT_ID_RE = /^act_\d{1,30}$/;
const MAX_BODY_CHARS = 4096;

function validNumber(value: unknown, max?: number): value is number | null | undefined {
  if (value == null) return true;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && (max == null || value <= max);
}

function parseGoals(value: unknown): BusinessGoals | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const goals = value as Record<string, unknown>;
  if (!validNumber(goals.targetCostPerResult)) return null;
  if (!validNumber(goals.minimumRoas)) return null;
  if (!validNumber(goals.monthlyBudget)) return null;
  if (!validNumber(goals.grossMarginPercent, 100)) return null;
  if (
    goals.riskTolerance !== undefined &&
    goals.riskTolerance !== "conservative" &&
    goals.riskTolerance !== "balanced" &&
    goals.riskTolerance !== "growth"
  ) return null;

  return {
    targetCostPerResult: (goals.targetCostPerResult as number | null | undefined) ?? null,
    minimumRoas: (goals.minimumRoas as number | null | undefined) ?? null,
    monthlyBudget: (goals.monthlyBudget as number | null | undefined) ?? null,
    grossMarginPercent: (goals.grossMarginPercent as number | null | undefined) ?? null,
    riskTolerance: (goals.riskTolerance as BusinessGoals["riskTolerance"]) ?? "balanced",
  };
}

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("accountId")?.trim() ?? "";
  if (!ACCOUNT_ID_RE.test(accountId)) {
    return NextResponse.json({ error: "accountId inválido." }, { status: 400 });
  }

  try {
    const result = await loadBusinessGoals(accountId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron leer las metas guardadas.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) return NextResponse.json({ error: "Solicitud demasiado grande." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const accountId = typeof record.accountId === "string" ? record.accountId.trim() : "";
  const goals = parseGoals(record.goals);
  if (!ACCOUNT_ID_RE.test(accountId) || !goals) {
    return NextResponse.json({ error: "Cuenta o metas inválidas." }, { status: 400 });
  }

  try {
    const status = await saveBusinessGoals(accountId, goals);
    if (status.state !== "ready") return NextResponse.json({ status }, { status: 409 });
    return NextResponse.json({ goals, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron guardar las metas.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
