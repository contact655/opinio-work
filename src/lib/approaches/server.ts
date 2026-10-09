/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isReachableByCompanies } from "@/lib/constants/careerPreferences";
import {
  APPROACH_BODY_MAX,
  APPROACH_EXPIRE_DAYS,
  APPROACH_MONTHLY_LIMIT,
  APPROACH_OPEN_LIMIT,
  APPROACH_REASON_MAX,
  APPROACH_REASON_MIN,
  APPROACH_REASON_REUSE_DAYS,
  APPROACH_RESEND_DAYS,
  normalizeApproachReason,
} from "@/lib/constants/companyApproaches";

/**
 * ★企業からの「声かけ」（2026-10-09）。**判定と書き込みはここの1か所。**
 *
 * 表は `ow_company_approaches`（運営だけが読める形。RLS ポリシー0本・クライアントに GRANT 無し）。
 * 読み書きはすべて admin クライアントで、呼び出し側（API・画面）が所属とプランを確かめてから呼ぶ。
 *
 * ── 送れる相手（`isApproachTarget`）────────────────────────────────────
 *   ① `can_send_scout()` が true（在籍した会社・グループ会社・ブロック・転職勧奨禁止・管理者本人・
 *      検証用と実在の区別。**条件を TS に書き写さない**）
 *   ② 転職意欲が企業に届く値（`isReachableByCompanies`。「情報収集として」も含む）
 *   ③ ★本人が「声かけを受け取る」を選んでいる（`accept_company_approaches = true`。null は受け取らない扱い）
 *   ④ 送る担当者と相手の is_test が一致する（DM の `contactGate` と同じ考え方。
 *      実在の企業に検証用の担当者がいるため、①だけでは検証用の担当者から実在の人へ届く）
 *   ⚠️★送れない相手にはボタンを出さず、API も理由を返さない（`APPROACH_BLOCKED_MESSAGE`）。
 *
 * ── 上限（企業単位）──────────────────────────────────────────────────
 *   ・月10件（日本時間の月初区切り）。断られたものも数える
 *   ・承認待ち10件。⚠️★「承認されていない かつ 送ってから30日以内」を数える。
 *     断られたものも数える（枠の増減から断られたことが分からないように）。
 *     30日で数えなくなるのは、求職者の一覧から消える期限と同じ。断ったかどうかに関係なく
 *     一律に時間で外れるので、企業には区別がつかない。⚠️ 外さないと、断られた10件で永久に送れなくなる。
 *   ・同じ人へは送ってから180日間は再送できない（承認待ち・断られた・承認済みを区別しない）
 *   ・同じ理由（空白を詰めて完全一致）は30日間使い回せない
 */

export const APPROACH_BLOCKED_MESSAGE = "この方には現在声をかけられません";

const MSG = {
  failed: "送信に失敗しました。もう一度お試しください。",
  reasonShort: `理由は${APPROACH_REASON_MIN}文字以上で入力してください`,
  reasonLong: `理由は${APPROACH_REASON_MAX}文字以内で入力してください`,
  bodyLong: `メッセージは${APPROACH_BODY_MAX}文字以内で入力してください`,
  monthly: `今月はこれ以上声をかけられません（1社あたり月${APPROACH_MONTHLY_LIMIT}件まで）`,
  open: `承認待ちの声かけが${APPROACH_OPEN_LIMIT}件あるため、これ以上声をかけられません`,
  resend: `この方には${APPROACH_RESEND_DAYS}日以内に声をかけています。続けて送ることはできません`,
  reused: `同じ理由は${APPROACH_REASON_REUSE_DAYS}日間使えません。この方に声をかけたい理由を書いてください`,
} as const;

const DAY = 24 * 60 * 60 * 1000;
const daysAgoIso = (days: number, now = new Date()) => new Date(now.getTime() - days * DAY).toISOString();

/** 日本時間の今月1日0時（UTC の ISO 文字列） */
export function startOfMonthJst(now = new Date()): string {
  const JST = 9 * 60 * 60 * 1000;
  const j = new Date(now.getTime() + JST);
  return new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), 1) - JST).toISOString();
}

/** ③②（profile 側の条件）だけの判定。⚠️ ①④は別に見ること。画面で一覧を作るときに使う */
export function profileAcceptsApproaches(p: { career_stance: string | null; accept_company_approaches: boolean | null } | null | undefined): boolean {
  return !!p && isReachableByCompanies(p.career_stance) && p.accept_company_approaches === true;
}

/** ①〜④すべて。取得に失敗したら false（fail-closed）。⚠️ 送信の API はかならずこれを通す */
export async function isApproachTarget(params: {
  companyId: string;
  candidateOwUserId: string;
  senderOwUserId: string;
}): Promise<boolean> {
  const db = createAdminClient();
  const { data: users, error: uErr } = await db
    .from("ow_users").select("id, auth_id, is_test, is_system")
    .in("id", [params.candidateOwUserId, params.senderOwUserId]);
  if (uErr) {
    console.error("[approaches] ow_users:", uErr.message);
    return false;
  }
  const cand = (users ?? []).find((u) => u.id === params.candidateOwUserId);
  const sender = (users ?? []).find((u) => u.id === params.senderOwUserId);
  if (!cand || !sender || cand.is_system === true || !cand.auth_id) return false;
  if (params.candidateOwUserId === params.senderOwUserId) return false;
  /* ④ */
  if ((cand.is_test === true) !== (sender.is_test === true)) return false;

  const { data: prof, error: pErr } = await db
    .from("ow_profiles").select("career_stance, accept_company_approaches")
    .eq("user_id", cand.auth_id as string).maybeSingle();
  if (pErr) {
    console.error("[approaches] ow_profiles:", pErr.message);
    return false;
  }
  /* ②③ */
  if (!profileAcceptsApproaches(prof as { career_stance: string | null; accept_company_approaches: boolean | null } | null)) return false;

  /* ① ⚠️ `p_candidate_id` は auth 空間 */
  const { data: ok, error: rErr } = await db.rpc("can_send_scout", {
    p_company_id: params.companyId,
    p_candidate_id: cand.auth_id as string,
  });
  if (rErr) {
    console.error("[approaches] can_send_scout:", rErr.message);
    return false;
  }
  return ok === true;
}

export type ApproachQuota = {
  monthlyUsed: number;
  monthlyLimit: number;
  openCount: number;
  openLimit: number;
};

/** 企業の残り枠。取得に失敗したら null（呼び出し側は止める） */
export async function getApproachQuota(companyId: string): Promise<ApproachQuota | null> {
  const db = createAdminClient();
  const [monthly, open] = await Promise.all([
    db.from("ow_company_approaches").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).gte("created_at", startOfMonthJst()),
    /* ⚠️ 断られたものも数える（declined_at を条件に入れない）。期限の30日で外れる */
    db.from("ow_company_approaches").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).is("accepted_at", null).gte("created_at", daysAgoIso(APPROACH_EXPIRE_DAYS)),
  ]);
  if (monthly.error || open.error) {
    console.error("[approaches] quota:", monthly.error?.message ?? open.error?.message);
    return null;
  }
  return {
    monthlyUsed: monthly.count ?? 0,
    monthlyLimit: APPROACH_MONTHLY_LIMIT,
    openCount: open.count ?? 0,
    openLimit: APPROACH_OPEN_LIMIT,
  };
}

export function quotaBlockMessage(q: ApproachQuota): string | null {
  if (q.monthlyUsed >= q.monthlyLimit) return MSG.monthly;
  if (q.openCount >= q.openLimit) return MSG.open;
  return null;
}

/** この企業が180日以内に声をかけた相手（ow_users.id → 送った日時）。⚠️ 状態は返さない */
export async function getRecentlyApproached(companyId: string, candidateOwUserIds?: string[]): Promise<Map<string, string> | null> {
  const db = createAdminClient();
  let q = db.from("ow_company_approaches").select("candidate_user_id, created_at")
    .eq("company_id", companyId).gte("created_at", daysAgoIso(APPROACH_RESEND_DAYS))
    .order("created_at", { ascending: false });
  if (candidateOwUserIds) {
    if (candidateOwUserIds.length === 0) return new Map();
    q = q.in("candidate_user_id", candidateOwUserIds);
  }
  const { data, error } = await q;
  if (error) {
    console.error("[approaches] recent:", error.message);
    return null;
  }
  const m = new Map<string, string>();
  for (const r of data ?? []) {
    if (!m.has(r.candidate_user_id as string)) m.set(r.candidate_user_id as string, r.created_at as string);
  }
  return m;
}

export type SendApproachResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string };

/**
 * 声かけを送る。⚠️ 呼び出し側は「企業の有効な担当者であること」と `canUse(…, "companyApproach")` を
 * 確かめてから呼ぶこと（ここでは見ない）。
 * ⚠️ 通知は段3で足す（`notifyApproach`）。
 */
export async function sendApproach(params: {
  companyId: string;
  senderOwUserId: string;
  candidateOwUserId: string;
  reason: string;
  body: string | null;
}): Promise<SendApproachResult> {
  const reason = params.reason.trim();
  const body = params.body?.trim() || null;
  if (reason.length < APPROACH_REASON_MIN) return { ok: false, status: 400, error: MSG.reasonShort };
  if (reason.length > APPROACH_REASON_MAX) return { ok: false, status: 400, error: MSG.reasonLong };
  if (body && body.length > APPROACH_BODY_MAX) return { ok: false, status: 400, error: MSG.bodyLong };

  /* ① 相手に関わる理由（理由は返さない） */
  if (!(await isApproachTarget(params))) {
    return { ok: false, status: 403, error: APPROACH_BLOCKED_MESSAGE };
  }

  /* ② 同じ人へ180日以内（企業自身の事実なので、事実どおりに返す） */
  const recent = await getRecentlyApproached(params.companyId, [params.candidateOwUserId]);
  if (!recent) return { ok: false, status: 500, error: MSG.failed };
  if (recent.has(params.candidateOwUserId)) return { ok: false, status: 409, error: MSG.resend };

  /* ③ 企業の枠 */
  const quota = await getApproachQuota(params.companyId);
  if (!quota) return { ok: false, status: 500, error: MSG.failed };
  const qMsg = quotaBlockMessage(quota);
  if (qMsg) return { ok: false, status: 429, error: qMsg };

  /* ④ 同じ理由の使い回し（企業単位・30日） */
  const db = createAdminClient();
  const { data: recentReasons, error: rErr } = await db
    .from("ow_company_approaches").select("reason")
    .eq("company_id", params.companyId).gte("created_at", daysAgoIso(APPROACH_REASON_REUSE_DAYS));
  if (rErr) {
    console.error("[approaches] reasons:", rErr.message);
    return { ok: false, status: 500, error: MSG.failed };
  }
  const norm = normalizeApproachReason(reason);
  if ((recentReasons ?? []).some((r) => normalizeApproachReason(r.reason as string) === norm)) {
    return { ok: false, status: 409, error: MSG.reused };
  }

  const { data, error } = await db.from("ow_company_approaches").insert({
    company_id: params.companyId,
    candidate_user_id: params.candidateOwUserId,
    sender_user_id: params.senderOwUserId,
    reason,
    body,
  }).select("id").single();
  if (error || !data) {
    console.error("[approaches] insert:", error?.message);
    return { ok: false, status: 500, error: MSG.failed };
  }
  return { ok: true, id: data.id as string };
}

export type SentApproach = {
  id: string;
  createdAt: string;
  reason: string;
  /** ⚠️ 企業に見せる状態は2つだけ。断った・期限切れは「承認待ち」のまま */
  status: "pending" | "accepted";
  conversationId: string | null;
  candidate: { id: string; name: string; headline: string | null; avatarUrl: string | null; avatarColor: string | null; username: string | null };
  senderName: string | null;
};

/** 企業が送った声かけの一覧（新しい順）。⚠️ declined_at は読まない・返さない */
export async function listSentApproaches(companyId: string): Promise<SentApproach[] | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("ow_company_approaches")
    /* ⚠️★declined_at を select に入れないこと。企業に断ったことが伝わる経路を作らない */
    .select("id, created_at, reason, accepted_at, conversation_id, candidate_user_id, sender_user_id")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[approaches] list sent:", error.message);
    return null;
  }
  const rows = data ?? [];
  const userIds = Array.from(new Set(rows.flatMap((r) => [r.candidate_user_id as string, r.sender_user_id as string | null]).filter(Boolean) as string[]));
  const users = new Map<string, { id: string; name: string; headline: string | null; avatar_url: string | null; avatar_color: string | null; username: string | null }>();
  if (userIds.length > 0) {
    const { data: us, error: uErr } = await db
      .from("ow_users").select("id, name, headline, avatar_url, avatar_color, username").in("id", userIds);
    if (uErr) {
      console.error("[approaches] list sent users:", uErr.message);
      return null;
    }
    for (const u of us ?? []) users.set(u.id as string, u as never);
  }
  return rows.map((r) => {
    const c = users.get(r.candidate_user_id as string);
    const s = r.sender_user_id ? users.get(r.sender_user_id as string) : undefined;
    return {
      id: r.id as string,
      createdAt: r.created_at as string,
      reason: r.reason as string,
      status: r.accepted_at ? "accepted" : "pending",
      conversationId: (r.conversation_id as string | null) ?? null,
      candidate: {
        id: r.candidate_user_id as string,
        name: c?.name ?? "",
        headline: c?.headline ?? null,
        avatarUrl: c?.avatar_url ?? null,
        avatarColor: c?.avatar_color ?? null,
        username: c?.username ?? null,
      },
      senderName: s?.name ?? null,
    };
  });
}
