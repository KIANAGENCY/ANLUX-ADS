import { NextResponse, type NextRequest } from "next/server";
import { parseAccountRangeParams } from "@/lib/meta/real/request-params";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { fetchMessagingReport } from "@/lib/meta/real/messaging";

export async function GET(req: NextRequest) {
  const parsed = parseAccountRangeParams(req.nextUrl.searchParams);
  if (!parsed.ok) return parsed.response;
  const { accountId, from, to } = parsed.params;
  try {
    return NextResponse.json(await fetchMessagingReport(accountId, from, to), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
