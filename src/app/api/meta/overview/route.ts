import { NextRequest, NextResponse } from "next/server";
import { fetchAccountDailyMetrics, fetchAccountRangeMetrics } from "@/lib/meta/real/overview";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { parseAccountRangeParams } from "@/lib/meta/real/request-params";
import { getPreviousPeriod } from "@/lib/utils/dates";
import { compareMetrics } from "@/lib/utils/metrics";

/**
 * KPIs de cuenta (comparación periodo actual/anterior) + serie diaria.
 *
 * Los KPIs usan un insight agregado por rango para mantener reach/frequency
 * deduplicados por Meta. La serie diaria se obtiene por separado solo para la gráfica.
 */
export async function GET(req: NextRequest) {
  const parsed = parseAccountRangeParams(req.nextUrl.searchParams);
  if (!parsed.ok) return parsed.response;
  const { accountId, from, to } = parsed.params;

  const previous = getPreviousPeriod({ from, to });

  try {
    const [currentMetrics, previousMetrics, dailyRows] = await Promise.all([
      fetchAccountRangeMetrics(accountId, from, to),
      fetchAccountRangeMetrics(accountId, previous.from, previous.to),
      fetchAccountDailyMetrics(accountId, from, to),
    ]);

    return NextResponse.json({
      comparison: compareMetrics(currentMetrics, previousMetrics),
      dailyRows,
    });
  } catch (err) {
    return metaErrorResponse(err);
  }
}
