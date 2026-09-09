import { NextRequest, NextResponse } from "next/server";
import { generateRealDecisions } from "@/lib/decisions/real-engine";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { parseAccountRangeParams } from "@/lib/meta/real/request-params";

/**
 * Recomendaciones determinísticas sobre datos reales de Meta.
 * Este endpoint es estrictamente de lectura y queda protegido por `src/proxy.ts`
 * al vivir bajo `/api/meta/*`.
 */
export async function GET(req: NextRequest) {
  const parsed = parseAccountRangeParams(req.nextUrl.searchParams);
  if (!parsed.ok) return parsed.response;
  const { accountId, from, to } = parsed.params;

  try {
    const result = await generateRealDecisions(accountId, { from, to });
    return NextResponse.json(result);
  } catch (err) {
    return metaErrorResponse(err);
  }
}
