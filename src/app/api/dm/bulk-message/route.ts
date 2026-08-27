import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDmParticipants } from "@/lib/conversations/participants";
import { MAX_BULK_RECIPIENTS, MAX_DM_LENGTH } from "@/lib/constants/messages";

export const dynamic = "force-dynamic";

/**
 * 同じ本文を、複数の会話へ**それぞれ個別に**送る（2026-08-27）。
 *
 * ★**グループ会話ではない。** 宛先ごとに既存の1対1の会話へ1通ずつ入れる。
 *   受け取った側からは通常のメッセージと区別がつかず、**他の宛先も見えない。**
 *   ⚠️ ここをグループ化しないこと。`ow_conversations` は
 *      「候補者1人 ↔ 企業1社（またはメンター1人）」の形で、
 *      参加者を増やすと `/biz` 側の会話画面と権限（`join`）の前提が崩れる。
 *
 * ⚠️ **新しく会話を作らない。** 送れるのは**すでにある会話**だけ。
 *    会話は応募・スカウト返信・カジュアル面談から作られる（`create_conversation`）。
 *    ここから任意の相手に送れるようにすると、**面識のない企業へ一斉送信できてしまう。**
 *
 * ⚠️ **1件ずつ結果を返す。** 途中で失敗しても残りは送る。
 *    「全部送れた」か「全部失敗した」しか言えないと、利用者は**誰に届いたのか**が
 *    分からず、同じ本文をもう一度送ることになる。
 *
 * ⚠️ 認証は `createClient`、データは `createAdminClient`。
 *    **`/api/dm/message` と同じ形**（あちらを直すときはここも見ること）。
 *    admin は RLS をバイパスするので、**会話ごとに本人が当事者かを必ず確かめる。**
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result = { conversationId: string; ok: boolean; error?: string };

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { conversationIds?: unknown; message?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json(
      { error: "EMPTY_MESSAGE", message: "メッセージを入力してください。" },
      { status: 400 },
    );
  }
  if (message.length > MAX_DM_LENGTH) {
    return NextResponse.json(
      { error: "TOO_LONG", message: `メッセージは${MAX_DM_LENGTH}文字以内で入力してください。` },
      { status: 400 },
    );
  }

  /* ⚠️ 重複を潰す。同じ会話を2回選べる UI ではないが、
        送信直前に一覧が変わると同じ id が並びうる。**同じ人に2通送らない。** */
  const ids = Array.isArray(body.conversationIds)
    ? Array.from(new Set(body.conversationIds.filter((v): v is string => typeof v === "string")))
    : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "NO_RECIPIENT", message: "宛先を1つ以上選んでください。" },
      { status: 400 },
    );
  }
  if (ids.length > MAX_BULK_RECIPIENTS) {
    return NextResponse.json(
      { error: "TOO_MANY_RECIPIENTS", message: `宛先は${MAX_BULK_RECIPIENTS}件までです。` },
      { status: 400 },
    );
  }
  if (ids.some((id) => !UUID_RE.test(id))) {
    return NextResponse.json({ error: "INVALID_ID", message: "宛先の指定が不正です。" }, { status: 400 });
  }

  const { data: owMe } = await supabase
    .from("ow_users").select("id").eq("auth_id", authUser.id).maybeSingle();
  if (!owMe) return NextResponse.json({ error: "User not found" }, { status: 404 });

  /* ★当事者である会話だけに絞る。⚠️ **一度にまとめて引いて確かめる。**
        件数ぶんクエリを撃つと、宛先が増えるほど遅くなり、途中で失敗しやすくなる。 */
  const { data: convs, error: convErr } = await admin
    .from("ow_conversations")
    .select("id, candidate_user_id, mentor_user_id")
    .in("id", ids);
  if (convErr) {
    console.error("[dm/bulk-message] conversations:", convErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  const byId = new Map((convs ?? []).map((c) => [c.id as string, c]));

  const results: Result[] = [];
  for (const conversationId of ids) {
    const conv = byId.get(conversationId);
    if (!conv) { results.push({ conversationId, ok: false, error: "会話が見つかりません" }); continue; }
    /* ⚠️ admin で引いているので RLS は効かない。**ここで当事者かを見る。** */
    if (conv.candidate_user_id !== owMe.id && conv.mentor_user_id !== owMe.id) {
      results.push({ conversationId, ok: false, error: "この会話には送れません" });
      continue;
    }

    /* ⚠️ `sender_participant_id` が null のまま INSERT できてしまうと、
          **送った本人にも「相手の発言」として表示される**（/api/dm/message の注記）。
          参加者が揃わなかったら、その会話へは送らない。 */
    const participants = await ensureDmParticipants(admin, conversationId, [
      owMe.id, conv.candidate_user_id, conv.mentor_user_id,
    ]);
    if (!participants.ok) {
      console.error("[dm/bulk-message] ensureDmParticipants:", conversationId, participants.error);
      results.push({ conversationId, ok: false, error: "送信に失敗しました" });
      continue;
    }
    const senderParticipantId = participants.byUserId.get(owMe.id);
    if (!senderParticipantId) {
      console.error("[dm/bulk-message] 送信者の participant が揃わなかった conv=", conversationId);
      results.push({ conversationId, ok: false, error: "送信に失敗しました" });
      continue;
    }

    const { error: insertErr } = await admin
      .from("ow_conversation_messages")
      .insert({ conversation_id: conversationId, sender_participant_id: senderParticipantId, body: message });
    if (insertErr) {
      console.error("[dm/bulk-message] insert:", conversationId, insertErr.message);
      results.push({ conversationId, ok: false, error: "送信に失敗しました" });
      continue;
    }

    /* ⚠️ 一覧の並び替えに使う。失敗しても本文は入っているので、送信自体は成功扱い。 */
    const { error: touchErr } = await admin
      .from("ow_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
    if (touchErr) console.error("[dm/bulk-message] last_message_at:", conversationId, touchErr.message);

    results.push({ conversationId, ok: true });
  }

  const sent = results.filter((r) => r.ok).length;
  /* ⚠️ 1件でも送れていれば 200。**どれが失敗したかは results で返す。**
        全部失敗のときだけ 502（相手側の問題であってリクエストの誤りではない）。 */
  return NextResponse.json({ sent, total: ids.length, results }, { status: sent > 0 ? 200 : 502 });
}
