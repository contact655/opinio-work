/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { proposalPhase, companyTabOf, type ProposalPhase } from "@/lib/constants/proposalResponses";
import { PROPOSAL_PHASE_COLS, phaseInputOf, visiblePairs, isVisiblePair } from "./proposalEnded";

/**
 * ★企業側で提案を読む処理は、**すべてこのファイルを通す**（2026-10-11 / 提案を「求職者が先に答える」形にした）。
 *
 * ⚠️★返すのは「求職者が『話を聞いてみたい』と答えた行」だけ。未回答・見送り・30日経過は、
 *    企業には一切出さない（名前も件数の内訳も）。例外は `companyProposalStats` の合計人数だけで、
 *    これも1日1回の集計（今日の0時より前のもの）にしてある。
 * ⚠️★`src/app/biz`・`src/lib/business`・`src/app/api/biz` から `ow_proposals` を直接読まないこと。
 *    `node scripts/check-proposal-reads.mjs` が0件を確かめる。
 */

/* ⚠️★企業の設定（すぐにメッセージ／確認してから）は 2026-10-11 に廃止した（柴さんの指示）。
      `ow_company_proposal_settings` は残してあるが読み書きしない。getCompanyProposalMode / setCompanyProposalMode は削除した */

// ── 届いた方 ──────────────────────────────────────────────────────────────────

export type CompanyProposalRow = {
  id: string;
  /** ow_users 空間 */
  candidateUserId: string;
  jobId: string | null;
  jobTitle: string | null;
  evidence: unknown[];
  counter: unknown[];
  note: string | null;
  phase: ProposalPhase;
  tab: "arrived" | "ended";
  /** 求職者が「話を聞いてみたい」と答えた日時 */
  raisedAt: string;
  introducedAt: string | null;
  conversationId: string | null;
  /** ★企業の参加者が会話を開いたか（ホームの「対応が必要なもの」に使う） */
  companySeenAt: string | null;
};

const COMPANY_COLS =
  `id, candidate_user_id, company_id, job_id, evidence, counter_evidence, candidate_note, candidate_responded_at, conversation_id, company_seen_at, ${PROPOSAL_PHASE_COLS}, ow_jobs(title)` as const;

function toRow(r: Record<string, unknown>, visible: boolean): CompanyProposalRow | null {
  const input = phaseInputOf(r);
  const phase = proposalPhase(input, visible);
  const tab = companyTabOf(phase, input.candidateResponse);
  if (!tab) return null;
  const job = r.ow_jobs as { title?: string } | { title?: string }[] | null;
  const jobTitle = Array.isArray(job) ? job[0]?.title ?? null : job?.title ?? null;
  return {
    id: r.id as string,
    candidateUserId: r.candidate_user_id as string,
    jobId: (r.job_id as string | null) ?? null,
    jobTitle,
    evidence: Array.isArray(r.evidence) ? (r.evidence as unknown[]) : [],
    counter: Array.isArray(r.counter_evidence) ? (r.counter_evidence as unknown[]) : [],
    note: (r.candidate_note as string | null) ?? null,
    phase,
    tab,
    raisedAt: (r.candidate_responded_at as string | null) ?? (r.created_at as string),
    introducedAt: input.introducedAt,
    conversationId: (r.conversation_id as string | null) ?? null,
    companySeenAt: (r.company_seen_at as string | null) ?? null,
  };
}

/**
 * ★企業に届いた提案（求職者が「話を聞いてみたい」と答えたものだけ）。新しく答えた順。
 * ⚠️ 失敗したら null（0件と区別する）。
 */
export async function listCompanyProposals(companyId: string): Promise<CompanyProposalRow[] | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("ow_proposals")
    .select(COMPANY_COLS)
    .eq("company_id", companyId)
    /* ★★ここが守りの本体。未回答・見送りの行は取りにも行かない */
    .eq("candidate_response", "interested")
    .order("candidate_responded_at", { ascending: false });
  if (error) {
    console.error("[companyProposals] 一覧:", error.message);
    return null;
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  const visible = await visiblePairs(rows.map((r) => ({ companyId, candidateUserId: r.candidate_user_id as string })));
  return rows
    .map((r) => toRow(r, isVisiblePair(visible, { companyId, candidateUserId: r.candidate_user_id as string })))
    .filter((r): r is CompanyProposalRow => r !== null);
}

/**
 * ★企業が対応すべき提案（ホームの「対応が必要なもの」）。会話ができたが、まだ企業の参加者が開いていないもの。
 * ⚠️ 2026-10-11 に「会うかどうかを決める（review）」をなくした。
 */
export type CompanyProposalTodo = { id: string; candidateUserId: string; at: string; kind: "open"; conversationId: string | null };
export async function listCompanyProposalTodos(companyId: string): Promise<CompanyProposalTodo[] | null> {
  const rows = await listCompanyProposals(companyId);
  if (!rows) return null;
  const out: CompanyProposalTodo[] = [];
  for (const r of rows) {
    if (r.phase === "introduced" && r.conversationId && !r.companySeenAt) out.push({ id: r.id, candidateUserId: r.candidateUserId, at: r.raisedAt, kind: "open", conversationId: r.conversationId });
  }
  return out;
}

/* ⚠️ countCompanyProposalReviews（サイドバーの「紹介」のバッジ）は 2026-10-11 に削除した。
      届いた方はその場で会話になり、メッセージのバッジ（unseenProposalConversationIds）で数える */

/** ★提案から始まって、企業の参加者がまだ開いていない会話（/biz/messages の「新しい」印とサイドバーのバッジ） */
export async function unseenProposalConversationIds(companyId: string): Promise<Set<string>> {
  const { data, error } = await createAdminClient()
    .from("ow_proposals").select("conversation_id")
    .eq("company_id", companyId).eq("candidate_response", "interested")
    .not("introduced_at", "is", null).not("conversation_id", "is", null).is("company_seen_at", null);
  if (error) {
    console.error("[companyProposals] 未読の会話:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.conversation_id as string));
}

/**
 * ★提案から始まった会話を、企業の参加者が開いた（`company_seen_at`）。
 * ⚠️ 呼び出し側（/biz/messages/[id]）が「参加者が開いた」ことを確かめてから呼ぶ（声かけの `markApproachSeenByCompany` と同じ）。
 */
export async function markProposalSeenByCompany(conversationId: string, companyId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("ow_proposals").update({ company_seen_at: new Date().toISOString() })
    .eq("conversation_id", conversationId).eq("company_id", companyId)
    .is("company_seen_at", null);
  if (error) console.error("[companyProposals] 開いた印:", error.message);
}

/** ★会話のうち、提案から始まったもの（選考管理の「提案から」の印）。⚠️ 会話ができた提案だけ（＝求職者が答えたもの） */
export async function proposalConversationIds(conversationIds: string[]): Promise<Set<string>> {
  if (conversationIds.length === 0) return new Set();
  const { data, error } = await createAdminClient()
    .from("ow_proposals").select("conversation_id").in("conversation_id", conversationIds)
    .eq("candidate_response", "interested").not("introduced_at", "is", null);
  if (error) {
    console.error("[companyProposals] 提案の会話:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.conversation_id as string));
}

// ── 集計（1日1回）──────────────────────────────────────────────────────────────

/** 日本時間の今日の0時（UTC の ISO）。⚠️ 集計はこれより前のものだけ数える（＝毎朝更新） */
export function startOfTodayJstIso(now = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - 9 * 60 * 60 * 1000).toISOString();
}
/** 日本時間の今月1日の0時（UTC の ISO） */
export function startOfMonthJstIso(now = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - 9 * 60 * 60 * 1000).toISOString();
}

export type CompanyProposalStats = {
  /** 貴社をご紹介した方（人数） */
  introduced: number;
  /** 話を聞いてみたいと答えた方（人数） */
  raised: number;
  /** 面談につながった方（人数） */
  meetings: number;
  /** 集計の締め（この時刻より前のものを数えた） */
  cutoff: string;
};

/**
 * ★企業に出してよい提案の数字（2026-10-11 / 柴さんの判断）。**人数だけ。名前も内訳も返さない。**
 * ⚠️★1日1回の集計: 今日の0時（日本時間）より前に作られた提案・答えられた返事・決まった面談だけを数える。
 *    即時にすると、運営が提案を作った直後に数字が動き「いま誰かに紹介された」ことが分かってしまうため。
 * ⚠️ 実在の企業では検証用の求職者を数えない（声かけの分析と同じ扱い）。失敗したら null。
 * @param fromIso 期間の始まり（null は全期間）
 */
export async function companyProposalStats(companyId: string, fromIso: string | null, now = new Date()): Promise<CompanyProposalStats | null> {
  const db = createAdminClient();
  const cutoff = startOfTodayJstIso(now);
  let q = db.from("ow_proposals")
    .select("candidate_user_id, candidate_response, candidate_responded_at, conversation_id, created_at")
    .eq("company_id", companyId).lt("created_at", cutoff);
  if (fromIso) q = q.gte("created_at", fromIso);
  const [{ data, error }, { data: comp, error: cErr }] = await Promise.all([
    q,
    db.from("ow_companies").select("is_test").eq("id", companyId).maybeSingle(),
  ]);
  if (error || cErr) {
    console.error("[companyProposals] 集計:", error?.message ?? cErr?.message);
    return null;
  }
  let rows = data ?? [];
  if (comp?.is_test !== true && rows.length > 0) {
    const ids = Array.from(new Set(rows.map((r) => r.candidate_user_id as string)));
    const { data: us, error: uErr } = await db.from("ow_users").select("id, is_test").in("id", ids);
    if (uErr) {
      console.error("[companyProposals] 集計の検証用:", uErr.message);
      return null;
    }
    const test = new Set((us ?? []).filter((u) => u.is_test === true).map((u) => u.id as string));
    rows = rows.filter((r) => !test.has(r.candidate_user_id as string));
  }
  const raisedRows = rows.filter((r) => r.candidate_response === "interested" && r.candidate_responded_at && (r.candidate_responded_at as string) < cutoff);
  const convIds = Array.from(new Set(raisedRows.map((r) => r.conversation_id as string | null).filter(Boolean) as string[]));
  let meetingConvs = new Set<string>();
  if (convIds.length > 0) {
    const { data: ms, error: mErr } = await db.from("ow_meetings").select("conversation_id")
      .in("conversation_id", convIds).eq("status", "scheduled").lt("created_at", cutoff);
    if (mErr) {
      console.error("[companyProposals] 集計の面談:", mErr.message);
      return null;
    }
    meetingConvs = new Set((ms ?? []).map((m) => m.conversation_id as string));
  }
  const people = (xs: typeof rows) => new Set(xs.map((r) => r.candidate_user_id as string)).size;
  return {
    introduced: people(rows),
    raised: people(raisedRows),
    meetings: people(raisedRows.filter((r) => r.conversation_id && meetingConvs.has(r.conversation_id as string))),
    cutoff,
  };
}
