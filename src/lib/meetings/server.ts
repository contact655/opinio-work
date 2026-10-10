/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyConversationAllowed, companyConversationSendAllowed } from "@/lib/conversations/openReason";
import { listSameTestStaff } from "@/lib/business/sameTestStaff";
import { notifyNewMessage } from "@/lib/notify/messageNotification";
import { notify } from "@/lib/notify/email";
import { getCompanyNotificationTarget } from "@/lib/notify/recipients";
import { meetingCanceledTemplate, meetingConfirmedTemplate } from "@/lib/notify/templates";
import { companyDisplayName } from "@/lib/companies/displayName";
import { buildMeetingIcs } from "@/lib/meetings/ics";
import {
  MAX_MEETING_SLOTS, MEETING_FORMATS, formatMeetingDateTime, isMeetingDuration, isMeetingFormat,
  parseSchedulingUrl, slotError,
  type MeetingDuration, type MeetingFormat, type MeetingSlotsPayload, type SchedulingLinkPayload,
} from "@/lib/constants/meetings";

/**
 * ★会話の日程調整（2026-10-10 / 声かけまわり 段4）。**判定と書き込みはここの1か所。**
 *
 * | 操作 | 誰が | 何をする |
 * |---|---|---|
 * | 候補日を送る | 企業（会話の参加者） | 種類つきのメッセージ（`meeting_slots`）を入れる |
 * | 日程調整リンクを送る | 企業（参加者・自分のリンクを登録済み） | `scheduling_link` のメッセージを入れる |
 * | 候補を選ぶ | 求職者（その会話の本人） | `ow_meetings` を作り（source=slots）、両方へ .ics つきのメール |
 * | 面談日を記録する | 企業（リンクを送った会話） | `ow_meetings` を作る（source=link）。確定と同じ扱い |
 * | 取り消す | 企業 | 候補日・面談を取り消し、求職者に通知（ベル＋メール） |
 *
 * ⚠️ 企業との会話の送信は、これまでと同じく `companyConversationAllowed()` を通す（ブロック・在籍の判明の後は送れない）。
 * ⚠️ 失敗を「成功」に見せない。書き込みは行数まで確かめる。メールは best-effort（ログは出す）。
 */

export type Result<T = null> = { ok: true; data: T } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): Result<never> => ({ ok: false, status, error });

type Conv = { id: string; company_id: string; candidate_user_id: string; kind: string };

async function loadCompanyConversation(conversationId: string, companyId: string): Promise<Conv | null> {
  const { data, error } = await createAdminClient().from("ow_conversations")
    .select("id, company_id, candidate_user_id, kind").eq("id", conversationId).maybeSingle();
  if (error) console.error("[meetings] conversation:", error.message);
  if (!data || data.kind !== "company" || data.company_id !== companyId) return null;
  return data as Conv;
}

async function participantId(conversationId: string, owUserId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from("ow_conversation_participants")
    .select("id").eq("conversation_id", conversationId).eq("user_id", owUserId).is("left_at", null).maybeSingle();
  if (error) console.error("[meetings] participant:", error.message);
  return (data?.id as string | undefined) ?? null;
}

async function insertKindMessage(params: {
  conversationId: string; participantId: string; senderOwUserId: string;
  kind: "meeting_slots" | "scheduling_link"; body: string; payload: MeetingSlotsPayload | SchedulingLinkPayload;
}): Promise<Result<{ messageId: string }>> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await db.from("ow_conversation_messages").insert({
    conversation_id: params.conversationId, sender_participant_id: params.participantId,
    body: params.body, sent_at: now, kind: params.kind, payload: params.payload,
  }).select("id").single();
  if (error || !data) {
    console.error("[meetings] insert message:", error?.message);
    return fail(500, "送信できませんでした");
  }
  const { error: uErr } = await db.from("ow_conversations").update({ last_message_at: now }).eq("id", params.conversationId);
  if (uErr) console.error("[meetings] last_message_at:", uErr.message);
  await notifyNewMessage({ conversationId: params.conversationId, senderOwUserId: params.senderOwUserId, source: `meetings/${params.kind}` });
  return { ok: true, data: { messageId: data.id as string } };
}

/** 企業側の送信の前提（自社の会話・参加者・送ってよい相手）。⚠️ 理由は返さない */
async function companySendGuard(conversationId: string, companyId: string, owUserId: string): Promise<Result<{ conv: Conv; participantId: string }>> {
  const conv = await loadCompanyConversation(conversationId, companyId);
  if (!conv) return fail(404, "会話が見つかりません");
  const pid = await participantId(conversationId, owUserId);
  if (!pid) return fail(403, "この会話に参加していません");
  /* ★送る担当者と求職者の is_test の一致も見る（2026-10-10） */
  if (!(await companyConversationSendAllowed({ candidateOwUserId: conv.candidate_user_id, companyId, senderOwUserId: owUserId }))) return fail(403, "この方には現在メッセージを送れません");
  return { ok: true, data: { conv, participantId: pid } };
}

// ── 候補日を送る ────────────────────────────────────────────────────────────
export async function sendMeetingSlots(params: {
  conversationId: string; companyId: string; senderOwUserId: string;
  slots: unknown; format: unknown; duration: unknown; attendeeUserIds: unknown;
}): Promise<Result<{ messageId: string }>> {
  const raw = Array.isArray(params.slots) ? params.slots.filter((s): s is string => typeof s === "string" && s.trim() !== "") : [];
  if (raw.length === 0) return fail(400, "候補日を1つ以上入れてください");
  if (raw.length > MAX_MEETING_SLOTS) return fail(400, `候補日は${MAX_MEETING_SLOTS}つまでです`);
  const slots = raw;
  for (const s of slots) { const e = slotError(s); if (e) return fail(400, e); }
  const normalized = Array.from(new Set(slots.map((s) => new Date(s).toISOString()))).sort();
  if (normalized.length !== slots.length) return fail(400, "同じ日時が重なっています");
  if (!isMeetingFormat(params.format)) return fail(400, "形式を選んでください");
  if (!isMeetingDuration(params.duration)) return fail(400, "時間を選んでください");
  const ids = Array.isArray(params.attendeeUserIds) ? Array.from(new Set(params.attendeeUserIds.filter((x): x is string => typeof x === "string"))) : [];

  const g = await companySendGuard(params.conversationId, params.companyId, params.senderOwUserId);
  if (!g.ok) return g;

  /* 同席する人は、その企業の有効な担当者のうち**送る人と is_test が同じ人だけ**（2026-10-10。画面の選択肢と同じ関数）。
     名前は送った時点のまま残す */
  let attendees: string[] = [];
  if (ids.length > 0) {
    const staff = await listSameTestStaff(params.companyId, params.senderOwUserId);
    if (!staff) return fail(500, "送信できませんでした");
    const byId = new Map(staff.map((x) => [x.id, x.name]));
    if (ids.some((id) => !byId.has(id))) return fail(400, "同席する人は、この会社の担当者から選んでください");
    attendees = ids.map((id) => byId.get(id) as string);
  }

  const format = params.format as MeetingFormat;
  const duration = params.duration as MeetingDuration;
  const body = [
    "面談の候補日をお送りします。ご都合のよい日時を1つ選んでください。",
    ...normalized.map((s) => `・${formatMeetingDateTime(s)}`),
    `形式：${MEETING_FORMATS[format]}／時間：${duration}分${attendees.length ? `／同席：${attendees.join("、")}` : ""}`,
  ].join("\n");
  return insertKindMessage({
    conversationId: params.conversationId, participantId: g.data.participantId, senderOwUserId: params.senderOwUserId,
    kind: "meeting_slots", body,
    payload: { slots: normalized, format, duration, attendees, status: "open" },
  });
}

// ── 日程調整リンク ──────────────────────────────────────────────────────────
export async function getSchedulingUrl(companyId: string, owUserId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from("ow_company_admins").select("scheduling_url")
    .eq("company_id", companyId).eq("user_id", owUserId).eq("is_active", true).maybeSingle();
  if (error) console.error("[meetings] scheduling_url:", error.message);
  return (data?.scheduling_url as string | null) ?? null;
}

export async function setSchedulingUrl(companyId: string, owUserId: string, raw: unknown): Promise<Result<{ url: string | null }>> {
  let url: string | null = null;
  if (raw !== null && raw !== "") {
    const p = parseSchedulingUrl(raw);
    if (!p.ok) return fail(400, p.error);
    url = p.url;
  }
  const { data, error } = await createAdminClient().from("ow_company_admins").update({ scheduling_url: url })
    .eq("company_id", companyId).eq("user_id", owUserId).eq("is_active", true).select("id");
  if (error) { console.error("[meetings] set scheduling_url:", error.message); return fail(500, "保存できませんでした"); }
  if ((data ?? []).length !== 1) return fail(403, "この会社の担当者ではありません");
  return { ok: true, data: { url } };
}

export async function sendSchedulingLink(params: { conversationId: string; companyId: string; senderOwUserId: string }): Promise<Result<{ messageId: string }>> {
  const g = await companySendGuard(params.conversationId, params.companyId, params.senderOwUserId);
  if (!g.ok) return g;
  const url = await getSchedulingUrl(params.companyId, params.senderOwUserId);
  if (!url) return fail(400, "先に日程調整リンクを登録してください");
  const p = parseSchedulingUrl(url);
  if (!p.ok) return fail(400, p.error);
  return insertKindMessage({
    conversationId: params.conversationId, participantId: g.data.participantId, senderOwUserId: params.senderOwUserId,
    kind: "scheduling_link", body: `日程調整リンクをお送りします。ご都合のよい日時を選んでください。\n${p.url}`,
    payload: { url: p.url, domain: p.domain },
  });
}

// ── 確定（求職者が選ぶ／企業が記録する）とメール ─────────────────────────────
async function sendConfirmedEmails(params: {
  meetingId: string; conversationId: string; companyId: string; candidateOwUserId: string;
  companyRecipientOwUserId: string | null; startsAt: string; duration: number; format: MeetingFormat;
}): Promise<void> {
  try {
    const db = createAdminClient();
    const [{ data: cand }, { data: comp }] = await Promise.all([
      db.from("ow_users").select("name, email").eq("id", params.candidateOwUserId).maybeSingle(),
      db.from("ow_companies").select("name, name_en").eq("id", params.companyId).maybeSingle(),
    ]);
    const companyName = comp ? companyDisplayName(comp.name as string, (comp.name_en as string | null) ?? null).displayName : "企業";
    const whenText = formatMeetingDateTime(params.startsAt);
    const formatLabel = MEETING_FORMATS[params.format];
    const ics = (side: "candidate" | "company") => buildMeetingIcs({
      meetingId: params.meetingId, startsAt: params.startsAt, durationMinutes: params.duration,
      summary: side === "candidate" ? `${companyName}との面談` : `${(cand?.name as string | null) ?? "求職者"}さんとの面談`,
      description: `形式：${formatLabel}／時間：${params.duration}分`,
      url: side === "candidate" ? `https://opinio.jp/mypage/conversations/${params.conversationId}` : `https://opinio.jp/biz/conversations/${params.conversationId}`,
    });
    const candEmail = ((cand?.email as string | null) ?? "").trim();
    if (candEmail) {
      await notify({ ...meetingConfirmedTemplate({ to: candEmail, side: "candidate", counterpartName: companyName, whenText, durationMinutes: params.duration, formatLabel, conversationId: params.conversationId }),
        attachments: [{ filename: "meeting.ics", content: ics("candidate"), contentType: "text/calendar" }] });
    }
    /* 企業側: 候補日を送った担当者（いまも有効でメールがある）→ 無ければ応募の通知と同じ決め方 */
    let to: string[] = []; let viaOps = false;
    if (params.companyRecipientOwUserId) {
      const [{ data: link }, { data: u }] = await Promise.all([
        db.from("ow_company_admins").select("id").eq("company_id", params.companyId).eq("user_id", params.companyRecipientOwUserId).eq("is_active", true).maybeSingle(),
        db.from("ow_users").select("email").eq("id", params.companyRecipientOwUserId).maybeSingle(),
      ]);
      const e = ((u?.email as string | null) ?? "").trim();
      if (link && e) to = [e];
    }
    if (to.length === 0) { const t = await getCompanyNotificationTarget(params.companyId, "meeting-confirmed"); to = t.to; viaOps = t.viaOps; }
    for (const addr of to) {
      await notify({ ...meetingConfirmedTemplate({ to: addr, side: "company", counterpartName: (cand?.name as string | null) ?? null, whenText, durationMinutes: params.duration, formatLabel, conversationId: params.conversationId, viaOps }),
        attachments: [{ filename: "meeting.ics", content: ics("company"), contentType: "text/calendar" }] });
    }
  } catch (e) {
    console.error("[meetings] confirmed emails:", e instanceof Error ? e.message : e);
  }
}

export async function chooseMeetingSlot(params: {
  conversationId: string; messageId: string; index: unknown; candidateOwUserId: string;
}): Promise<Result<{ meetingId: string }>> {
  const db = createAdminClient();
  const { data: conv, error: cErr } = await db.from("ow_conversations").select("id, kind, company_id, candidate_user_id")
    .eq("id", params.conversationId).maybeSingle();
  if (cErr) console.error("[meetings] choose conv:", cErr.message);
  if (!conv || conv.kind !== "company" || conv.candidate_user_id !== params.candidateOwUserId || !conv.company_id) return fail(404, "会話が見つかりません");
  const { data: msg, error: mErr } = await db.from("ow_conversation_messages")
    .select("id, kind, payload, sender_participant_id, ow_conversation_participants!sender_participant_id(user_id)")
    .eq("id", params.messageId).eq("conversation_id", params.conversationId).is("deleted_at", null).maybeSingle();
  if (mErr) console.error("[meetings] choose msg:", mErr.message);
  if (!msg || msg.kind !== "meeting_slots") return fail(404, "候補日が見つかりません");
  const payload = msg.payload as MeetingSlotsPayload;
  if (payload.status !== "open") return fail(409, payload.status === "confirmed" ? "すでに日時が決まっています" : "この候補日は取り消されました");
  const index = typeof params.index === "number" ? params.index : -1;
  const startsAt = payload.slots[index];
  if (!startsAt) return fail(400, "候補を選んでください");
  if (new Date(startsAt).getTime() <= Date.now()) return fail(400, "過ぎた日時は選べません");
  if (!(await companyConversationAllowed(conv.candidate_user_id as string, conv.company_id as string))) return fail(403, "この会話では日程を決められません");

  const senderUserId = ((msg.ow_conversation_participants as unknown as { user_id: string | null } | null)?.user_id) ?? null;
  const { data: meeting, error: iErr } = await db.from("ow_meetings").insert({
    conversation_id: params.conversationId, company_id: conv.company_id, candidate_user_id: params.candidateOwUserId,
    starts_at: startsAt, duration_minutes: payload.duration, format: payload.format, attendees: payload.attendees ?? [],
    source: "slots", slots_message_id: params.messageId, created_by: params.candidateOwUserId,
  }).select("id").single();
  if (iErr || !meeting) {
    /* ⚠️ 同時に押されたときは一意の索引で2件目が弾かれる */
    if (iErr?.code === "23505") return fail(409, "すでに日時が決まっています");
    console.error("[meetings] insert meeting:", iErr?.message);
    return fail(500, "日時を決められませんでした");
  }
  const next: MeetingSlotsPayload = { ...payload, status: "confirmed", chosenIndex: index, meetingId: meeting.id as string };
  const { data: up, error: uErr } = await db.from("ow_conversation_messages").update({ payload: next }).eq("id", params.messageId).select("id");
  if (uErr || (up ?? []).length !== 1) console.error("[meetings] confirm payload:", uErr?.message ?? "0行");

  await sendConfirmedEmails({
    meetingId: meeting.id as string, conversationId: params.conversationId, companyId: conv.company_id as string,
    candidateOwUserId: params.candidateOwUserId, companyRecipientOwUserId: senderUserId,
    startsAt, duration: payload.duration, format: payload.format,
  });
  return { ok: true, data: { meetingId: meeting.id as string } };
}

/** 日程調整リンクで決まった日時を企業が記録する（確定と同じ扱い） */
export async function recordLinkMeeting(params: {
  conversationId: string; companyId: string; actorOwUserId: string; startsAt: unknown; duration: unknown; format: unknown;
}): Promise<Result<{ meetingId: string }>> {
  const conv = await loadCompanyConversation(params.conversationId, params.companyId);
  if (!conv) return fail(404, "会話が見つかりません");
  if (!(await participantId(params.conversationId, params.actorOwUserId))) return fail(403, "この会話に参加していません");
  const db = createAdminClient();
  const { count, error: lErr } = await db.from("ow_conversation_messages").select("id", { count: "exact", head: true })
    .eq("conversation_id", params.conversationId).eq("kind", "scheduling_link").is("deleted_at", null);
  if (lErr) { console.error("[meetings] record link check:", lErr.message); return fail(500, "記録できませんでした"); }
  if (!count) return fail(400, "日程調整リンクを送った会話だけで記録できます");
  if (typeof params.startsAt !== "string") return fail(400, "日時を入れてください");
  const e = slotError(params.startsAt); if (e) return fail(400, e);
  if (!isMeetingFormat(params.format)) return fail(400, "形式を選んでください");
  if (!isMeetingDuration(params.duration)) return fail(400, "時間を選んでください");
  const startsAt = new Date(params.startsAt).toISOString();
  const { data: meeting, error } = await db.from("ow_meetings").insert({
    conversation_id: params.conversationId, company_id: params.companyId, candidate_user_id: conv.candidate_user_id,
    starts_at: startsAt, duration_minutes: params.duration, format: params.format, source: "link", created_by: params.actorOwUserId,
  }).select("id").single();
  if (error || !meeting) { console.error("[meetings] record:", error?.message); return fail(500, "記録できませんでした"); }
  await sendConfirmedEmails({
    meetingId: meeting.id as string, conversationId: params.conversationId, companyId: params.companyId,
    candidateOwUserId: conv.candidate_user_id, companyRecipientOwUserId: params.actorOwUserId,
    startsAt, duration: params.duration as number, format: params.format as MeetingFormat,
  });
  return { ok: true, data: { meetingId: meeting.id as string } };
}

// ── 取り消し（企業） ────────────────────────────────────────────────────────
async function notifyCanceled(params: { conversationId: string; companyId: string; candidateOwUserId: string; meetingId: string | null; whenIso: string | null; duration: number | null }) {
  const db = createAdminClient();
  const { error } = await db.from("ow_notifications").insert({
    recipient_user_id: params.candidateOwUserId, type: "meeting_canceled",
    conversation_id: params.conversationId, actor_company_id: params.companyId, meeting_id: params.meetingId,
  });
  if (error) console.error("[meetings] cancel notification:", error.message);
  try {
    const [{ data: cand }, { data: comp }] = await Promise.all([
      db.from("ow_users").select("email").eq("id", params.candidateOwUserId).maybeSingle(),
      db.from("ow_companies").select("name, name_en").eq("id", params.companyId).maybeSingle(),
    ]);
    const email = ((cand?.email as string | null) ?? "").trim();
    if (!email) return;
    const companyName = comp ? companyDisplayName(comp.name as string, (comp.name_en as string | null) ?? null).displayName : "企業";
    const tpl = meetingCanceledTemplate({ to: email, companyName, whenText: params.whenIso ? formatMeetingDateTime(params.whenIso) : null, conversationId: params.conversationId });
    /* 確定した面談なら、カレンダーから消える .ics（CANCEL）を添える */
    const attachments = params.meetingId && params.whenIso && params.duration
      ? [{ filename: "meeting-cancel.ics", contentType: "text/calendar", content: buildMeetingIcs({
          meetingId: params.meetingId, startsAt: params.whenIso, durationMinutes: params.duration,
          summary: `${companyName}との面談（取り消し）`, description: "この面談は取り消されました",
          url: `https://opinio.jp/mypage/conversations/${params.conversationId}`, method: "CANCEL", sequence: 1 }) }]
      : undefined;
    await notify({ ...tpl, attachments });
  } catch (e) {
    console.error("[meetings] cancel email:", e instanceof Error ? e.message : e);
  }
}

/** 候補日のメッセージを取り消す（確定済みなら面談も取り消す） */
export async function cancelMeetingSlots(params: { conversationId: string; companyId: string; actorOwUserId: string; messageId: string }): Promise<Result> {
  const conv = await loadCompanyConversation(params.conversationId, params.companyId);
  if (!conv) return fail(404, "会話が見つかりません");
  if (!(await participantId(params.conversationId, params.actorOwUserId))) return fail(403, "この会話に参加していません");
  const db = createAdminClient();
  const { data: msg, error } = await db.from("ow_conversation_messages").select("id, kind, payload")
    .eq("id", params.messageId).eq("conversation_id", params.conversationId).maybeSingle();
  if (error) console.error("[meetings] cancel msg:", error.message);
  if (!msg || msg.kind !== "meeting_slots") return fail(404, "候補日が見つかりません");
  const payload = msg.payload as MeetingSlotsPayload;
  if (payload.status === "canceled") return fail(409, "すでに取り消されています");
  let whenIso: string | null = null;
  if (payload.status === "confirmed" && payload.meetingId) {
    const r = await cancelMeetingRow(payload.meetingId, params.companyId, params.actorOwUserId);
    if (!r.ok) return r;
    whenIso = r.data.startsAt;
  }
  const { data: up, error: uErr } = await db.from("ow_conversation_messages").update({ payload: { ...payload, status: "canceled" } }).eq("id", params.messageId).select("id");
  if (uErr || (up ?? []).length !== 1) { console.error("[meetings] cancel payload:", uErr?.message ?? "0行"); return fail(500, "取り消せませんでした"); }
  await notifyCanceled({ conversationId: params.conversationId, companyId: params.companyId, candidateOwUserId: conv.candidate_user_id,
    meetingId: payload.meetingId ?? null, whenIso, duration: whenIso ? payload.duration : null });
  return { ok: true, data: null };
}

async function cancelMeetingRow(meetingId: string, companyId: string, actorOwUserId: string): Promise<Result<{ startsAt: string; duration: number; conversationId: string; candidateOwUserId: string }>> {
  const db = createAdminClient();
  const { data, error } = await db.from("ow_meetings")
    .update({ status: "canceled", canceled_at: new Date().toISOString(), canceled_by: actorOwUserId })
    .eq("id", meetingId).eq("company_id", companyId).eq("status", "scheduled")
    .select("starts_at, duration_minutes, conversation_id, candidate_user_id");
  if (error) { console.error("[meetings] cancel meeting:", error.message); return fail(500, "取り消せませんでした"); }
  const row = (data ?? [])[0];
  if (!row) return fail(404, "取り消せる面談が見つかりません");
  return { ok: true, data: { startsAt: row.starts_at as string, duration: row.duration_minutes as number, conversationId: row.conversation_id as string, candidateOwUserId: row.candidate_user_id as string } };
}

/** 面談を取り消す（リンクで記録した面談など）。候補日のメッセージから確定したものは、そのメッセージも取り消しにする */
export async function cancelMeeting(params: { meetingId: string; companyId: string; actorOwUserId: string }): Promise<Result> {
  const db = createAdminClient();
  const { data: m, error } = await db.from("ow_meetings").select("conversation_id, slots_message_id").eq("id", params.meetingId).eq("company_id", params.companyId).maybeSingle();
  if (error) console.error("[meetings] cancel load:", error.message);
  if (!m) return fail(404, "面談が見つかりません");
  if (!(await participantId(m.conversation_id as string, params.actorOwUserId))) return fail(403, "この会話に参加していません");
  if (m.slots_message_id) return cancelMeetingSlots({ conversationId: m.conversation_id as string, companyId: params.companyId, actorOwUserId: params.actorOwUserId, messageId: m.slots_message_id as string });
  const r = await cancelMeetingRow(params.meetingId, params.companyId, params.actorOwUserId);
  if (!r.ok) return r;
  await notifyCanceled({ conversationId: r.data.conversationId, companyId: params.companyId, candidateOwUserId: r.data.candidateOwUserId,
    meetingId: params.meetingId, whenIso: r.data.startsAt, duration: r.data.duration });
  return { ok: true, data: null };
}

// ── 読む ────────────────────────────────────────────────────────────────────
export type MeetingView = {
  id: string; conversationId: string; candidateUserId: string; candidateName: string;
  startsAt: string; duration: number; format: MeetingFormat; attendees: string[]; source: "slots" | "link";
  status: "scheduled" | "canceled";
  /** どこから始まった会話か（声かけ／提案）。どちらでもなければ null */
  origin: "approach" | "proposal" | null;
};

/** ★日本時間の今日0時（ISO） */
export function startOfTodayJst(now = new Date()): string {
  const JST = 9 * 60 * 60 * 1000;
  const j = new Date(now.getTime() + JST);
  return new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate()) - JST).toISOString();
}

/** 企業の面談。`upcoming` なら今日以降の予定だけ（取り消したものは除く）。失敗したら null */
export async function listCompanyMeetings(companyId: string, opts: { upcoming?: boolean } = {}): Promise<MeetingView[] | null> {
  const db = createAdminClient();
  let q = db.from("ow_meetings").select("id, conversation_id, candidate_user_id, starts_at, duration_minutes, format, attendees, source, status")
    .eq("company_id", companyId);
  if (opts.upcoming) q = q.eq("status", "scheduled").gte("starts_at", startOfTodayJst());
  const { data, error } = await q.order("starts_at", { ascending: true });
  if (error) { console.error("[meetings] list:", error.message); return null; }
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const convIds = Array.from(new Set(rows.map((r) => r.conversation_id as string)));
  const userIds = Array.from(new Set(rows.map((r) => r.candidate_user_id as string)));
  const [{ data: users }, { data: aps }, { data: props }] = await Promise.all([
    db.from("ow_users").select("id, name").in("id", userIds),
    db.from("ow_company_approaches").select("conversation_id").in("conversation_id", convIds),
    db.from("ow_proposals").select("conversation_id").in("conversation_id", convIds),
  ]);
  const names = new Map((users ?? []).map((u) => [u.id as string, ((u.name as string | null) ?? "").trim() || "名前未設定"]));
  const fromApproach = new Set((aps ?? []).map((a) => a.conversation_id as string));
  const fromProposal = new Set((props ?? []).map((p) => p.conversation_id as string));
  return rows.map((r) => ({
    id: r.id as string, conversationId: r.conversation_id as string, candidateUserId: r.candidate_user_id as string,
    candidateName: names.get(r.candidate_user_id as string) ?? "名前未設定",
    startsAt: r.starts_at as string, duration: r.duration_minutes as number, format: r.format as MeetingFormat,
    attendees: (r.attendees as string[] | null) ?? [], source: r.source as "slots" | "link", status: r.status as "scheduled" | "canceled",
    origin: fromApproach.has(r.conversation_id as string) ? "approach" : fromProposal.has(r.conversation_id as string) ? "proposal" : null,
  }));
}

/** 会話の面談の状態（会話の上部のボタンに使う）。失敗したら null */
export async function conversationMeetingState(conversationId: string): Promise<{ scheduled: MeetingView | null; linkSent: boolean } | null> {
  const db = createAdminClient();
  const [{ data: m, error: mErr }, { count, error: lErr }] = await Promise.all([
    db.from("ow_meetings").select("id, conversation_id, candidate_user_id, starts_at, duration_minutes, format, attendees, source, status")
      .eq("conversation_id", conversationId).eq("status", "scheduled").order("starts_at", { ascending: true }).limit(1),
    db.from("ow_conversation_messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId).eq("kind", "scheduling_link").is("deleted_at", null),
  ]);
  if (mErr || lErr) { console.error("[meetings] state:", mErr?.message ?? lErr?.message); return null; }
  const r = (m ?? [])[0];
  return {
    linkSent: (count ?? 0) > 0,
    scheduled: r ? {
      id: r.id as string, conversationId, candidateUserId: r.candidate_user_id as string, candidateName: "",
      startsAt: r.starts_at as string, duration: r.duration_minutes as number, format: r.format as MeetingFormat,
      attendees: (r.attendees as string[] | null) ?? [], source: r.source as "slots" | "link", status: "scheduled", origin: null,
    } : null,
  };
}
