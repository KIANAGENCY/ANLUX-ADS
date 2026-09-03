import { NextRequest, NextResponse } from "next/server";
import { generateRealAlerts } from "@/lib/alerts/real-engine";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { parseAccountRangeParams } from "@/lib/meta/real/request-params";

/**
 * Alertas de performance de una cuenta de Meta, calculadas por
 * `generateRealAlerts()` sobre datos de Meta Marketing API. Si Meta no
 * devuelve campañas o ad sets, la lista de alertas queda vacía.
 */
export async function GET(req: NextRequest) {
  const parsed = parseAccountRangeParams(req.nextUrl.searchParams);
  if (!parsed.ok) return parsed.response;
  const { accountId, from, to } = parsed.params;

  try {
    const alerts = await generateRealAlerts(accountId, { from, to });
    return NextResponse.json({ alerts });
  } catch (err) {
    return metaErrorResponse(err);
  }
}
