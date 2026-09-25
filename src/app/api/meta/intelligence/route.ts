import { NextRequest, NextResponse } from "next/server";
import { generateRealDecisions } from "@/lib/decisions/real-engine";
import { buildIntelligenceSuite } from "@/lib/intelligence/engine";
import type { BusinessGoals } from "@/lib/intelligence/types";
import { getMemoryStatus, loadBusinessGoals, persistIntelligenceMemory, type MemoryStatus } from "@/lib/memory/repository";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { parseAccountRangeParams } from "@/lib/meta/real/request-params";

function numberOrNull(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function evaluate(req: NextRequest, save: boolean) {
  const parsed = parseAccountRangeParams(req.nextUrl.searchParams);
  if (!parsed.ok) return parsed.response;

  const { accountId, from, to } = parsed.params;
  const risk = req.nextUrl.searchParams.get("risk");
  const requestGoals: BusinessGoals = {
    targetCostPerResult: numberOrNull(req.nextUrl.searchParams.get("targetCpr")),
    minimumRoas: numberOrNull(req.nextUrl.searchParams.get("minRoas")),
    monthlyBudget: numberOrNull(req.nextUrl.searchParams.get("monthlyBudget")),
    grossMarginPercent: numberOrNull(req.nextUrl.searchParams.get("margin")),
    riskTolerance: risk === "conservative" || risk === "growth" ? risk : "balanced",
  };

  try {
    let savedGoals: BusinessGoals | null = null;
    try {
      savedGoals = (await loadBusinessGoals(accountId)).goals;
    } catch (error) {
      console.error("No se pudieron cargar las metas confirmadas; se conservará el análisis sin ellas.", error);
    }
    const goals: BusinessGoals = {
      targetCostPerResult: requestGoals.targetCostPerResult ?? savedGoals?.targetCostPerResult ?? null,
      minimumRoas: requestGoals.minimumRoas ?? savedGoals?.minimumRoas ?? null,
      monthlyBudget: requestGoals.monthlyBudget ?? savedGoals?.monthlyBudget ?? null,
      grossMarginPercent: requestGoals.grossMarginPercent ?? savedGoals?.grossMarginPercent ?? null,
      riskTolerance: req.nextUrl.searchParams.has("risk") ? requestGoals.riskTolerance : savedGoals?.riskTolerance ?? "balanced",
    };
    const decisionResult = await generateRealDecisions(accountId, { from, to }, { targetCostPerResult: goals.targetCostPerResult });
    const suite = buildIntelligenceSuite(decisionResult.decisions, goals, decisionResult.portfolioRecommendations);

    let memory: MemoryStatus;
    try {
      memory = save
        ? await persistIntelligenceMemory(decisionResult, suite, goals)
        : await getMemoryStatus();
    } catch (error) {
      console.error(save ? "No se pudo persistir la memoria histórica de ANLUX." : "No se pudo consultar el estado de memoria.", error);
      memory = {
        state: "unavailable",
        enabled: true,
        message: error instanceof Error ? error.message : "La inteligencia funcionó, pero no se pudo guardar memoria histórica.",
      };
    }

    return NextResponse.json({ ...suite, portfolioRecommendations: decisionResult.portfolioRecommendations, memory });
  } catch (error) {
    return metaErrorResponse(error);
  }
}

// Reading Intelligence must never change historical observations or decisions.
export async function GET(req: NextRequest) {
  return evaluate(req, false);
}

// Only an explicit same-origin, authenticated action writes a fresh snapshot.
export async function POST(req: NextRequest) {
  return evaluate(req, true);
}
