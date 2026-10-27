/* ★サーバー専用 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { openCompanyConversation } from "@/lib/conversations/openReason";
import { proposalIntroLine } from "@/lib/constants/proposalResponses";
import { notifyCompanyProposalRaised } from "@/lib/notify/proposalNotification";
import { getOwnCompanyId } from "@/lib/companies/ownCompany";
import { filterCompaniesWithRespondingStaff } from "@/lib/companies/respondingStaff";
import { companyDisplayName } from "@/lib/companies/displayName";
import {
  INTEREST_CONSENT_VERSION, INTEREST_NOTE_MAX, isNoReplyDue,
  type InterestSource, type InterestStatus,
} from "./constants";

/**
 * ★「話を聞いてみたい」を受けて、記録して届ける。**入口はここだけ**（2026-10-27 / 話を聞きたい人 フェーズ1a）。
 *
 *   企業ページ（`/api/jobseeker/interest/[companyId]`）・合う会社の下段（`react.ts`）・上段の提案（`respond.ts`）が
 *   同じ記録（ow_for_you_reactions の1行）と同じ届け方を通る。
 *
 *   担当者がいる会社 … その場で会話を作る（名前とプロフィールが届く）＝ delivered
 *   担当者がいない会社 … ★届けない（2026-10-27 / 柴さんの決定）。「話を聞いてみたい」は受け付けず（409）、画面には「保存」を出す
 *                       （既存の ow_bookmarks）。担当者が付いたら保存した人に知らせる（notifySaversOnJoin）。企業には何も届かない
 *   ⚠️★その会社が OPINIO にいないことが分かる文言を、画面・通知・エラーのどこにも出さない（外で直接応募するきっかけになる）
 *
 * ⚠️★押せるかどうかは `can_contact_without_stance()`（DB）の1か所。在籍した会社・グループ会社・自分が担当者の会社・
 *    手動ブロック・転職勧奨禁止・検証用と実在の不一致では押せない（ボタンも出さない）。TS に条件を書き写さない。
 * ⚠️ 会話を作るのは `openCompanyConversation()`（openReason.ts）だけ。理由は「本人が押した」（source: for_you）。
 *    判定は ow_for_you_reactions.interested_at を見るので、**会話を作る前に記録を書く**。
 * ⚠️ 書くのは admin クライアントだけ（ow_for_you_reactions はクライアントに書き込みを配っていない）。
 */

type Db = SupabaseClient;

export type InterestEligibility =
  | { ok: true; companyId: string; companyName: string; companyIsTest: boolean; hasResponder: boolean; authId: string }
  | { ok: false };

/** ★押せるか（1社）。⚠️ 理由は返さない（ブロック・在籍歴を推測させない） */
export async function checkInterestEligibility(owUserId: string, companyId: string, db: Db = createAdminClient()): Promise<InterestEligibility> {
  const [{ data: me, error: mErr }, { data: co, error: cErr }, ownId] = await Promise.all([
    db.from("ow_users").select("id, auth_id, is_test").eq("id", owUserId).maybeSingle(),
    db.from("ow_companies").select("id, name, name_en, is_test, is_published, listing_status").eq("id", companyId).maybeSingle(),
    getOwnCompanyId(),
  ]);
  if (mErr || cErr) { console.error("[interest] eligibility:", mErr?.message ?? cErr?.message); return { ok: false }; }
  if (!me?.auth_id || !co) return { ok: false };
  if (co.is_published !== true || co.listing_status !== "listed") return { ok: false };
  if ((co.is_test === true) !== (me.is_test === true)) return { ok: false };
  if (ownId && co.id === ownId) return { ok: false };
  const [{ data: blocked, error: bErr }, { data: can, error: rErr }] = await Promise.all([
    db.from("ow_approach_blocked_companies").select("company_id").eq("user_id", owUserId).eq("company_id", companyId).maybeSingle(),
    db.rpc("can_contact_without_stance", { p_company_id: companyId, p_candidate_id: me.auth_id as string }),
  ]);
  if (bErr || rErr) { console.error("[interest] eligibility:", bErr?.message ?? rErr?.message); return { ok: false }; }
  if (blocked || can !== true) return { ok: false };
  const responders = await filterCompaniesWithRespondingStaff([companyId]);
  return {
    ok: true,
    companyId,
    companyName: companyDisplayName(co.name as string, (co.name_en as string | null) ?? null).displayName,
    companyIsTest: co.is_test === true,
    hasResponder: responders?.has(companyId) === true,
    authId: me.auth_id as string,
  };
}

/**
 * ★押せる会社に絞る（合う会社の一覧用。`can_contact_without_stance()` を会社ごとに呼ぶ）。
 * ⚠️ 失敗した会社は「押せない」に倒す（fail-closed。ログは出す）
 */
export async function filterContactableCompanies(authId: string, companyIds: string[], db: Db = createAdminClient()): Promise<Set<string>> {
  const out = new Set<string>();
  await Promise.all(companyIds.map(async (id) => {
    const { data, error } = await db.rpc("can_contact_without_stance", { p_company_id: id, p_candidate_id: authId });
    if (error) { console.error("[interest] can_contact_without_stance:", id, error.message); return; }
    if (data === true) out.add(id);
  }));
  return out;
}

export type InterestRow = {
  user_id: string; company_id: string; reaction: string; interested_at: string | null;
  interest_status: InterestStatus | null; interest_note: string | null; interest_source: InterestSource | null;
  conversation_id: string | null; ops_notified_at: string | null; delivered_at: string | null;
};
const ROW_COLS = "user_id, company_id, reaction, interested_at, interest_status, interest_note, interest_source, conversation_id, ops_notified_at, delivered_at" as const;

export type ExpressOutcome =
  | { ok: true; status: InterestStatus | "recorded"; conversationId: string | null }
  | { ok: false; status: number; error: string };

/**
 * ★押したときの処理。記録 → 担当者がいれば届ける／いなければ運営に知らせる。
 * @param opts.rank / signals 合う会社から押したときだけ（並びの学習用のスナップショット）
 */
export async function expressInterest(input: {
  owUserId: string;
  companyId: string;
  source: InterestSource;
  note?: unknown;
  consentVersion?: unknown;
  rank?: number | null;
  signals?: unknown[];
  reasons?: string[];
}): Promise<ExpressOutcome> {
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > INTEREST_NOTE_MAX) return { ok: false, status: 400, error: `ひとことは${INTEREST_NOTE_MAX}文字までです` };
  /* ★見せた文言の版が今のものでなければ受け付けない（古い画面のまま押した＝今の文言に同意していない） */
  if (input.consentVersion !== INTEREST_CONSENT_VERSION) {
    return { ok: false, status: 409, error: "画面が古くなっています。ページを読み込み直してから、もう一度お試しください。" };
  }
  const db = createAdminClient();
  const elig = await checkInterestEligibility(input.owUserId, input.companyId, db);
  /* ⚠️ 押せない理由は区別しない */
  if (!elig.ok) return { ok: false, status: 404, error: "この会社には届けられません" };
  /* ★担当者がいない会社には名前を届けない。記録もしない（画面には「保存」を出している）。
        ⚠️ 文言で「担当者がいない」と言わない（いないことが分かる）。押せないときと同じ文言にする */
  if (!elig.hasResponder) {
    return { ok: false, status: 409, error: "この会社には届けられません" };
  }

  const { data: prev, error: pErr } = await db.from("ow_for_you_reactions").select(ROW_COLS)
    .eq("user_id", input.owUserId).eq("company_id", input.companyId).maybeSingle();
  if (pErr) { console.error("[interest] 既存の記録:", pErr.message); return { ok: false, status: 500, error: "記録できませんでした" }; }
  const p = prev as InterestRow | null;

  /* 既に届いている（会話がある）なら、そこへ。二重に届けない */
  if (p?.conversation_id && p.interest_status) {
    return { ok: true, status: p.interest_status, conversationId: p.conversation_id };
  }

  const now = new Date().toISOString();
  /* ★interested_at は一度入ったら消さない（会話を開く理由） */
  const interestedAt = p?.interested_at ?? now;
  const base = {
    reaction: "interested",
    reason: null,
    interested_at: interestedAt,
    interest_source: input.source,
    interest_note: note || null,
    consent_version: INTEREST_CONSENT_VERSION,
    updated_at: now,
  };
  const write = p
    ? db.from("ow_for_you_reactions").update({
        ...base,
        ...(input.rank != null ? { rank_at: input.rank, signals: input.signals ?? [] } : {}),
      }).eq("user_id", input.owUserId).eq("company_id", input.companyId).select("user_id")
    : db.from("ow_for_you_reactions").insert({
        user_id: input.owUserId, company_id: input.companyId, ...base,
        rank_at: input.rank ?? null, signals: input.signals ?? [],
      }).select("user_id");
  const { data: saved, error: wErr } = await write;
  if (wErr || !saved || saved.length === 0) {
    console.error("[interest] 記録:", wErr?.message ?? "0行");
    return { ok: false, status: 500, error: "記録できませんでした" };
  }

  const d = await deliverInterest(db, { owUserId: input.owUserId, companyId: input.companyId, note: note || null, source: input.source });
  return d ? { ok: true, status: "delivered", conversationId: d.conversationId } : { ok: true, status: "recorded", conversationId: null };
}

async function setStatus(db: Db, owUserId: string, companyId: string, patch: Record<string, unknown>) {
  const { error } = await db.from("ow_for_you_reactions").update(patch).eq("user_id", owUserId).eq("company_id", companyId);
  if (error) console.error("[interest] 状態の更新:", error.message, patch);
}

/**
 * ★届ける（会話を作り、案内の行とひとことを入れ、企業に知らせ、記録を delivered にする）。
 *   提案（introduce.ts）と同じ並び・同じ案内の行（kind='proposal_intro'・送った人なし）。
 * ⚠️ 開けないとき（判定が通らない）は null。理由は出さない。
 */
export async function deliverInterest(db: Db, input: {
  owUserId: string; companyId: string; note: string | null; source: InterestSource;
}): Promise<{ conversationId: string } | null> {
  let created: { conversationId: string; created: boolean } | null;
  try {
    created = await openCompanyConversation({ candidateOwUserId: input.owUserId, companyId: input.companyId, source: "for_you" });
  } catch (e) {
    console.error("[interest] 会話の作成:", e);
    return null;
  }
  if (!created) return null;
  const conversationId = created.conversationId;
  const now = new Date().toISOString();
  /* ⚠️ 記録を先に書く（二重に届けない）。既に delivered なら0行 */
  const { data: claimed, error: cErr } = await db.from("ow_for_you_reactions")
    .update({ conversation_id: conversationId, interest_status: "delivered", delivered_at: now })
    .eq("user_id", input.owUserId).eq("company_id", input.companyId)
    .is("interest_status", null)
    .select("user_id");
  if (cErr) { console.error("[interest] 届けた記録:", cErr.message); return { conversationId }; }
  if (!claimed || claimed.length === 0) return { conversationId };

  /* ⚠️ 既にあった会話（応募や面談の申込で開いていた）なら、案内の行も企業へのメールも足さない（二重に知らせない） */
  if (!created.created) return { conversationId };
  try {
    const [{ data: cand }, { data: part, error: pErr }] = await Promise.all([
      db.from("ow_users").select("name").eq("id", input.owUserId).maybeSingle(),
      db.from("ow_conversation_participants").select("id").eq("conversation_id", conversationId)
        .eq("user_id", input.owUserId).is("left_at", null).maybeSingle(),
    ]);
    if (pErr) console.error("[interest] 参加者:", pErr.message);
    const t0 = Date.now();
    const { error: iErr } = await db.from("ow_conversation_messages").insert({
      conversation_id: conversationId,
      sender_participant_id: null,
      kind: "proposal_intro",
      body: proposalIntroLine((cand?.name as string | null) ?? null, input.source),
      payload: { interest_source: input.source },
      sent_at: new Date(t0).toISOString(),
    });
    if (iErr) console.error("[interest] 案内の行:", iErr.message);
    if (input.note && part?.id) {
      const { error: nErr } = await db.from("ow_conversation_messages").insert({
        conversation_id: conversationId, sender_participant_id: part.id as string, kind: "text",
        body: input.note, sent_at: new Date(t0 + 1).toISOString(),
      });
      if (nErr) console.error("[interest] ひとこと:", nErr.message);
    }
    /* ★本人がその場で押したので未読にしない */
    if (part?.id) {
      const { error: rErr } = await db.from("ow_conversation_participants")
        .update({ last_read_at: new Date(t0 + 2).toISOString() }).eq("id", part.id as string);
      if (rErr) console.error("[interest] 既読:", rErr.message);
    }
  } catch (e) {
    console.error("[interest] メッセージ:", e);
  }
  await notifyCompanyProposalRaised({ companyId: input.companyId, candidateUserId: input.owUserId, conversationId });
  console.log(`[interest] 届けた company=${input.companyId} conversation=${conversationId} source=${input.source}`);
  return { conversationId };
}

/**
 * ★提案（上段）から押して会話ができたあとに、同じ記録を残す（届け方は introduce.ts。案内の行も同じ）。
 * ⚠️ 提案は担当者がいる企業にしか作らない
 */
export async function recordProposalInterest(input: {
  owUserId: string; companyId: string; note: string | null; conversationId: string | null; consentVersion: unknown;
}): Promise<void> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data: prev, error: pErr } = await db.from("ow_for_you_reactions").select("user_id, interested_at")
    .eq("user_id", input.owUserId).eq("company_id", input.companyId).maybeSingle();
  if (pErr) { console.error("[interest] 提案の記録 取得:", pErr.message); return; }
  const fields = {
    reaction: "interested", reason: null,
    interested_at: (prev?.interested_at as string | null) ?? now,
    interest_source: "proposal", interest_note: input.note,
    consent_version: input.consentVersion === INTEREST_CONSENT_VERSION ? INTEREST_CONSENT_VERSION : null,
    ...(input.conversationId ? { interest_status: "delivered", delivered_at: now, conversation_id: input.conversationId } : {}),
    updated_at: now,
  };
  const { error } = prev
    ? await db.from("ow_for_you_reactions").update(fields).eq("user_id", input.owUserId).eq("company_id", input.companyId)
    : await db.from("ow_for_you_reactions").insert({ user_id: input.owUserId, company_id: input.companyId, rank_at: null, signals: [], ...fields });
  if (error) console.error("[interest] 提案の記録:", error.message);
}

/** 本人へのベル。⚠️ best-effort */
async function notifyCandidate(db: Db, type: "interest_no_reply" | "interest_company_joined", input: {
  owUserId: string; companyId: string; conversationId?: string | null;
}) {
  const { error } = await db.from("ow_notifications").insert({
    recipient_user_id: input.owUserId, type, actor_company_id: input.companyId,
    conversation_id: input.conversationId ?? null,
  });
  if (error) console.error(`[interest] 通知 ${type}:`, error.message);
}

/**
 * ★保存した会社に担当者が付いたら、保存している人に知らせる（2026-10-27 / 柴さんの決定。担当者の承諾などの直後・日次の確認）。
 *   ベルに「保存した〇〇に、『話を聞いてみたい』を送れるようになりました。」を出すだけ（interest_company_joined）。
 * ⚠️★**名前は届けない。** 届くのは本人が改めて「話を聞いてみたい」を押したときだけ。
 * ⚠️ 知らせるのは「最初の担当者が付く前から保存していた人」だけ。2人目以降の担当者が付いたときや、
 *    担当者がいる会社を後から保存した人には知らせない（「送れるようになった」が嘘になる）。
 * ⚠️★最初の担当者が付いたのが SAVED_READY_SINCE より前の会社は対象にしない（この仕組みを入れた日に、
 *    昔から担当者のいる会社を保存していた実在の人へ一斉に知らせが飛ばないため）。
 * ⚠️ 同じ人・同じ会社には1回だけ（既に同じ通知があれば送らない）。知らせる前に押せるかを確かめ直す（在籍・ブロック・検証用の不一致）。
 */
const SAVED_READY_SINCE = "2026-10-27T00:00:00+09:00";

export async function notifySaversOnJoin(companyIds?: string[]): Promise<{ notified: number; checked: number }> {
  const db = createAdminClient();
  let q = db.from("ow_bookmarks").select("user_id, target_id, created_at").eq("target_type", "company");
  if (companyIds && companyIds.length > 0) q = q.in("target_id", companyIds);
  const { data: rows, error } = await q;
  if (error) { console.error("[interest] 保存 取得:", error.message); return { notified: 0, checked: 0 }; }
  const saves = (rows ?? []) as { user_id: string; target_id: string; created_at: string }[];
  if (saves.length === 0) return { notified: 0, checked: 0 };
  const ids = Array.from(new Set(saves.map((r) => r.target_id)));
  const responders = await filterCompaniesWithRespondingStaff(ids);
  if (!responders) return { notified: 0, checked: saves.length };
  const ready = ids.filter((id) => responders.has(id));
  if (ready.length === 0) return { notified: 0, checked: saves.length };

  /* 会社ごとに「最初の担当者が付いた時刻」（会社と is_test が一致する有効な担当者のうち最も早いもの） */
  const [{ data: admins, error: aErr }, { data: cos, error: cErr }, { data: sent, error: nErr }] = await Promise.all([
    db.from("ow_company_admins").select("company_id, accepted_at, joined_at, created_at, ow_users!user_id!inner(is_test)").in("company_id", ready).eq("is_active", true),
    db.from("ow_companies").select("id, is_test").in("id", ready),
    db.from("ow_notifications").select("recipient_user_id, actor_company_id").eq("type", "interest_company_joined").in("actor_company_id", ready),
  ]);
  if (aErr || cErr || nErr) { console.error("[interest] 保存の知らせ 準備:", aErr?.message ?? cErr?.message ?? nErr?.message); return { notified: 0, checked: saves.length }; }
  const coTest = new Map(((cos ?? []) as { id: string; is_test: boolean }[]).map((c) => [c.id, c.is_test === true]));
  const firstAt = new Map<string, string>();
  for (const a of (admins ?? []) as unknown as { company_id: string; accepted_at: string | null; joined_at: string | null; created_at: string; ow_users: { is_test: boolean } | { is_test: boolean }[] }[]) {
    const u = Array.isArray(a.ow_users) ? a.ow_users[0] : a.ow_users;
    if (!u || (u.is_test === true) !== coTest.get(a.company_id)) continue;
    const t = a.accepted_at ?? a.joined_at ?? a.created_at;
    const cur = firstAt.get(a.company_id);
    if (!cur || t < cur) firstAt.set(a.company_id, t);
  }
  const already = new Set(((sent ?? []) as { recipient_user_id: string; actor_company_id: string }[]).map((n) => `${n.recipient_user_id}:${n.actor_company_id}`));

  let notified = 0;
  for (const r of saves) {
    const first = firstAt.get(r.target_id);
    if (!first || Date.parse(first) < Date.parse(SAVED_READY_SINCE)) continue;
    if (Date.parse(r.created_at) >= Date.parse(first)) continue;
    if (already.has(`${r.user_id}:${r.target_id}`)) continue;
    const elig = await checkInterestEligibility(r.user_id, r.target_id, db);
    if (!elig.ok || !elig.hasResponder) continue;
    await notifyCandidate(db, "interest_company_joined", { owUserId: r.user_id, companyId: r.target_id });
    already.add(`${r.user_id}:${r.target_id}`);
    notified++;
  }
  return { notified, checked: saves.length };
}

/**
 * ★企業側の担当者から1通でも送られている会話の集合。取れなければ null（「返事なし」に倒さない）。
 * ⚠️ 返事の判定はここ1か所（日次の確認と /biz の「あなたの返事を待っている人」が同じ関数を通る）。
 */
export async function repliedConversations(db: Db, convIds: string[]): Promise<Set<string> | null> {
  const out = new Set<string>();
  if (convIds.length === 0) return out;
  const { data: parts, error: pErr } = await db.from("ow_conversation_participants")
    .select("id, conversation_id").in("conversation_id", convIds).eq("role", "company_admin");
  if (pErr) { console.error("[interest] 参加者:", pErr.message); return null; }
  const partIds = (parts ?? []).map((p) => p.id as string);
  if (partIds.length === 0) return out;
  const { data: msgs, error: mErr } = await db.from("ow_conversation_messages")
    .select("conversation_id").in("sender_participant_id", partIds).is("deleted_at", null);
  if (mErr) { console.error("[interest] メッセージ:", mErr.message); return null; }
  for (const m of msgs ?? []) out.add(m.conversation_id as string);
  return out;
}

/**
 * ★/biz の「あなたの返事を待っている人」（2026-10-27）。「話を聞いてみたい」で届いた（delivered / no_reply）のに、
 *   その会社の担当者がまだ1通も送っていない人数。
 * ⚠️★検証用の企業には検証用の人だけ、実在の企業には実在の人だけを数える（届ける側でも揃えているが、ここでも見る）。
 * ⚠️ 取得に失敗したら null（0人と出さない）。名前は返さない（数と最初の日だけ）。
 */
export type AwaitingReply = { count: number; oldestAt: string | null; oldestConversationId: string | null };
export async function countAwaitingReply(companyId: string): Promise<AwaitingReply | null> {
  const db = createAdminClient();
  const { data: co, error: cErr } = await db.from("ow_companies").select("is_test").eq("id", companyId).maybeSingle();
  if (cErr || !co) { if (cErr) console.error("[interest] 返事待ち 企業:", cErr.message); return null; }
  const { data: rows, error } = await db.from("ow_for_you_reactions")
    .select("user_id, conversation_id, delivered_at, ow_users!inner(is_test)")
    .eq("company_id", companyId).in("interest_status", ["delivered", "no_reply"]).not("conversation_id", "is", null)
    .eq("ow_users.is_test", co.is_test === true);
  if (error) { console.error("[interest] 返事待ち:", error.message); return null; }
  const list = (rows ?? []) as unknown as { conversation_id: string; delivered_at: string | null }[];
  const replied = await repliedConversations(db, list.map((r) => r.conversation_id));
  if (!replied) return null;
  const waiting = list.filter((r) => !replied.has(r.conversation_id))
    .sort((a, b) => String(a.delivered_at ?? "9").localeCompare(String(b.delivered_at ?? "9")));
  return { count: waiting.length, oldestAt: waiting[0]?.delivered_at ?? null, oldestConversationId: waiting[0]?.conversation_id ?? null };
}

/**
 * ★届けてから返事を見る（日次）。企業側の担当者から1通でも届いていれば replied、
 *   14日たっても届いていなければ no_reply にして本人に知らせる（1回だけ）。
 */
export async function sweepInterestReplies(): Promise<{ replied: number; noReply: number; checked: number }> {
  const db = createAdminClient();
  const { data: rows, error } = await db.from("ow_for_you_reactions")
    .select("user_id, company_id, conversation_id, delivered_at").eq("interest_status", "delivered").not("conversation_id", "is", null);
  if (error) { console.error("[interest] 返事の確認 取得:", error.message); return { replied: 0, noReply: 0, checked: 0 }; }
  const list = (rows ?? []) as { user_id: string; company_id: string; conversation_id: string; delivered_at: string | null }[];
  if (list.length === 0) return { replied: 0, noReply: 0, checked: 0 };
  const repliedConv = await repliedConversations(db, list.map((r) => r.conversation_id));
  if (!repliedConv) return { replied: 0, noReply: 0, checked: list.length };
  const now = Date.now();
  let replied = 0, noReply = 0;
  for (const r of list) {
    if (repliedConv.has(r.conversation_id)) {
      await setStatus(db, r.user_id, r.company_id, { interest_status: "replied" });
      replied++;
      continue;
    }
    if (!r.delivered_at || !isNoReplyDue(r.delivered_at, now)) continue;
    const { data: done, error: uErr } = await db.from("ow_for_you_reactions")
      .update({ interest_status: "no_reply", no_reply_notified_at: new Date().toISOString() })
      .eq("user_id", r.user_id).eq("company_id", r.company_id).eq("interest_status", "delivered").select("user_id");
    if (uErr) { console.error("[interest] 返事なし:", uErr.message); continue; }
    if (done && done.length > 0) {
      await notifyCandidate(db, "interest_no_reply", { owUserId: r.user_id, companyId: r.company_id, conversationId: r.conversation_id });
      noReply++;
    }
  }
  return { replied, noReply, checked: list.length };
}
