import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDmParticipants } from "@/lib/conversations/participants";
import { notifyNewMessage } from "@/lib/notify/messageNotification";
import { CONTACT_BLOCKED_MESSAGE, isMessagingBlocked } from "@/lib/conversations/contactGate";
import { companyConversationSendAllowed } from "@/lib/conversations/openReason";
import { NOT_ACCEPTED_MESSAGE, isDmSendable } from "@/lib/conversations/messageRequest";

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
    .select("id, kind, company_id, candidate_user_id, partner_user_id, request_status")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const isMember = conv.candidate_user_id === owMe.id || conv.partner_user_id === owMe.id;
  if (!isMember) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  /* ★企業の担当者から、その企業に見せてはいけない人へは送らない（2026-10-09 / 段階1）。
        相手は会話のもう一方の人。⚠️ 企業との会話（相手の個人が居ない）はここでは見ない（段階2）。
        ⚠️ 理由は返さない。判定は `lib/conversations/contactGate.ts` の1か所 */
  /* ⚠️★返事待ちのリクエストは、ブロックより先に 409 を返す（2026-10-11）。
        ブロックを先に見ると、ブロックされた送り手だけ 403 になり、ふつうの返事待ちと答えが変わって
        ブロックされたと分かってしまう。どちらにしても続きは送れない。 */
  if (conv.kind === "direct_message" && !isDmSendable(conv)) {
    return NextResponse.json({ error: NOT_ACCEPTED_MESSAGE }, { status: 409 });
  }
  const recipientId = conv.candidate_user_id === owMe.id ? conv.partner_user_id : conv.candidate_user_id;
  if (recipientId && (await isMessagingBlocked(owMe.id, recipientId as string))) {
    return NextResponse.json({ error: CONTACT_BLOCKED_MESSAGE }, { status: 403 });
  }

  /* ★企業との会話（2026-10-09 / 段階2）。
        ① **送るたびに**「開いてよい理由」がまだ有効かを確かめる（ブロック・在籍の判明の後は送れない。
           読むのは引き続きできる）。判定は `lib/conversations/openReason.ts` の1か所。
        ② **参加者の行を admin の権限で補わない。** 補うと、直接作った会話にも送れてしまう
           （2026-10-09 に実測した抜け道）。会話を作るときに `create_conversation` が足した行だけを使う。
        ⚠️ 理由は返さない */
  let senderParticipantId: string | undefined;
  if (conv.kind === "company") {
    if (!conv.company_id || !(await companyConversationSendAllowed({ candidateOwUserId: conv.candidate_user_id as string, companyId: conv.company_id as string, senderOwUserId: owMe.id as string }))) {
      return NextResponse.json({ error: CONTACT_BLOCKED_MESSAGE }, { status: 403 });
    }
    const { data: mine, error: mineErr } = await admin
      .from("ow_conversation_participants")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", owMe.id)
      .is("left_at", null)
      .maybeSingle();
    if (mineErr) console.error("[dm/message] participants:", mineErr.message);
    if (!mine) return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    senderParticipantId = mine.id as string;
  } else {
    /* ★メッセージのお願い（2026-10-09 / 段階3）。承認されるまで続きは送れない。
          ⚠️ 受け手は承認前は参加者でもないので、ここに来る前提が無い（来ても送らせない）。
          ⚠️ 判定は `lib/conversations/messageRequest.ts` の `isDmSendable`。 */
    if (!isDmSendable(conv)) {
      return NextResponse.json({ error: NOT_ACCEPTED_MESSAGE }, { status: 409 });
    }
    /* 参加者を冪等に揃える（両者ぶん）。⚠️ 承認済みのときだけ（承認前に受け手を足すと本文が読める）
       ⚠️ 失敗を握りつぶさない。2026-08-25 まで INSERT の error を受けておらず、
          participant が null のまま `sender_participant_id: null` で
          メッセージを入れられた。この列は nullable なので **INSERT は成功してしまい**、
          送信者不明の行ができる。DM の画面は
          `sender_participant_id === myParticipantId` で左右を決めるため、
          その行は**送った本人にも「相手の発言」として表示される**。 */
    const participants = await ensureDmParticipants(admin, conversationId, [
      owMe.id,
      conv.candidate_user_id,
      conv.partner_user_id,
    ]);
    if (!participants.ok) {
      console.error("[dm/message] ensureDmParticipants:", participants.error);
      return NextResponse.json({ error: participants.error }, { status: participants.status });
    }

    senderParticipantId = participants.byUserId.get(owMe.id);
    if (!senderParticipantId) {
      console.error("[dm/message] 送信者の participant が揃わなかった conv=", conversationId);
      return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
    }
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

  /* ★受信者の通知に積む（2026-09-16）。⚠️ best-effort ——失敗しても送信は成功のまま。
        ⚠️★**条件をここに書かないこと。** 宛先の決め方は `notifyNewMessage` の1箇所。 */
  await notifyNewMessage({ conversationId, senderOwUserId: owMe.id, source: "dm/message" });

  return NextResponse.json({ ok: true });
}
