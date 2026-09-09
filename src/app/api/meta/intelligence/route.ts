import { NextRequest, NextResponse } from "next/server";
import { generateRealDecisions } from "@/lib/decisions/real-engine";
import { buildIntelligenceSuite } from "@/lib/intelligence/engine";
import type { BusinessGoals } from "@/lib/intelligence/types";
import { persistIntelligenceMemory, type MemoryStatus } from "@/lib/memory/repository";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { parseAccountRangeParams } from "@/lib/meta/real/request-params";

function numberOrNull(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function GET(req: NextRequest) {
  const parsed = parseAccountRangeParams(req.nextUrl.searchParams);
  if (!parsed.ok) return parsed.response;

  const { accountId, from, to } = parsed.params;
  const risk = req.nextUrl.searchParams.get("risk");
  const goals: BusinessGoals = {
    targetCostPerResult: numberOrNull(req.nextUrl.searchParams.get("targetCpr")),
    minimumRoas: numberOrNull(req.nextUrl.searchParams.get("minRoas")),
    monthlyBudget: numberOrNull(req.nextUrl.searchParams.get("monthlyBudget")),
    grossMarginPercent: numberOrNull(req.nextUrl.searchParams.get("margin")),
    riskTolerance: risk === "conservative" || risk === "growth" ? risk : "balanced",
  };

  try {
    const decisionResult = await generateRealDecisions(accountId, { from, to });
    const suite = buildIntelligenceSuite(decisionResult.decisions, goals);

    let memory: MemoryStatus;
    try {
      memory = await persistIntelligenceMemory(decisionResult, suite, goals);
    } catch (error) {
      memory = {
        state: "unavailable",
        enabled: true,
        message: error instanceof Error ? error.message : "La inteligencia funcionó, pero no se pudo guardar memoria histórica.",
      };
    }

    return NextResponse.json({ ...suite, memory });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
