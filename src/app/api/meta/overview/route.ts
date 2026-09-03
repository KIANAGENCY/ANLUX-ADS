import { NextRequest, NextResponse } from "next/server";
import { fetchAccountDailyMetrics } from "@/lib/meta/real/overview";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { parseAccountRangeParams } from "@/lib/meta/real/request-params";
import { getPreviousPeriod } from "@/lib/utils/dates";
import { aggregateMetrics, compareMetrics } from "@/lib/utils/metrics";

/**
 * KPIs de cuenta (comparación periodo actual/anterior) + serie diaria, para
 * el Overview. Lo consume `hooks/use-account-metrics.ts`.
 */
export async function GET(req: NextRequest) {
  const parsed = parseAccountRangeParams(req.nextUrl.searchParams);
  if (!parsed.ok) return parsed.response;
  const { accountId, from, to } = parsed.params;

  const previous = getPreviousPeriod({ from, to });

  try {
    const [currentRows, previousRows] = await Promise.all([
      fetchAccountDailyMetrics(accountId, from, to),
      fetchAccountDailyMetrics(accountId, previous.from, previous.to),
    ]);

    const comparison = compareMetrics(aggregateMetrics(currentRows), aggregateMetrics(previousRows));

    return NextResponse.json({ comparison, dailyRows: currentRows });
  } catch (err) {
    return metaErrorResponse(err);
  }
}
