import { NextRequest, NextResponse } from "next/server";
import { generateRealDecisions } from "@/lib/decisions/real-engine";
import { buildIntelligenceSuite } from "@/lib/intelligence/engine";
import type { BusinessGoals } from "@/lib/intelligence/types";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { parseMetaRequestParams } from "@/lib/meta/real/request-params";

function numberOrNull(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function GET(req: NextRequest) {
  const parsed = parseMetaRequestParams(req.nextUrl.searchParams, { requireDateRange: true });
  if (!parsed.ok) return parsed.response;

  const risk = req.nextUrl.searchParams.get("risk");
  const goals: BusinessGoals = {
    targetCostPerResult: numberOrNull(req.nextUrl.searchParams.get("targetCpr")),
    minimumRoas: numberOrNull(req.nextUrl.searchParams.get("minRoas")),
    monthlyBudget: numberOrNull(req.nextUrl.searchParams.get("monthlyBudget")),
    grossMarginPercent: numberOrNull(req.nextUrl.searchParams.get("margin")),
    riskTolerance: risk === "conservative" || risk === "growth" ? risk : "balanced",
  };

  try {
    const result = await generateRealDecisions(parsed.accountId, parsed.dateRange);
    return NextResponse.json(buildIntelligenceSuite(result.decisions, goals));
  } catch (error) {
    return metaErrorResponse(error);
  }
}
