import { NextRequest, NextResponse } from "next/server";
import { deriveMessagingTarget } from "@/lib/intelligence/target-derivation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isActiveMetaAdAccount } from "@/lib/meta/account-binding";

const accountIdPattern = /^act_\d{1,30}$/;

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId")?.trim() ?? "";
  if (!accountIdPattern.test(accountId)) return NextResponse.json({ error: "accountId inválido." }, { status: 400 });
  if (!isActiveMetaAdAccount(accountId)) return NextResponse.json({ error: "Cuenta no autorizada." }, { status: 403 });

  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });

  const { data, error } = await client.from("decision_history")
    .select("period_from,period_to,objective,metrics_current")
    .eq("ad_account_id", accountId)
    .eq("entity_type", "campaign");
  if (error) return NextResponse.json({ error: "No se pudo consultar el historial real." }, { status: 503 });

  const proposal = deriveMessagingTarget((data ?? []).map((row) => {
    const metrics = row.metrics_current && typeof row.metrics_current === "object" ? row.metrics_current as Record<string, unknown> : {};
    return {
      periodFrom: row.period_from,
      periodTo: row.period_to,
      objective: row.objective,
      costPerResult: typeof metrics.costPerResult === "number" ? metrics.costPerResult : null,
      results: typeof metrics.results === "number" ? metrics.results : null,
    };
  }));
  return NextResponse.json({ proposal });
}
