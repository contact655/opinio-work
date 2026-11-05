import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consultAboutOptions } from "@/lib/conversations/consult";
import { optionKeyForExperience } from "@/lib/constants/careerConsult";

/**
 * ★会話の中の「相談する」で出す「聞きたい話」の選択肢（2026-11-05）。
 *   相手（会話のもう一方の人）の職歴から作る。送るときの確かめ（resolveConsult）と同じ consultAboutOptions を通る。
 *   GET ?conversationId=…&aboutExperienceId=…（任意。「この経験について聞く」から来たとき、その職歴を選んだ状態にする）
 * ⚠️ 個人どうしの会話の当事者だけ。それ以外は空を返す（会話の存在を区別しない）
 */
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversationId = request.nextUrl.searchParams.get("conversationId") ?? "";
  const empty = NextResponse.json({ options: [], selectedAbout: null });
  if (!UUID_RE.test(conversationId)) return empty;

  const admin = createAdminClient();
  const { data: me, error: meErr } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[dm/consult-options] ow_users:", meErr.message);
  if (!me) return empty;
  const { data: conv, error } = await admin.from("ow_conversations")
    .select("kind, candidate_user_id, partner_user_id").eq("id", conversationId).maybeSingle();
  if (error) {
    console.error("[dm/consult-options] conversation:", error.message);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
  if (!conv || conv.kind !== "direct_message") return empty;
  const other = conv.candidate_user_id === me.id ? conv.partner_user_id : conv.partner_user_id === me.id ? conv.candidate_user_id : null;
  if (!other) return empty;
  const options = await consultAboutOptions(other as string);
  if (!options) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  const expRaw = request.nextUrl.searchParams.get("aboutExperienceId");
  const selectedAbout = optionKeyForExperience(options, expRaw && UUID_RE.test(expRaw) ? expRaw : null);
  return NextResponse.json({ options, selectedAbout }, { headers: { "Cache-Control": "private, no-store" } });
}
