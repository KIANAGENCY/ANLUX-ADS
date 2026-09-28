import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { canAccessAnlux } from "@/lib/supabase/access";
import { ACTIVE_META_CLIENT } from "@/lib/meta/account-binding";
import { isMemoryEnabled } from "@/lib/memory/config";

async function authorize() {
  if (!isMemoryEnabled()) return null;
  const client = await getSupabaseServerClient();
  const user = client ? (await client.auth.getUser()).data.user : null;
  return client && user && canAccessAnlux(user) ? { client, user } : null;
}

export async function GET() {
  const auth = await authorize();
  if (!auth) return NextResponse.json({ error: "Memoria no disponible o acceso no autorizado." }, { status: 403 });
  const { data, error } = await auth.client.from("decision_history")
    .select("id,entity_name,action,rationale,period_from,period_to,stored_at,result_type")
    .eq("ad_account_id", ACTIVE_META_CLIENT.adAccountId).eq("entity_type", "campaign")
    .order("stored_at", { ascending: false }).order("id", { ascending: false }).limit(20);
  if (error) return NextResponse.json({ error: "No se pudo leer el historial." }, { status: 503 });
  if (!data?.length) return NextResponse.json({ decisions: [] });
  const feedback = await auth.client.from("decision_feedback").select("decision_id,outcome,notes")
    .eq("reviewed_by", auth.user.id).in("decision_id", data.map(row => row.id));
  if (feedback.error) return NextResponse.json({ error: "No se pudo leer tu revisión." }, { status: 503 });
  return NextResponse.json({ decisions: data.map(row => ({ ...row, feedback: feedback.data?.find(item => item.decision_id === row.id) ?? null })) });
}

const schema = z.object({ decisionId: z.number().int().positive(), outcome: z.enum(["accepted", "rejected", "deferred"]), notes: z.string().trim().max(2000).default("") });
export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth) return NextResponse.json({ error: "Memoria no disponible o acceso no autorizado." }, { status: 403 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Revisión no válida." }, { status: 400 });
  const { data: decision, error: readError } = await auth.client.from("decision_history").select("id")
    .eq("id", input.data.decisionId).eq("ad_account_id", ACTIVE_META_CLIENT.adAccountId).maybeSingle();
  if (readError) return NextResponse.json({ error: "No se pudo verificar la decisión." }, { status: 503 });
  if (!decision) return NextResponse.json({ error: "Decisión no disponible." }, { status: 404 });
  const { error } = await auth.client.from("decision_feedback").upsert({ decision_id: decision.id, reviewed_by: auth.user.id, outcome: input.data.outcome, notes: input.data.notes || null }, { onConflict: "decision_id,reviewed_by" });
  if (error) return NextResponse.json({ error: "No se pudo guardar la revisión." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
