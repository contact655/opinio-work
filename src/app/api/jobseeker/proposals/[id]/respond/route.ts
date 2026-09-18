import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveProposalResponse } from "@/lib/evidence/respond";
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

  const { data: proposal, error: pErr } = await db
    .from("ow_proposals").select("id, candidate_user_id").eq("id", params.id).maybeSingle();
  if (pErr) console.error("[jobseeker/proposals] ow_proposals:", pErr.message);
  /* ⚠️ 他人の提案は 404。403 にすると「その id の提案は在る」と教えることになる */
  if (!proposal || proposal.candidate_user_id !== me.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const response = String(body.response ?? "");
  if (!isCandidateResponse(response)) {
    return NextResponse.json({ error: "invalid response" }, { status: 400 });
  }

  const out = await saveProposalResponse({
    proposalId: params.id,
    side: "candidate",
    response,
    reason: typeof body.reason === "string" ? body.reason : null,
    note: typeof body.note === "string" ? body.note : null,
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true });
}
