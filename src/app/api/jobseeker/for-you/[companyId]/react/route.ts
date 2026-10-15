import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reactForYou } from "@/lib/forYou/react";

export const dynamic = "force-dynamic";

/**
 * 「あなたに合う順」（/mypage/for-you）での反応（興味あり／あとで／興味なし）。
 *
 * ⚠️★`ow_for_you_reactions` の書き込みは service_role のみ（authenticated に INSERT/UPDATE の GRANT が無い）。
 *    本人の行であることはここで確かめる（ログイン中の本人の ow_users.id でしか書かない）。
 * ⚠️ 会社が本人の一覧に出ているかは reactForYou が確かめる（出ていなければ 404）。
 */
export async function POST(req: NextRequest, { params }: { params: { companyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = createAdminClient();
  /* auth.uid() は auth.users.id。記録は ow_users.id で持つので引き直す */
  const { data: me, error: meErr } = await db
    .from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[jobseeker/for-you] ow_users:", meErr.message);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const out = await reactForYou({
    owUserId: me.id as string,
    companyId: params.companyId,
    reaction: body.reaction,
    reason: body.reason,
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json(out.result === "conversation"
    ? { ok: true, result: out.result, conversationId: out.conversationId }
    : { ok: true, result: out.result });
}
