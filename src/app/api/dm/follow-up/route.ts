import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { followUpBlockMessage, pendingFollowUpState } from "@/lib/conversations/messageRequest";

/**
 * ★返事待ちの会話で、送り手がもう1通送れるか（2026-10-22 / A案）。画面の入力欄の出し分けに使う。
 *   判定は pendingFollowUpState の1か所（送る API と同じ）。⚠️ 断られた・ブロックされたことは返さない
 */
export const dynamic = "force-dynamic";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversationId = request.nextUrl.searchParams.get("conversationId") ?? "";
  if (!UUID_RE.test(conversationId)) return NextResponse.json({ state: { kind: "none" }, message: null });
  const { data: me, error } = await createAdminClient().from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[dm/follow-up] ow_users:", error.message);
  if (!me) return NextResponse.json({ state: { kind: "none" }, message: null });
  const state = await pendingFollowUpState(conversationId, me.id as string);
  if (!state) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  return NextResponse.json({ state, message: followUpBlockMessage(state) });
}
