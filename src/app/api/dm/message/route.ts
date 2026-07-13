import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // participant レコードを取得（なければ自動作成）
  let { data: participant } = await admin
    .from("ow_conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", owMe.id)
    .maybeSingle();

  if (!participant) {
    const role = conv.candidate_user_id === owMe.id ? "initiator" : "recipient";
    const { data: created } = await admin
      .from("ow_conversation_participants")
      .insert({ conversation_id: conversationId, user_id: owMe.id, role })
      .select("id")
      .single();
    participant = created;
  }

  // メッセージ挿入（admin client で RLS バイパス）
  const { error: insertErr } = await admin
    .from("ow_conversation_messages")
    .insert({ conversation_id: conversationId, sender_participant_id: participant.id, body: message.trim() });

  if (insertErr) {
    console.error("[dm/message] insert error:", insertErr);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }

  // last_message_at 更新
  await admin.from("ow_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);

  return NextResponse.json({ ok: true });
}
