import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dmTopicSections } from "@/lib/conversations/dmTopics";

/**
 * ★返信欄の「＋ 聞きたいことを添える」で出す選択肢（2026-10-22）。
 *   相手（会話のもう一方の人）に選べるテーマ。送るときの確かめ（resolveAsk）と同じ dmTopicContext を通る。
 *   ⚠️ 個人どうしの会話の当事者だけ。それ以外は空を返す（会話の存在を区別しない）
 */
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversationId = request.nextUrl.searchParams.get("conversationId") ?? "";
  if (!UUID_RE.test(conversationId)) return NextResponse.json({ sections: [] });

  const admin = createAdminClient();
  const { data: me, error: meErr } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[dm/topics] ow_users:", meErr.message);
  if (!me) return NextResponse.json({ sections: [] });
  const { data: conv, error } = await admin.from("ow_conversations")
    .select("kind, candidate_user_id, partner_user_id").eq("id", conversationId).maybeSingle();
  if (error) {
    console.error("[dm/topics] conversation:", error.message);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
  if (!conv || conv.kind !== "direct_message") return NextResponse.json({ sections: [] });
  const other = conv.candidate_user_id === me.id ? conv.partner_user_id : conv.partner_user_id === me.id ? conv.candidate_user_id : null;
  if (!other) return NextResponse.json({ sections: [] });
  const sections = await dmTopicSections(other as string);
  if (!sections) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  return NextResponse.json({ sections });
}
