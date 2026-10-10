/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyLinkStateFor, type CompanyLinkState } from "@/lib/companies/linkState";
import { jobListingStateFor, type JobListingState } from "@/lib/jobs/publicJobs";
import { listSameTestStaff } from "@/lib/business/sameTestStaff";
import { notify } from "@/lib/notify/email";
import { getCompanyNotificationTarget } from "@/lib/notify/recipients";
import { approachRepliedCompanyTemplate } from "@/lib/notify/templates";
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
  companyApproachStatus,
  approachResendNotice,
  type CompanyApproachStatus,
} from "@/lib/constants/companyApproaches";

/**
 * ★企業からの「声かけ」（2026-10-09）。**判定と書き込みはここの1か所。**
 *
 * 表は `ow_company_approaches`（運営だけが読める形。RLS ポリシー0本・クライアントに GRANT 無し）。
 * 読み書きはすべて admin クライアントで、呼び出し側（API・画面）が所属とプランを確かめてから呼ぶ。
 *
 * ── 送れる相手（`isApproachTarget`）────────────────────────────────────
 *   ★2026-10-10 から判定は DB 関数 `can_send_company_approach()` の1か所（下の①〜④に
 *     「受け取る範囲」と「受け取らない企業」を足したもの）。TS では条件を組み立てない。
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

export const APPROACH_BLOCKED_MESSAGE = "この方には現在メッセージリクエストを送れません";

const MSG = {
  failed: "送信に失敗しました。もう一度お試しください。",
  reasonShort: `理由は${APPROACH_REASON_MIN}文字以上で入力してください`,
  reasonLong: `理由は${APPROACH_REASON_MAX}文字以内で入力してください`,
  bodyLong: `メッセージは${APPROACH_BODY_MAX}文字以内で入力してください`,
  monthly: `今月はこれ以上メッセージリクエストを送れません（1社あたり毎月${APPROACH_MONTHLY_LIMIT}通まで）`,
  open: `返事待ちのメッセージリクエストが${APPROACH_OPEN_LIMIT}件あるため、これ以上メッセージリクエストを送れません（返事があるか、送ってから${APPROACH_EXPIRE_DAYS}日たつと枠に戻ります）`,
  reused: `同じ理由は${APPROACH_REASON_REUSE_DAYS}日間使えません。この方にメッセージリクエストを送りたい理由を書いてください`,
} as const;

const DAY = 24 * 60 * 60 * 1000;
const daysAgoIso = (days: number, now = new Date()) => new Date(now.getTime() - days * DAY).toISOString();

/** 日本時間の今月1日0時（UTC の ISO 文字列） */
export function startOfMonthJst(now = new Date()): string {
  const JST = 9 * 60 * 60 * 1000;
  const j = new Date(now.getTime() + JST);
  return new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), 1) - JST).toISOString();
}

/**
 * ★送れるか（2026-10-10 / 段2）。**判定は DB 関数 `can_send_company_approach()` の1か所。**
 *   中身 = `can_send_scout()`（①②）＋ 受け取る設定（③）＋ 送る担当者との is_test 一致（④）
 *        ＋ 受け取る範囲（職種・業種・規模・勤務地・リモート）＋ 受け取らない企業。
 * ⚠️★条件を TS に書き写さないこと。API の 403・候補者検索のボタン・/u/[id] のボタン・
 *    「声かけを受け取る方のみ」の絞り込みが、すべてこの関数（またはまとめて呼ぶ下の関数）を通る。
 * ⚠️ 関数は service_role だけが呼べる（`scripts/check-definer-grants.sh` が検査する）。
 * 取得に失敗したら false（fail-closed）。
 */
export async function isApproachTarget(params: {
  companyId: string;
  candidateOwUserId: string;
  senderOwUserId: string;
}): Promise<boolean> {
  const m = await approachTargets({ companyId: params.companyId, senderOwUserId: params.senderOwUserId, candidateOwUserIds: [params.candidateOwUserId] });
  return m?.get(params.candidateOwUserId) === true;
}

/** 複数人ぶん（候補者検索の一覧用）。1人でも取得に失敗したら null（呼び出し側は全員を送れない扱いにする） */
export async function approachTargets(params: {
  companyId: string;
  senderOwUserId: string;
  candidateOwUserIds: string[];
}): Promise<Map<string, boolean> | null> {
  const db = createAdminClient();
  const out = new Map<string, boolean>();
  const ids = Array.from(new Set(params.candidateOwUserIds));
  const results = await Promise.all(ids.map((id) => db.rpc("can_send_company_approach", {
    p_company_id: params.companyId,
    p_candidate_ow_user_id: id,
    p_sender_ow_user_id: params.senderOwUserId,
  })));
  for (let i = 0; i < ids.length; i++) {
    const { data, error } = results[i];
    if (error) {
      console.error("[approaches] can_send_company_approach:", error.message);
      return null;
    }
    out.set(ids[i], data === true);
  }
  return out;
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

/**
 * ★この企業が180日以内に声をかけた相手（2026-10-10 / 段5 で中身を足した）。
 * 送信の API の「180日は再送できない」と、画面の重複防止の表示が**同じ関数**を見る。
 * 返すもの: 送った日・送った担当者の名前・状態（承認待ち／やり取り中）・再び送れる日。
 * ⚠️★状態は /biz/approaches と同じ `companyApproachStatus`（見送りは区別しない）。
 * 取得に失敗したら null（呼び出し側はボタンを出さない）。
 */
export type RecentApproach = {
  /** ★送ったリクエストの id（「送った内容を見る」の行き先。2026-10-11） */
  id: string;
  /** ★返信があって開いた会話（「メッセージを開く」の行き先。2026-10-11）。無ければ null */
  conversationId: string | null;
  sentAt: string;
  senderName: string | null;
  /** ★/biz/approaches と同じ判定（`companyApproachStatus`） */
  state: CompanyApproachStatus;
  /** 再び送れる日時（送った日から180日後） */
  resendAt: string;
};

export async function getRecentlyApproached(companyId: string, candidateOwUserIds?: string[]): Promise<Map<string, RecentApproach> | null> {
  const db = createAdminClient();
  let q = db.from("ow_company_approaches").select("id, candidate_user_id, created_at, accepted_at, sender_user_id, conversation_id")
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
  const rows = data ?? [];
  const senderIds = Array.from(new Set(rows.map((r) => r.sender_user_id as string | null).filter(Boolean) as string[]));
  const names = new Map<string, string>();
  if (senderIds.length > 0) {
    const { data: us, error: uErr } = await db.from("ow_users").select("id, name").in("id", senderIds);
    if (uErr) console.error("[approaches] recent senders:", uErr.message);
    for (const u of us ?? []) names.set(u.id as string, ((u.name as string | null) ?? "").trim());
  }
  const m = new Map<string, RecentApproach>();
  for (const r of rows) {
    const id = r.candidate_user_id as string;
    if (m.has(id)) continue;
    const sentAt = r.created_at as string;
    m.set(id, {
      id: r.id as string,
      conversationId: (r.conversation_id as string | null) ?? null,
      sentAt,
      senderName: (r.sender_user_id && names.get(r.sender_user_id as string)) || null,
      state: companyApproachStatus({ createdAt: sentAt, acceptedAt: (r.accepted_at as string | null) ?? null }),
      resendAt: new Date(new Date(sentAt).getTime() + APPROACH_RESEND_DAYS * DAY).toISOString(),
    });
  }
  return m;
}

export type SendApproachResult =
  | { ok: true; id: string }
  /** ★action … 送り済みのときの案内（「送った内容を見る」「メッセージを開く」）。2026-10-11 */
  | { ok: false; status: number; error: string; action?: { label: string; href: string } | null };

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
  /** ★関連する求人（任意。2026-10-10 / 段6）。その企業の公開中の求人だけ */
  jobId?: string | null;
}): Promise<SendApproachResult> {
  const reason = params.reason.trim();
  const body = params.body?.trim() || null;
  if (reason.length < APPROACH_REASON_MIN) return { ok: false, status: 400, error: MSG.reasonShort };
  if (reason.length > APPROACH_REASON_MAX) return { ok: false, status: 400, error: MSG.reasonLong };
  if (body && body.length > APPROACH_BODY_MAX) return { ok: false, status: 400, error: MSG.bodyLong };

  /* ① 同じ人へ180日以内（企業自身の事実なので、事実どおりに返す）。
        ★返信が来るまで（と送ってから一定の期間）は同じ方に続けて送れない。⚠️ 2026-10-11 に 409 から 403 に（柴さんの指示）
        ★言い方は状態で分ける（返事待ち／返信あり／30日経過。`approachResendNotice`。2026-10-11）。
        ⚠️★**相手に関わる理由（②）より先に見る。** 先にブロックを見ると、送り済みの相手がブロックしたときだけ
           答えが変わり、ブロックされたと分かってしまう（DM の 409 を先に返すのと同じ考え方）。 */
  const recent = await getRecentlyApproached(params.companyId, [params.candidateOwUserId]);
  if (!recent) return { ok: false, status: 500, error: MSG.failed };
  const already = recent.get(params.candidateOwUserId);
  if (already) {
    const n = approachResendNotice(already);
    return { ok: false, status: 403, error: n.message, action: n.action };
  }

  /* ② 相手に関わる理由（理由は返さない） */
  if (!(await isApproachTarget(params))) {
    return { ok: false, status: 403, error: APPROACH_BLOCKED_MESSAGE };
  }

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

  /* ⑤ 関連する求人（任意）。⚠️ その企業の公開中の求人だけ（他社・下書きの求人は添えられない） */
  let jobId: string | null = null;
  if (params.jobId) {
    const { data: job, error: jErr } = await db.from("ow_jobs").select("id").eq("id", params.jobId)
      .eq("company_id", params.companyId).eq("status", "published").eq("is_test", false).maybeSingle();
    if (jErr) console.error("[approaches] job:", jErr.message);
    if (!job) return { ok: false, status: 400, error: "添えられる求人ではありません" };
    jobId = job.id as string;
  }

  const { data, error } = await db.from("ow_company_approaches").insert({
    company_id: params.companyId,
    candidate_user_id: params.candidateOwUserId,
    sender_user_id: params.senderOwUserId,
    reason,
    body,
    job_id: jobId,
  }).select("id").single();
  if (error || !data) {
    console.error("[approaches] insert:", error?.message);
    return { ok: false, status: 500, error: MSG.failed };
  }

  /* 求職者のベルに積む（best-effort。メールは送らない）。⚠️ 本文はベルに出さない（ベルの決まり） */
  const { error: nErr } = await db.from("ow_notifications").insert({
    recipient_user_id: params.candidateOwUserId,
    actor_company_id: params.companyId,
    type: "company_approach",
    approach_id: data.id,
  });
  if (nErr) console.error("[approaches] notify:", nErr.message);

  return { ok: true, id: data.id as string };
}

/* ── 受け取る側（段3）──────────────────────────────────────────────────── */

export type IncomingApproach = {
  id: string;
  createdAt: string;
  /** ⚠️ 理由と本文は承認前でも全文見せる（2026-10-09 / 柴さんの判断）。承認で区切るのは2通目以降だけ */
  reason: string;
  body: string | null;
  company: { id: string; name: string; nameEn: string | null; slug: string | null; logoUrl: string | null; logoLetter: string | null; logoGradient: string | null;
    /** ★社名をリンクにするか（2026-10-11）。判定は `companyLinkStateFor` の1か所 */
    linkState: CompanyLinkState };
  senderName: string | null;
  /** ★関連する求人（2026-10-10 / 段4 で求職者側にも出した）。公開中でなければ href を付けない（名前だけ） */
  /** ★掲載の状態（2026-10-11）。判定は `jobListingStateFor` の1か所 */
  job: { title: string; slug: string | null; id: string; state: JobListingState } | null;
};

/**
 * 求職者に届いている、まだ答えていない声かけ（新しい順）。
 * ⚠️★送ってから30日たったものは出さない（企業側は「承認待ち」のまま。区別させない）。
 * ⚠️★いまその企業から見せてはいけない状態（ブロックした・在籍が判明した 等）になったものも出さない
 *    （`can_send_scout()`）。承認しても会話を開けないので、押せる形で残さない。
 * 取得に失敗したら null（呼び出し側は「0件」と出さない）。
 */
export async function listIncomingApproaches(candidateOwUserId: string): Promise<IncomingApproach[] | null> {
  const db = createAdminClient();
  const { data: me, error: meErr } = await db.from("ow_users").select("auth_id, is_test").eq("id", candidateOwUserId).maybeSingle();
  if (meErr || !me?.auth_id) {
    if (meErr) console.error("[approaches] incoming me:", meErr.message);
    return meErr ? null : [];
  }
  const { data, error } = await db
    .from("ow_company_approaches")
    .select("id, created_at, reason, body, company_id, sender_user_id, job_id")
    .eq("candidate_user_id", candidateOwUserId)
    .is("accepted_at", null)
    .is("declined_at", null)
    .gte("created_at", daysAgoIso(APPROACH_EXPIRE_DAYS))
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[approaches] incoming:", error.message);
    return null;
  }
  const rows = data ?? [];
  if (rows.length === 0) return [];

  /* ★受け取らない企業に追加した会社からの承認待ちは出さない（2026-10-10 / 柴さんの判断）。
       ⚠️ 承認の判定は今のまま `can_send_scout()`（範囲は送るときだけ見る）。 */
  const { data: blocked, error: bErr } = await db
    .from("ow_approach_blocked_companies").select("company_id").eq("user_id", candidateOwUserId);
  if (bErr) {
    console.error("[approaches] incoming blocked:", bErr.message);
    return null;
  }
  const blockedIds = new Set((blocked ?? []).map((b) => b.company_id as string));
  const companyIds = Array.from(new Set(rows.map((r) => r.company_id as string))).filter((c) => !blockedIds.has(c));
  const visible = new Set<string>();
  for (const cid of companyIds) {
    const { data: ok, error: rErr } = await db.rpc("can_send_scout", { p_company_id: cid, p_candidate_id: me.auth_id as string });
    if (rErr) {
      console.error("[approaches] incoming can_send_scout:", rErr.message);
      return null;
    }
    if (ok === true) visible.add(cid);
  }
  const shown = rows.filter((r) => visible.has(r.company_id as string));
  if (shown.length === 0) return [];

  const senderIds = Array.from(new Set(shown.map((r) => r.sender_user_id as string | null).filter(Boolean) as string[]));
  const jobIds = Array.from(new Set(shown.map((r) => r.job_id as string | null).filter(Boolean) as string[]));
  const [{ data: comps, error: cErr }, { data: senders, error: sErr }, { data: jobs, error: jErr }] = await Promise.all([
    db.from("ow_companies").select("id, name, name_en, slug, logo_url, logo_letter, logo_gradient, is_test").in("id", Array.from(visible)),
    senderIds.length > 0
      ? db.from("ow_users").select("id, name").in("id", senderIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    jobIds.length > 0
      ? db.from("ow_jobs").select("id, title, slug, status, is_test").in("id", jobIds)
      : Promise.resolve({ data: [] as { id: string; title: string; slug: string | null; status: string; is_test: boolean }[], error: null }),
  ]);
  if (jErr) console.error("[approaches] incoming jobs:", jErr.message);
  if (cErr || sErr) {
    console.error("[approaches] incoming join:", cErr?.message ?? sErr?.message);
    return null;
  }
  const compById = new Map((comps ?? []).map((c) => [c.id as string, c]));
  const senderById = new Map((senders ?? []).map((u) => [u.id as string, u.name as string]));
  const jobById = new Map((jobs ?? []).map((j) => [j.id as string, j]));
  return shown.flatMap((r) => {
    const c = compById.get(r.company_id as string);
    if (!c) return [];
    return [{
      id: r.id as string,
      createdAt: r.created_at as string,
      reason: r.reason as string,
      body: (r.body as string | null) ?? null,
      company: {
        id: c.id as string,
        name: c.name as string,
        nameEn: (c.name_en as string | null) ?? null,
        slug: (c.slug as string | null) ?? null,
        logoUrl: (c.logo_url as string | null) ?? null,
        logoLetter: (c.logo_letter as string | null) ?? null,
        logoGradient: (c.logo_gradient as string | null) ?? null,
        linkState: companyLinkStateFor({ isTest: c.is_test === true }, { viewerIsTest: me.is_test === true }),
      },
      senderName: r.sender_user_id ? senderById.get(r.sender_user_id as string) ?? null : null,
      job: (() => {
        const j = r.job_id ? jobById.get(r.job_id as string) : undefined;
        if (!j) return null;
        return {
          id: j.id as string, title: (j.title as string) || "（無題の求人）", slug: (j.slug as string | null) ?? null,
          state: jobListingStateFor(j as { status: string; is_test: boolean }, { viewerIsTest: me.is_test === true, companyIsTest: c.is_test === true }),
        };
      })(),
    }];
  });
}

/** 届いている声かけの数（「届いているもの」とナビ）。取得に失敗したら null */
export async function countIncomingApproaches(candidateOwUserId: string): Promise<number | null> {
  const list = await listIncomingApproaches(candidateOwUserId);
  return list === null ? null : list.length;
}

export type RespondApproachAction = "decline";

/**
 * 求職者が「今回は見送る」を押す。⚠️ 本人宛て・未回答・30日以内・いま見せてよい企業 のものだけ。
 * ⚠️★見送ったことは企業に伝えない（通知も出さない。企業の画面は「返事待ち」のまま）。
 * ⚠️ 返信は `replyToApproach`（2026-10-11 から「受け入れる」は無い。返信した時点でやり取りが始まる）。
 */
export async function respondToApproach(params: {
  approachId: string;
  candidateOwUserId: string;
  action: RespondApproachAction;
}): Promise<{ ok: true; conversationId: null } | { ok: false; status: number; error: string }> {
  const notFound = { ok: false as const, status: 404, error: "このリクエストは見つかりません" };
  /* ⚠️ 一覧と同じ条件で引き直す（期限切れ・答え済み・いま見せてはいけない企業を押せない形にする） */
  const list = await listIncomingApproaches(params.candidateOwUserId);
  if (list === null) return { ok: false, status: 500, error: MSG.failed };
  if (!list.some((a) => a.id === params.approachId)) return notFound;

  const db = createAdminClient();
  const { data, error } = await db.from("ow_company_approaches")
    .update({ declined_at: new Date().toISOString() })
    .eq("id", params.approachId).eq("candidate_user_id", params.candidateOwUserId)
    .is("accepted_at", null).is("declined_at", null)
    .select("id");
  if (error || (data ?? []).length !== 1) {
    console.error("[approaches] decline:", error?.message ?? `rows=${(data ?? []).length}`);
    return { ok: false, status: 500, error: MSG.failed };
  }
  return { ok: true, conversationId: null };
}

/** ★返信の長さ（2026-10-11）。DB 関数 reply_to_company_approach / reply_to_message_request と同じ値 */
export const APPROACH_REPLY_MAX = 2000;

/**
 * ★求職者が返信する（2026-10-11 / 柴さんの指示。LinkedIn の InMail と同じく「受け入れる」を挟まない）。
 *
 * ⚠️★書き込みは DB 関数 `reply_to_company_approach` の**1トランザクション**（service_role だけ）:
 *    返信済み（accepted_at。★列名はそのまま、意味は「返信した日時」）→ 会話を開く → 送った担当者を参加者に
 *    → 1通目（理由＋本文。送った担当者の名前のまま。もう有効でなくても）→ 2通目（返信）→ conversation_id。
 *    途中で失敗したら全部戻る（会話だけ開いて返信が無い、を残さない）。
 * ⚠️ 一覧と同じ条件（本人宛て・未回答・30日以内・いま見せてよい企業）で先に引き直す。DB 関数も同じことを見る（二重）。
 * ⚠️ メールは書き込みが済んでから（best-effort）。返信の中身は書かない。
 */
export async function replyToApproach(params: {
  approachId: string;
  candidateOwUserId: string;
  body: string;
}): Promise<{ ok: true; conversationId: string } | { ok: false; status: number; error: string }> {
  const body = params.body.trim();
  if (!body) return { ok: false, status: 400, error: "返信を入力してください" };
  if (body.length > APPROACH_REPLY_MAX) return { ok: false, status: 400, error: `返信は${APPROACH_REPLY_MAX}文字以内で入力してください` };

  const list = await listIncomingApproaches(params.candidateOwUserId);
  if (list === null) return { ok: false, status: 500, error: MSG.failed };
  const target = list.find((a) => a.id === params.approachId);
  if (!target) return { ok: false, status: 404, error: "このリクエストは見つかりません" };

  const db = createAdminClient();
  const { data, error } = await db.rpc("reply_to_company_approach", {
    p_approach_id: params.approachId,
    p_candidate_ow_user_id: params.candidateOwUserId,
    p_body: body,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "OR404") return { ok: false, status: 404, error: "このリクエストは見つかりません" };
    if (code === "OR409") return { ok: false, status: 409, error: "このリクエストにはすでに返信しています" };
    if (code === "OR403") return { ok: false, status: 403, error: "現在この企業とはやり取りを始められません" };
    if (code === "OR400") return { ok: false, status: 400, error: `返信は1〜${APPROACH_REPLY_MAX}文字で入力してください` };
    console.error("[approaches] reply:", error.message);
    return { ok: false, status: 500, error: MSG.failed };
  }
  const conversationId = data as string;

  const { data: row, error: rErr } = await db.from("ow_company_approaches").select("sender_user_id").eq("id", params.approachId).maybeSingle();
  if (rErr) console.error("[approaches] reply sender:", rErr.message);
  /* ★企業にメールで知らせる。⚠️ best-effort（失敗しても返信は成立している）。
        ⚠️ DB 関数は未返信のものにしか通らない（二重の返信は OR409）ので、メールも1回だけ */
  await notifyApproachReplied({
    companyId: target.company.id,
    senderOwUserId: (row?.sender_user_id as string | null) ?? null,
    candidateOwUserId: params.candidateOwUserId,
    conversationId,
  });
  return { ok: true, conversationId };
}

/**
 * ★リクエストに返信があったことを企業にメールで知らせる（2026-10-10。2026-10-11 に「承認」から「返信」へ）。
 *
 * 宛先: **声かけを送った担当者**（いまも有効な管理者でメールがある場合）。
 *       届かない場合（退任・無効・メール無し）は応募の通知と同じ決め方（`getCompanyNotificationTarget`）。
 * ⚠️★本文に会話の内容を書かない（名前と会話へのリンクだけ。`approachRepliedCompanyTemplate`）。
 * ⚠️★見送られたときは呼ばない（企業から見て承認待ちのまま）。
 * ⚠️ 失敗しても投げない（ログだけ）。
 */
async function notifyApproachReplied(params: {
  companyId: string;
  senderOwUserId: string | null;
  candidateOwUserId: string;
  conversationId: string;
}): Promise<void> {
  try {
    const db = createAdminClient();
    const { data: cand, error: cErr } = await db.from("ow_users").select("name").eq("id", params.candidateOwUserId).maybeSingle();
    if (cErr) console.error("[approaches] notify accepted candidate:", cErr.message);

    let to: string[] = [];
    let viaOps = false;
    if (params.senderOwUserId) {
      const [{ data: link, error: lErr }, { data: sender, error: sErr }] = await Promise.all([
        db.from("ow_company_admins").select("id").eq("user_id", params.senderOwUserId)
          .eq("company_id", params.companyId).eq("is_active", true).maybeSingle(),
        db.from("ow_users").select("email").eq("id", params.senderOwUserId).maybeSingle(),
      ]);
      if (lErr || sErr) console.error("[approaches] notify accepted sender:", lErr?.message ?? sErr?.message);
      const email = ((sender?.email as string | null) ?? "").trim();
      if (link && email) to = [email];
    }
    if (to.length === 0) {
      const target = await getCompanyNotificationTarget(params.companyId, "approach-accepted");
      to = target.to;
      viaOps = target.viaOps;
    }
    for (const addr of to) {
      await notify(approachRepliedCompanyTemplate({
        to: addr,
        candidateName: (cand?.name as string | null) ?? null,
        conversationId: params.conversationId,
        viaOps,
      }));
    }
  } catch (e) {
    console.error("[approaches] notify accepted:", e instanceof Error ? e.message : e);
  }
}

/**
 * ★/biz サイドバーの「声かけ」の数字（2026-10-10）: 承認されて、まだ企業が会話を開いていない件数。
 * ⚠️ 見送られた・承認待ちは数えない（accepted_at が null）。失敗したら 0（ログは出す。バッジのために落とさない）。
 */
export async function countUnseenAcceptedApproaches(companyId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("ow_company_approaches").select("id", { count: "exact", head: true })
    .eq("company_id", companyId).not("accepted_at", "is", null).is("company_seen_at", null);
  if (error) {
    console.error("[approaches] unseen accepted:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * 企業の担当者が会話を開いたら、その会話の声かけに company_seen_at を立てる（2026-10-10）。
 * ⚠️ 呼び出し側（/biz/conversations/[id]）が「その会話が自社のもの」を確かめてから呼ぶ。
 * ⚠️ 失敗しても画面は出す（ログだけ）。
 */
export async function markApproachSeenByCompany(conversationId: string, companyId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("ow_company_approaches")
    .update({ company_seen_at: new Date().toISOString() })
    .eq("conversation_id", conversationId).eq("company_id", companyId)
    .not("accepted_at", "is", null).is("company_seen_at", null);
  if (error) console.error("[approaches] mark seen:", error.message);
}

export type SentApproach = {
  id: string;
  createdAt: string;
  reason: string;
  /** ★企業に見せる状態（`companyApproachStatus`。承認待ち／30日を過ぎました／やり取り中）。⚠️ 見送りは区別しない */
  status: CompanyApproachStatus;
  conversationId: string | null;
  candidate: { id: string; name: string; headline: string | null; avatarUrl: string | null; avatarColor: string | null; username: string | null };
  senderName: string | null;
  /** ★2026-10-11（キャンバス4）: 本文・承認日・企業が会話を開いたか・添えた求人 */
  body: string | null;
  acceptedAt: string | null;
  /** 承認済みで、企業がまだ会話を開いていない（`company_seen_at` が null） */
  unseen: boolean;
  jobTitle: string | null;
};

/** 企業が送った声かけの一覧（新しい順）。⚠️ declined_at は読まない・返さない */
export async function listSentApproaches(companyId: string): Promise<SentApproach[] | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("ow_company_approaches")
    /* ⚠️★declined_at を select に入れないこと。企業に断ったことが伝わる経路を作らない */
    .select("id, created_at, reason, body, accepted_at, company_seen_at, conversation_id, candidate_user_id, sender_user_id, job_id, ow_jobs(title)")
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
      status: companyApproachStatus({ createdAt: r.created_at as string, acceptedAt: (r.accepted_at as string | null) ?? null }),
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
      body: (r.body as string | null) ?? null,
      acceptedAt: (r.accepted_at as string | null) ?? null,
      unseen: !!r.accepted_at && !r.company_seen_at,
      jobTitle: ((r.ow_jobs as { title?: string } | null)?.title as string | undefined) ?? null,
    };
  });
}

/** ★声かけに添えられる求人（その企業の公開中の求人。2026-10-10 / 段6）。失敗したら空（選択欄を出さない） */
export async function listApproachableJobs(companyId: string): Promise<{ id: string; title: string }[]> {
  const { data, error } = await createAdminClient().from("ow_jobs").select("id, title")
    .eq("company_id", companyId).eq("status", "published").eq("is_test", false).order("created_at", { ascending: false });
  if (error) { console.error("[approaches] jobs:", error.message); return []; }
  return (data ?? []).map((j) => ({ id: j.id as string, title: (j.title as string) || "（無題の求人）" }));
}

/**
 * ★声かけを送れる担当者（2026-10-10 / 候補者探し 段4）。**その企業の有効な担当者だけ**（`ow_company_admins.is_active`）。
 * ⚠️ 送信の API はここに入っている人以外を送り手にしない（画面の選択肢と同じ関数）。
 * ⚠️ 名前は ow_users.name。空・プレースホルダは「担当者」。取れなければ null。
 */
/**
 * ★声かけを「送る担当者」として選べる人。**操作している人と is_test が同じ担当者だけ**（2026-10-10）。
 * ⚠️ 判定は `lib/business/sameTestStaff.ts` の1か所（日程調整の同席者と同じ決まり）。画面と送信 API の両方がここを通す。
 */
export async function listApproachSenders(companyId: string, operatorOwUserId: string): Promise<{ id: string; name: string }[] | null> {
  return listSameTestStaff(companyId, operatorOwUserId);
}
