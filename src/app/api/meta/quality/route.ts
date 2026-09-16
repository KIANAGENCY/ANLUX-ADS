import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const feedbackSchema = z.object({
  accountId: z.string().trim().min(1).max(128),
  campaignId: z.string().trim().min(1).max(128),
  periodTo: z.string().date(),
  qualifiedConversations: z.number().finite().min(0),
});

export async function POST(request: NextRequest) {
  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "La calidad indicada no es válida." }, { status: 400 });

  const client = await getSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { error } = await client.from("campaign_quality_feedback").upsert(
    {
      ad_account_id: parsed.data.accountId,
      campaign_id: parsed.data.campaignId,
      period_to: parsed.data.periodTo,
      qualified_conversations: parsed.data.qualifiedConversations,
      reported_by: authData.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ad_account_id,campaign_id,period_to,reported_by" }
  );
  if (error) {
    console.error("No se pudo guardar la calidad de conversaciones.", error);
    return NextResponse.json({ error: "No se pudo guardar la calidad de conversaciones." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
