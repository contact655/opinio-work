import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";
import { ensureDmParticipants } from "@/lib/conversations/participants";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetUserId = request.nextUrl.searchParams.get("targetUserId");
  if (!targetUserId || !UUID_RE.test(targetUserId)) {
    return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
  }

  const { data: owMe } = await supabase.from("ow_users").select("id, name").eq("auth_id", authUser.id).maybeSingle();
  if (!owMe) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // 既存会話を探す（双方向）
  const { data: conv1 } = await admin.from("ow_conversations").select("id").eq("kind", "direct_message").eq("candidate_user_id", owMe.id).eq("mentor_user_id", targetUserId).maybeSingle();
  const { data: conv2 } = await admin.from("ow_conversations").select("id").eq("kind", "direct_message").eq("candidate_user_id", targetUserId).eq("mentor_user_id", owMe.id).maybeSingle();
  const conv = conv1 || conv2;

  if (!conv) return NextResponse.json({ conversation: null });

  const { data: participant } = await admin.from("ow_conversation_participants").select("id").eq("conversation_id", conv.id).eq("user_id", owMe.id).maybeSingle();

  /* ⚠️ GET は読み取りのまま。参加者を揃えるのは POST と
        `GET /api/dm/conversation`（会話を開くとき）の役目。 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages } = await (admin as any)
    .from("ow_conversation_messages")
    .select(`id, body, sent_at, sender_participant_id, ow_conversation_participants!sender_participant_id(ow_users(name))`)
    .eq("conversation_id", conv.id)
    .is("deleted_at", null)
    .order("sent_at", { ascending: true });

  return NextResponse.json({
    conversation: { id: conv.id, myParticipantId: participant?.id ?? null, myName: owMe.name },
    messages: messages ?? [],
  });
}

/**
 * DM を開始する。
 *
 * ⚠️ **このルートの責務は「会話と参加者を揃えること」。**
 *    会話行だけ作って参加者を作らない状態を残さない。
 *    2026-08-25 まで、新規作成時の参加者 INSERT は
 *    `role: 'initiator' / 'recipient'` で **必ず CHECK 違反（23514）** になり、
 *    既存会話の分岐は**そもそも参加者を作り直さなかった**。
 *    結果、参加者0件の会話が本番に2件残り、当事者は誰もメッセージを送れなかった。
 */
export async function POST(request: NextRequest) {
  const allowed = await checkRateLimit(request, { limit: 20, windowSec: 3600, prefix: "dm" });
  if (!allowed) return NextResponse.json({ error: "リクエストが多すぎます。しばらくしてから再試行してください。" }, { status: 429 });

  const supabase = createClient();
  const admin = createAdminClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { targetUserId: string; message?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { targetUserId, message } = body;

  if (!targetUserId || !UUID_RE.test(targetUserId)) {
    return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
  }
  if (message && message.trim().length > 2000) {
    return NextResponse.json({ error: "メッセージは2000文字以内で入力してください" }, { status: 400 });
  }

  // ow_users.id (app UUID) for the current auth user
  const { data: owMe } = await supabase
    .from("ow_users")
    .select("id, name")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (!owMe) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  if (owMe.id === targetUserId) {
    return NextResponse.json({ error: "Cannot DM yourself" }, { status: 400 });
  }

  // Check target user exists and has public visibility
  const { data: targetUser } = await admin
    .from("ow_users")
    .select("id, name, visibility")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!targetUser || targetUser.visibility === "private" || (targetUser.visibility === "login_only" && !owMe)) {
    return NextResponse.json({ error: "User not found or not accepting messages" }, { status: 404 });
  }

  // Check if DM conversation already exists between these two users (both directions)
  const { data: existing } = await admin
    .from("ow_conversations")
    .select("id")
    .eq("kind", "direct_message")
    .eq("candidate_user_id", owMe.id)
    .eq("mentor_user_id", targetUserId)
    .maybeSingle();

  const { data: existingReverse } = await admin
    .from("ow_conversations")
    .select("id")
    .eq("kind", "direct_message")
    .eq("candidate_user_id", targetUserId)
    .eq("mentor_user_id", owMe.id)
    .maybeSingle();

  let conversationId = (existing || existingReverse)?.id ?? null;
  const isNew = conversationId === null;

  if (!conversationId) {
    const { data: conv, error: convErr } = await admin
      .from("ow_conversations")
      .insert({
        kind: "direct_message",
        stage: "active",
        status: "active",
        candidate_user_id: owMe.id,
        mentor_user_id: targetUserId,
      })
      .select("id")
      .single();

    if (convErr || !conv) {
      console.error("[dm/start] conv insert error:", convErr);
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
    }
    conversationId = conv.id;
  }

  /* ⚠️ 新規・既存のどちらでも必ず両者ぶんを揃える。
        既存分岐で揃えないと、相手側は一覧に会話が出ず（可視性は参加者行で決まる）
        永久に開けないままになる。 */
  const participants = await ensureDmParticipants(admin, conversationId, [owMe.id, targetUserId]);
  if (!participants.ok) {
    console.error("[dm/start] ensureDmParticipants:", participants.error);
    return NextResponse.json({ error: participants.error }, { status: participants.status });
  }

  const myParticipantId = participants.byUserId.get(owMe.id) ?? null;
  if (!myParticipantId) {
    console.error("[dm/start] 自分の participant が揃わなかった conv=", conversationId);
    return NextResponse.json({ error: "参加者の登録に失敗しました" }, { status: 500 });
  }

  /* ⚠️ 本文は任意。`sender_participant_id` を null で入れない
        （送信者不明のメッセージは、本人の画面にも「相手の発言」として出る）。
     ⚠️ `last_message_at` はここで書かない。`trg_update_last_message_at`
        （AFTER INSERT）が `sent_at` で更新する。二重に書かない。 */
  if (message?.trim()) {
    const { error: msgErr } = await admin.from("ow_conversation_messages").insert({
      conversation_id: conversationId,
      sender_participant_id: myParticipantId,
      body: message.trim(),
    });
    if (msgErr) {
      console.error("[dm/start] message insert error:", msgErr.message);
      return NextResponse.json({ error: "メッセージの送信に失敗しました" }, { status: 500 });
    }
  }

  return NextResponse.json({ conversationId }, { status: isNew ? 201 : 200 });
}
