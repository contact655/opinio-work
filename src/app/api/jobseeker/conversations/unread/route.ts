import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { countUnreadConversations } from "@/lib/conversations/unread";

/**
 * 未読のある会話の数。**ヘッダーのメッセージアイコンのバッジ用**（2026-10-01）。
 *
 * ⚠️★**数え方は `lib/conversations/unread` の1箇所。** `/mypage` のサイドバーと
 *    会話一覧のドットが同じ式を見ている。ここに別の数え方を書かないこと
 *    （2026-09-20 に「バッジは7日以内の動き／ドットは未読」と割れていた前例がある）。
 *
 * ⚠️ 返すのは**会話数**（通数ではない）。一覧のドットと粒度を揃えるため。
 * ⚠️ 失敗しても 0 を返す（ヘルパー側がログを出す）。バッジは主役ではないので
 *    ヘッダーごと落とさない。
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser?.id) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const conversations = await countUnreadConversations(owUser.id);
  return NextResponse.json({ conversations });
}
