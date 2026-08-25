import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDmParticipants } from "@/lib/conversations/participants";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { conversationId: string; message: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { conversationId, message } = body;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!conversationId || !UUID_RE.test(conversationId) || !message?.trim()) {
    return NextResponse.json({ error: "conversationId and message are required" }, { status: 400 });
  }
  if (message.trim().length > 5000) {
    return NextResponse.json({ error: "メッセージは5000文字以内で入力してください" }, { status: 400 });
  }

  // 送信者の ow_users.id を取得
  const { data: owMe } = await supabase.from("ow_users").select("id").eq("auth_id", authUser.id).maybeSingle();
  if (!owMe) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // 会話メンバーであることを確認（candidate または mentor）
  const { data: conv } = await admin
    .from("ow_conversations")
    .select("id, candidate_user_id, mentor_user_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const isMember = conv.candidate_user_id === owMe.id || conv.mentor_user_id === owMe.id;
  if (!isMember) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  /* 参加者を冪等に揃える（両者ぶん）。
     ⚠️ 失敗を握りつぶさない。2026-08-25 まで INSERT の error を受けておらず、
        participant が null のまま `sender_participant_id: null` で
        メッセージを入れられた。この列は nullable なので **INSERT は成功してしまい**、
        送信者不明の行ができる。DM の画面は
        `sender_participant_id === myParticipantId` で左右を決めるため、
        その行は**送った本人にも「相手の発言」として表示される**。 */
  const participants = await ensureDmParticipants(admin, conversationId, [
    owMe.id,
    conv.candidate_user_id,
    conv.mentor_user_id,
  ]);
  if (!participants.ok) {
    console.error("[dm/message] ensureDmParticipants:", participants.error);
    return NextResponse.json({ error: participants.error }, { status: participants.status });
  }

  const senderParticipantId = participants.byUserId.get(owMe.id);
  if (!senderParticipantId) {
    console.error("[dm/message] 送信者の participant が揃わなかった conv=", conversationId);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }

  // メッセージ挿入（admin client で RLS バイパス）
  const { error: insertErr } = await admin
    .from("ow_conversation_messages")
    .insert({ conversation_id: conversationId, sender_participant_id: senderParticipantId, body: message.trim() });

  if (insertErr) {
    console.error("[dm/message] insert error:", insertErr.message);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }

  /* ⚠️ `last_message_at` はここで書かない。`trg_update_last_message_at`
        （ow_conversation_messages の AFTER INSERT）が `sent_at` で更新する。 */

  return NextResponse.json({ ok: true });
}
