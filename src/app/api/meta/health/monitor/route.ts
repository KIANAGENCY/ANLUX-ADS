import { NextResponse } from "next/server";
import { checkMetaHealth } from "@/lib/meta/real/health";

/** Machine-readable status; /api/meta/health retains its UI-oriented body. */
export async function GET() {
  try {
    const report = await checkMetaHealth();
    return NextResponse.json(report, {
      status: report.status === "ok" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ status: "temporary_error" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
