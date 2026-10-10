/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDmParticipants } from "@/lib/conversations/participants";
import { notifyNewMessage } from "@/lib/notify/messageNotification";
import { CONTACT_BLOCKED_MESSAGE, isMessagingBlocked } from "@/lib/conversations/contactGate";
import {
  MAX_MESSAGE_REQUEST_LENGTH,
  MESSAGE_REQUEST_DAILY_LIMIT,
  MESSAGE_REQUEST_OPEN_LIMIT,
} from "@/lib/constants/messages";

/**
 * ★DM の「メッセージのお願い」（2026-10-09 / 段階3）。**判定と書き込みはここの1か所。**
 *
 * | 段 | 送り手（candidate_user_id） | 受け手（partner_user_id） |
 * |---|---|---|
 * | 承認待ち（pending） | 自分の1通が見える。続きは送れない | **参加者に入っていない**。本文は読めない。「お願い」の欄に出る |
 * | 断った | **承認待ちのまま見える**（断ったことは伝えない） | 「お願い」の欄から消える |
 * | 承認済み（accepted） | 通常の DM | 参加者に入る。通常の DM |
 *
 * ⚠️★**断った記録は `ow_conversations` に書かない。** 送り手は自分の会話の行を PostgREST から
 *    読めるので、列に書くと断られたことが分かる。`ow_message_request_declines`（admin のみ）に置く。
 * ⚠️★**受け手を承認前に参加者へ足さないこと。** 足した瞬間に RLS（参加者なら読める）で本文が読める。
 *    `ensureDmParticipants` を両者ぶん呼ぶのは承認済みのときだけ。
 * ⚠️ 止めた理由のうち、相手の状態に関わるもの（ブロック・転職意欲・検証用か）は返さない
 *    （`CONTACT_BLOCKED_MESSAGE`）。上限や重複のような**送り手自身の事実**は、事実どおりに返す。
 */

export const NOT_ACCEPTED_MESSAGE = "まだ返信がありません。返信があると続きを送れます";

const MSG = {
  daily: `本日はこれ以上メッセージリクエストを送れません（1日${MESSAGE_REQUEST_DAILY_LIMIT}件まで）`,
  open: `返事待ちのリクエストが${MESSAGE_REQUEST_OPEN_LIMIT}件あるため、これ以上リクエストを送れません`,
  outgoing: "この方にはすでにメッセージリクエストを送っています。返信があると続きを送れます",
  incoming: "この方からメッセージリクエストが届いています。メッセージ一覧から返信できます",
  exists: "この方とのメッセージはすでに始まっています",
  failed: "送信に失敗しました。もう一度お試しください",
} as const;

export type DmState =
  | { kind: "none" }
  | { kind: "accepted"; conversationId: string }
  /** 自分が送ったお願い。⚠️ 断られていても「承認待ち」として扱う */
  | { kind: "outgoing_pending"; conversationId: string }
  | { kind: "incoming_pending"; conversationId: string }
  /** 自分が断ったお願い */
  | { kind: "incoming_declined"; conversationId: string };

/** 2人のあいだの DM の段。取得に失敗したら null（呼び出し側は止める） */
export async function getDmState(meId: string, otherId: string): Promise<DmState | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("ow_conversations")
    .select("id, candidate_user_id, partner_user_id, request_status")
    .eq("kind", "direct_message")
    .or(`and(candidate_user_id.eq.${meId},partner_user_id.eq.${otherId}),and(candidate_user_id.eq.${otherId},partner_user_id.eq.${meId})`)
    .maybeSingle();
  if (error) {
    console.error("[messageRequest] getDmState:", error.message);
    return null;
  }
  if (!data) return { kind: "none" };
  const id = data.id as string;
  if (data.request_status === "accepted") return { kind: "accepted", conversationId: id };
  if (data.candidate_user_id === meId) return { kind: "outgoing_pending", conversationId: id };
  const declined = await isDeclined(id);
  if (declined === null) return null;
  return declined ? { kind: "incoming_declined", conversationId: id } : { kind: "incoming_pending", conversationId: id };
}

async function isDeclined(conversationId: string): Promise<boolean | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("ow_message_request_declines").select("conversation_id").eq("conversation_id", conversationId).maybeSingle();
  if (error) {
    console.error("[messageRequest] declines:", error.message);
    return null;
  }
  return !!data;
}

/** 日本時間の今日の0時（UTC の ISO 文字列） */
function startOfTodayJst(now = new Date()): string {
  const JST = 9 * 60 * 60 * 1000;
  const DAY = 24 * 60 * 60 * 1000;
  return new Date(Math.floor((now.getTime() + JST) / DAY) * DAY - JST).toISOString();
}

export type RequestQuota = { dailyUsed: number; openCount: number; dailyLimit: number; openLimit: number };

/** 送り手の残り枠。取得に失敗したら null（呼び出し側は止める） */
export async function getRequestQuota(meId: string): Promise<RequestQuota | null> {
  const db = createAdminClient();
  const [daily, open] = await Promise.all([
    db.from("ow_conversations").select("id", { count: "exact", head: true })
      .eq("kind", "direct_message").eq("candidate_user_id", meId).gte("requested_at", startOfTodayJst()),
    /* ⚠️ 断られたものも pending のまま残る（断った記録は別の表）ので、ここで一緒に数える */
    db.from("ow_conversations").select("id", { count: "exact", head: true })
      .eq("kind", "direct_message").eq("candidate_user_id", meId).eq("request_status", "pending"),
  ]);
  if (daily.error || open.error) {
    console.error("[messageRequest] quota:", daily.error?.message ?? open.error?.message);
    return null;
  }
  return {
    dailyUsed: daily.count ?? 0,
    openCount: open.count ?? 0,
    dailyLimit: MESSAGE_REQUEST_DAILY_LIMIT,
    openLimit: MESSAGE_REQUEST_OPEN_LIMIT,
  };
}

/** 枠が尽きていれば、その文言を返す */
export function quotaBlockMessage(q: RequestQuota): string | null {
  if (q.dailyUsed >= q.dailyLimit) return MSG.daily;
  if (q.openCount >= q.openLimit) return MSG.open;
  return null;
}

/** 段に応じて「新しいお願いを送れない」文言を返す（送れるなら null） */
export function stateBlockMessage(state: DmState): string | null {
  switch (state.kind) {
    case "none": return null;
    case "accepted": return MSG.exists;
    case "outgoing_pending": return MSG.outgoing;
    case "incoming_pending": return MSG.incoming;
    /* ⚠️ 自分が断った相手。理由は出さない */
    case "incoming_declined": return CONTACT_BLOCKED_MESSAGE;
  }
}

export type SendResult =
  | { ok: true; conversationId: string }
  | { ok: false; status: number; error: string };

/** お願いを送る（会話・送り手の参加者行・最初の1通・受け手への通知） */
export async function sendMessageRequest(params: {
  senderId: string;
  recipientId: string;
  body: string;
}): Promise<SendResult> {
  const { senderId, recipientId } = params;
  const body = params.body.trim();
  if (!body) return { ok: false, status: 400, error: "メッセージを入力してください" };
  if (body.length > MAX_MESSAGE_REQUEST_LENGTH) {
    return { ok: false, status: 400, error: `メッセージは${MAX_MESSAGE_REQUEST_LENGTH}文字以内で入力してください` };
  }
  if (senderId === recipientId) return { ok: false, status: 400, error: "自分には送れません" };

  /* ① 既にある DM。⚠️★ブロックより先に見る（2026-10-11）。
        自分が送って返事待ちのものがあれば、相手がブロックしていても「すでに送っています」（409）を返す。
        ブロックを先に見ると 403 になり、**ふつうの返事待ちと違う答えでブロックされたと分かってしまう。** */
  const state = await getDmState(senderId, recipientId);
  if (!state) return { ok: false, status: 500, error: MSG.failed };
  const stateMsg = stateBlockMessage(state);
  if (stateMsg) return { ok: false, status: state.kind === "incoming_declined" ? 403 : 409, error: stateMsg };
  /* ② 相手に関わる理由（理由は返さない） */
  if (await isMessagingBlocked(senderId, recipientId)) {
    return { ok: false, status: 403, error: CONTACT_BLOCKED_MESSAGE };
  }
  /* ③ 送り手の枠 */
  const quota = await getRequestQuota(senderId);
  if (!quota) return { ok: false, status: 500, error: MSG.failed };
  const quotaMsg = quotaBlockMessage(quota);
  if (quotaMsg) return { ok: false, status: 429, error: quotaMsg };

  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data: conv, error: convErr } = await db
    .from("ow_conversations")
    .insert({
      kind: "direct_message",
      stage: "active",
      status: "active",
      candidate_user_id: senderId,
      partner_user_id: recipientId,
      request_status: "pending",
      requested_at: now,
    })
    .select("id")
    .single();
  if (convErr || !conv) {
    /* ⚠️ 同時に送ったとき。一意の索引（向きに関係なく2人で1本）が止める */
    if (convErr?.code === "23505") return { ok: false, status: 409, error: MSG.exists };
    console.error("[messageRequest] conversation insert:", convErr?.message);
    return { ok: false, status: 500, error: MSG.failed };
  }
  const conversationId = conv.id as string;

  /* ⚠️★参加者は送り手だけ。受け手は承認したときに足す */
  const parts = await ensureDmParticipants(db, conversationId, [senderId]);
  const senderParticipantId = parts.ok ? parts.byUserId.get(senderId) : undefined;
  if (!senderParticipantId) {
    console.error("[messageRequest] participant:", parts.ok ? "missing" : parts.error);
    await db.from("ow_conversations").delete().eq("id", conversationId);
    return { ok: false, status: 500, error: MSG.failed };
  }

  const { error: msgErr } = await db.from("ow_conversation_messages").insert({
    conversation_id: conversationId,
    sender_participant_id: senderParticipantId,
    body,
  });
  if (msgErr) {
    console.error("[messageRequest] message insert:", msgErr.message);
    /* ⚠️ 本文の無いお願いを残さない（枠だけ減って、相手には何も届かない形になる） */
    await db.from("ow_conversations").delete().eq("id", conversationId);
    return { ok: false, status: 500, error: MSG.failed };
  }

  /* 受け手への通知。⚠️ best-effort。本文は載せない（ベルの決まり） */
  const { error: nErr } = await db.from("ow_notifications").insert({
    recipient_user_id: recipientId,
    actor_user_id: senderId,
    type: "message_request",
    conversation_id: conversationId,
  });
  if (nErr) console.error("[messageRequest] notify request:", nErr.message);

  return { ok: true, conversationId };
}

export type RespondAction = "decline" | "block" | "report";

/**
 * 受け手が「今回は見送る」「ブロック」「運営に報告」を押す（2026-10-11 に「承認」を外した。返信は `replyToMessageRequest`）。
 * ⚠️★見送り・ブロックは送り手に何も伝えない（通知も出さない・会話の行も変えない。送り手には「返事待ち」のまま見える）。
 * ⚠️ ブロックは ow_user_blocks に記録し、このリクエストを一覧から消す（見送りと同じ ow_message_request_declines）。
 *    以後はどちらからも送れない（`contactGate.isMessagingBlocked`）。
 * ⚠️ 報告は ow_message_reports に1件（1通目の本文を控える）。一覧からは消さない。運営は /admin/message-reports で見る。
 */
export async function respondToMessageRequest(params: {
  conversationId: string;
  recipientId: string;
  action: RespondAction;
  note?: string | null;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { conversationId, recipientId, action } = params;
  const db = createAdminClient();
  const notFound = { ok: false as const, status: 404, error: "このリクエストは見つかりません" };

  const { data: conv, error } = await db
    .from("ow_conversations")
    .select("id, kind, candidate_user_id, partner_user_id, request_status")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) {
    console.error("[messageRequest] respond load:", error.message);
    return { ok: false, status: 500, error: MSG.failed };
  }
  /* ⚠️ 受け手本人のリクエストだけ。送り手が自分で答えられないようにする */
  if (!conv || conv.kind !== "direct_message" || conv.partner_user_id !== recipientId || conv.request_status !== "pending") {
    return notFound;
  }
  const declined = await isDeclined(conversationId);
  if (declined === null) return { ok: false, status: 500, error: MSG.failed };
  if (declined) return notFound;
  const senderId = conv.candidate_user_id as string;

  if (action === "report") {
    const first = await firstMessageBody(conversationId);
    const { error: rErr } = await db.from("ow_message_reports").insert({
      conversation_id: conversationId,
      reporter_user_id: recipientId,
      reported_user_id: senderId,
      message_snapshot: first,
      note: params.note?.trim() ? params.note.trim().slice(0, 1000) : null,
    });
    if (rErr) {
      console.error("[messageRequest] report:", rErr.message);
      return { ok: false, status: 500, error: MSG.failed };
    }
    return { ok: true };
  }

  if (action === "block") {
    const { error: bErr } = await db.from("ow_user_blocks").insert({ blocker_user_id: recipientId, blocked_user_id: senderId });
    if (bErr && bErr.code !== "23505") {
      console.error("[messageRequest] block:", bErr.message);
      return { ok: false, status: 500, error: MSG.failed };
    }
  }

  /* 見送り（ブロックも一覧から消す）。⚠️★送り手には何も伝えない */
  const { error: dErr } = await db.from("ow_message_request_declines").insert({ conversation_id: conversationId });
  if (dErr && dErr.code !== "23505") {
    console.error("[messageRequest] decline:", dErr.message);
    return { ok: false, status: 500, error: MSG.failed };
  }
  return { ok: true };
}

/** 返信の長さ（2026-10-11）。DB 関数 reply_to_message_request と同じ値 */
export const MESSAGE_REQUEST_REPLY_MAX = 2000;

/**
 * ★受け手が返信する（2026-10-11 / 柴さんの指示。「承認」を挟まず、返信した時点でやり取りが始まる）。
 * ⚠️★書き込みは DB 関数 `reply_to_message_request` の**1トランザクション**（service_role だけ）:
 *    返信済み（request_status='accepted'）→ 両者を参加者に → 返信を入れる。途中で失敗したら全部戻る。
 * ⚠️ 送り手へのお知らせは書き込みが済んでから（通常のメッセージと同じ `notifyNewMessage`。本文は出さない）。
 */
export async function replyToMessageRequest(params: {
  conversationId: string;
  recipientId: string;
  body: string;
}): Promise<{ ok: true; conversationId: string } | { ok: false; status: number; error: string }> {
  const body = params.body.trim();
  if (!body) return { ok: false, status: 400, error: "返信を入力してください" };
  if (body.length > MESSAGE_REQUEST_REPLY_MAX) return { ok: false, status: 400, error: `返信は${MESSAGE_REQUEST_REPLY_MAX}文字以内で入力してください` };

  const db = createAdminClient();
  const { data: conv, error: cErr } = await db.from("ow_conversations")
    .select("candidate_user_id").eq("id", params.conversationId).maybeSingle();
  if (cErr) {
    console.error("[messageRequest] reply load:", cErr.message);
    return { ok: false, status: 500, error: MSG.failed };
  }
  if (!conv) return { ok: false, status: 404, error: "このリクエストは見つかりません" };
  /* ⚠️ いまこの2人のあいだで送れるか（ブロック・検証用と実在の組・企業の担当者の規則）。理由は返さない */
  if (await isMessagingBlocked(params.recipientId, conv.candidate_user_id as string)) {
    return { ok: false, status: 403, error: CONTACT_BLOCKED_MESSAGE };
  }

  const { data, error } = await db.rpc("reply_to_message_request", {
    p_conversation_id: params.conversationId,
    p_recipient_ow_user_id: params.recipientId,
    p_body: body,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "OR404") return { ok: false, status: 404, error: "このリクエストは見つかりません" };
    if (code === "OR409") return { ok: false, status: 409, error: "このリクエストにはすでに返信しています" };
    if (code === "OR400") return { ok: false, status: 400, error: `返信は1〜${MESSAGE_REQUEST_REPLY_MAX}文字で入力してください` };
    console.error("[messageRequest] reply:", error.message);
    return { ok: false, status: 500, error: MSG.failed };
  }
  await notifyNewMessage({ conversationId: params.conversationId, senderOwUserId: params.recipientId, source: "dm/request-reply" });
  return { ok: true, conversationId: data as string };
}

/** 1通目の本文（受け手が返信する前に、サーバーから見せる）。⚠️ admin で読む。受け手を参加者に加えない決まりはそのまま */
async function firstMessageBody(conversationId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from("ow_conversation_messages")
    .select("body").eq("conversation_id", conversationId).is("deleted_at", null)
    .order("sent_at", { ascending: true }).limit(1).maybeSingle();
  if (error) {
    console.error("[messageRequest] first message:", error.message);
    return null;
  }
  return (data?.body as string | undefined) ?? null;
}

export type IncomingRequest = {
  conversationId: string;
  requestedAt: string | null;
  /** ★1通目の本文（2026-10-11）。返信する前に読めるよう、サーバーから渡す。取れなかったら null */
  body: string | null;
  requester: {
    id: string;
    name: string;
    headline: string | null;
    avatarUrl: string | null;
    avatarColor: string | null;
    username: string | null;
  };
};

/** 受け手に届いている返事待ちのリクエスト（見送った・ブロックしたものは出さない）。★1通目の本文も返す（2026-10-11） */
export async function listIncomingRequests(meId: string): Promise<IncomingRequest[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("ow_conversations")
    .select("id, requested_at, requester:ow_users!candidate_user_id(id, name, headline, avatar_url, avatar_color, username)")
    .eq("kind", "direct_message")
    .eq("partner_user_id", meId)
    .eq("request_status", "pending")
    .order("requested_at", { ascending: false });
  if (error) {
    console.error("[messageRequest] incoming:", error.message);
    return [];
  }
  const ids = (data ?? []).map((r) => r.id as string);
  let declined = new Set<string>();
  if (ids.length > 0) {
    const { data: d, error: dErr } = await db
      .from("ow_message_request_declines").select("conversation_id").in("conversation_id", ids);
    if (dErr) {
      console.error("[messageRequest] incoming declines:", dErr.message);
      return [];
    }
    declined = new Set((d ?? []).map((x) => x.conversation_id as string));
  }
  const shownIds = ids.filter((id) => !declined.has(id));
  const bodies = new Map<string, string>();
  if (shownIds.length > 0) {
    const { data: msgs, error: mErr } = await db.from("ow_conversation_messages")
      .select("conversation_id, body, sent_at").in("conversation_id", shownIds).is("deleted_at", null)
      .order("sent_at", { ascending: true });
    if (mErr) console.error("[messageRequest] incoming bodies:", mErr.message);
    for (const m of msgs ?? []) if (!bodies.has(m.conversation_id as string)) bodies.set(m.conversation_id as string, m.body as string);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[])
    .filter((r) => !declined.has(r.id as string))
    .map((r) => {
      const u = Array.isArray(r.requester) ? r.requester[0] : r.requester;
      return {
        conversationId: r.id as string,
        requestedAt: (r.requested_at as string | null) ?? null,
        body: bodies.get(r.id as string) ?? null,
        requester: {
          id: (u?.id as string) ?? "",
          name: (u?.name as string) ?? "",
          headline: (u?.headline as string | null) ?? null,
          avatarUrl: (u?.avatar_url as string | null) ?? null,
          avatarColor: (u?.avatar_color as string | null) ?? null,
          username: (u?.username as string | null) ?? null,
        },
      };
    })
    .filter((r) => !!r.requester.id);
}

/** 送れる DM か（企業との会話は対象外。DM は承認済みのときだけ） */
export function isDmSendable(conv: { kind: string | null; request_status?: string | null }): boolean {
  return conv.kind !== "direct_message" || conv.request_status === "accepted";
}

/** 受け手に届いている承認待ちのお願いの数（断ったものは数えない）。`/mypage` の数字と「届いているもの」 */
export async function countIncomingRequests(meId: string): Promise<number> {
  return (await listIncomingRequests(meId)).length;
}
