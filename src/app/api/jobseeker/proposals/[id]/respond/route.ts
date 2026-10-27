import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveCandidateResponse } from "@/lib/evidence/respond";
import { isCandidateResponse } from "@/lib/constants/proposalResponses";

export const dynamic = "force-dynamic";

/**
 * ② 求職者が提案に答える。
 *
 * ⚠️★**本人の提案であることを必ず確かめる。** `ow_proposals` の書き込みは
 *    service_role のみ（`authenticated` に INSERT/UPDATE の GRANT が無い）なので、
 *    **RLS は守ってくれない。** ここが唯一の関門。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = createAdminClient();
  /* auth.uid() は auth.users.id。提案が持つのは ow_users.id なので引き直す */
  const { data: me, error: meErr } = await db
    .from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[jobseeker/proposals] ow_users:", meErr.message);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const response = String(body.response ?? "");
  if (!isCandidateResponse(response)) {
    return NextResponse.json({ error: "invalid response" }, { status: 400 });
  }

  /* ⚠️ 本人の提案かは saveCandidateResponse が candidate_user_id で絞って確かめる（他人の提案は 404） */
  const out = await saveCandidateResponse({
    proposalId: params.id,
    candidateUserId: me.id as string,
    response,
    note: typeof body.note === "string" ? body.note : null,
    consentVersion: body.consentVersion,
    reason: typeof body.reason === "string" ? body.reason : null,
    declineNote: typeof body.declineNote === "string" ? body.declineNote : null,
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true, conversationId: out.conversationId ?? null });
}
