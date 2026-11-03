import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateAllowNone, mutateOne } from "@/lib/supabase/mutate";
import { companyKey, oldest, type ExpRow } from "@/lib/experiences/reasonAnswers";
import { AGGREGATE_USER_COLUMNS, isAggregatableUser, type AggregateUser } from "@/lib/aggregate/population";
import { MIN_REASON_COUNT } from "@/lib/constants/aggregate";
import {
  JOIN_DECISION_LABELS, JOIN_DECISION_VERSION, isCountableAnswer, promptKind, topReasons,
  type JoinDecisionStatus,
} from "./constants";

/**
 * ★入社の決め手（1問）の読み書きと、会社ごとの上位3つ（2026-11-02）。
 *
 * ⚠️★本人確認は呼び出し側が `requireOwnExperience` で済ませてから呼ぶこと。ここでも user_id で絞る。
 * ⚠️★表 ow_join_decisions / ow_company_reason_rankings は anon / authenticated に権限が無い（service role だけ）。
 * ⚠️ 単位 = その会社に入った職歴1件（同じ会社の職歴のうち、いちばん古い行）。
 * ⚠️★個人の回答は本人にしか返さない。企業・他の利用者に出すのは `getCompanyReasonRanking` の順位だけ（人数を持たない）。
 */

const EXP_COLS =
  "id, user_id, company_id, company_text, company_anonymized, started_at, ended_at, is_current, join_reasons, join_reason_primary, leave_reasons" as const;
const DECISION_COLS = "experience_id, user_id, reasons, choice_version, answered_at, skipped_at, reshown_at" as const;

type DecisionRow = {
  experience_id: string;
  user_id: string;
  reasons: string[] | null;
  choice_version: number;
  answered_at: string | null;
  skipped_at: string | null;
  reshown_at: string | null;
};

function statusOf(d: DecisionRow | null): JoinDecisionStatus {
  if (!d) return "none";
  if (d.answered_at && (d.reasons?.length ?? 0) > 0) return "answered";
  if (d.skipped_at) return "skipped";
  return "none";
}

async function userRows(owUserId: string): Promise<ExpRow[] | null> {
  const { data, error } = await createAdminClient().from("ow_experiences").select(EXP_COLS).eq("user_id", owUserId);
  if (error) { console.error("[joinDecision] experiences:", error.message); return null; }
  return (data ?? []) as ExpRow[];
}

function anchorOf(all: ExpRow[], base: ExpRow): ExpRow {
  const key = companyKey(base);
  return oldest(all.filter((r) => companyKey(r) === key));
}

export type LoadedJoinDecision = {
  anchorId: string;
  status: JoinDecisionStatus;
  reasons: string[];
  /** いま聞いてよいか（first = まだ聞いていない ／ reshow = スキップから30日たった1回だけ） */
  prompt: "first" | "reshow" | null;
};

export async function loadJoinDecision(owUserId: string, base: ExpRow): Promise<LoadedJoinDecision | null> {
  const all = await userRows(owUserId);
  if (!all || all.length === 0) return null;
  const anchor = anchorOf(all, base);
  const { data, error } = await createAdminClient()
    .from("ow_join_decisions").select(DECISION_COLS).eq("experience_id", anchor.id).eq("user_id", owUserId).maybeSingle();
  if (error) { console.error("[joinDecision] load:", error.message); return null; }
  const d = (data as DecisionRow | null) ?? null;
  const status = statusOf(d);
  return {
    anchorId: anchor.id,
    status,
    /* ⚠️ 違う版の回答は今の選択肢に当てはめない（空で始める） */
    reasons: status === "answered" && d?.choice_version === JOIN_DECISION_VERSION ? d.reasons ?? [] : [],
    prompt: promptKind({ status, skippedAt: d?.skipped_at ?? null, reshownAt: d?.reshown_at ?? null }),
  };
}

type WriteResult = { ok: true; anchorId: string } | { ok: false; status: 400 | 500; error: string };

async function upsert(owUserId: string, base: ExpRow, patch: Partial<DecisionRow>, label: string): Promise<WriteResult> {
  const all = await userRows(owUserId);
  if (!all || all.length === 0) return { ok: false, status: 500, error: "取得に失敗しました" };
  const anchor = anchorOf(all, base);
  const r = await mutateOne(
    createAdminClient().from("ow_join_decisions").upsert(
      { experience_id: anchor.id, user_id: owUserId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "experience_id" },
    ),
    label,
    { returning: "experience_id" },
  );
  if (!r.ok) return { ok: false, status: 500, error: r.error };
  return { ok: true, anchorId: anchor.id };
}

/** ★答える。answered_at を必ず入れる（集計の3か月の判定に使う）。答えたらスキップの記録は消す */
export function saveJoinDecision(owUserId: string, base: ExpRow, reasons: string[]): Promise<WriteResult> {
  return upsert(owUserId, base, {
    reasons, choice_version: JOIN_DECISION_VERSION, answered_at: new Date().toISOString(), skipped_at: null,
  }, "join decision 保存");
}

/**
 * ★スキップ。⚠️ 答えてある行には何もしない（回答を消さない）。
 *   再表示（reshow）のあとにもう一度スキップしても、reshown_at は残るので二度目の再表示は無い
 */
export async function skipJoinDecision(owUserId: string, base: ExpRow): Promise<WriteResult> {
  const cur = await loadJoinDecision(owUserId, base);
  if (!cur) return { ok: false, status: 500, error: "取得に失敗しました" };
  if (cur.status === "answered") return { ok: true, anchorId: cur.anchorId };
  return upsert(owUserId, base, { skipped_at: new Date().toISOString() }, "join decision スキップ");
}

/**
 * ★職歴の会社が変わったとき、その職歴に付いた決め手を消す（2026-11-04 / 柴さんの判断 ①）。
 *   決め手は「その会社のいちばん古い職歴の行」に付くので、会社名を変えても行は同じまま残り、
 *   元の会社への回答が新しい会社の回答として扱われていた（設問も出ず、毎月の集計にも入る）。
 *   消すと、新しい会社について次に聞ける（答えていない状態に戻る）。
 *   ⚠️ 元の会社への回答は残さない（会社を記録して残す案 ② は採らなかった）。
 *   ⚠️ 呼ぶのは職歴の更新（PUT /api/jobseeker/experiences/[id]）だけ。会社が変わったかは isSameCompany で見る
 */
export async function clearJoinDecisionForExperience(owUserId: string, experienceId: string): Promise<boolean> {
  const r = await mutateAllowNone(
    createAdminClient().from("ow_join_decisions").delete().eq("experience_id", experienceId).eq("user_id", owUserId),
    "join decision 会社の変更で消す",
    { returning: "experience_id" },
  );
  return r.ok;
}

/** ★スキップから30日後の再表示を出した印。⚠️ 出すのは1回だけ（この印があれば二度と出さない） */
export async function markJoinDecisionReshown(owUserId: string, base: ExpRow): Promise<WriteResult> {
  const cur = await loadJoinDecision(owUserId, base);
  if (!cur) return { ok: false, status: 500, error: "取得に失敗しました" };
  if (cur.prompt !== "reshow") return { ok: true, anchorId: cur.anchorId };
  return upsert(owUserId, base, { reshown_at: new Date().toISOString() }, "join decision 再表示");
}

/**
 * ★ホームで聞くか。現職の会社（在籍中の職歴のうち新しいもの）について、いま聞いてよければ返す。
 *   ⚠️ 失敗・現職なし・聞かなくてよいときは null（ホームはカードを出さない）
 */
export async function currentJoinDecisionPrompt(
  owUserId: string,
): Promise<{ experienceId: string; prompt: "first" | "reshow" } | null> {
  const all = await userRows(owUserId);
  if (!all) return null;
  const current = all.filter((r) => r.is_current).sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  if (!current) return null;
  const loaded = await loadJoinDecision(owUserId, current);
  if (!loaded?.prompt) return null;
  return { experienceId: current.id, prompt: loaded.prompt };
}

/** ★提案の根拠に使う、本人の決め手（今の版で答えたものだけ）。⚠️ 本人の集合として使うだけで、どこにも書き出さない */
export async function joinDecisionReasonsOfUser(owUserId: string): Promise<Set<string>> {
  const { data, error } = await createAdminClient()
    .from("ow_join_decisions").select("reasons, choice_version, answered_at").eq("user_id", owUserId);
  if (error) { console.error("[joinDecision] reasons of user:", error.message); return new Set(); }
  const out = new Set<string>();
  for (const r of (data ?? []) as { reasons: string[] | null; choice_version: number; answered_at: string | null }[]) {
    if (r.answered_at && r.choice_version === JOIN_DECISION_VERSION) (r.reasons ?? []).forEach((x) => out.add(x));
  }
  return out;
}

// ── 会社ごとの上位3つ ─────────────────────────────────────────────────────────

export const COMPANY_REASON_RANKINGS_TAG = "company-reason-rankings";

async function readRankings(companyIds: readonly string[] | null): Promise<Map<string, string[]> | null> {
  let q = createAdminClient().from("ow_company_reason_rankings").select("company_id, rank, reason, choice_version");
  if (companyIds) {
    if (companyIds.length === 0) return new Map();
    q = q.in("company_id", Array.from(new Set(companyIds)));
  }
  const { data, error } = await q.order("rank", { ascending: true });
  if (error) { console.error("[joinDecision] rankings:", error.message); return null; }
  const out = new Map<string, string[]>();
  for (const r of (data ?? []) as { company_id: string; rank: number; reason: string; choice_version: number }[]) {
    if (r.choice_version !== JOIN_DECISION_VERSION) continue;
    const list = out.get(r.company_id) ?? [];
    list.push(r.reason);
    out.set(r.company_id, list);
  }
  return out;
}

/**
 * ★企業ページ用。上位3つのラベル（順位の順）。無ければ null。**人数は返さない。**
 * ⚠️ 中身が変わるのは毎月1日のバッチだけ。バッチが revalidateTag するまでキャッシュを返す
 */
export const getCompanyReasonRanking = (companyId: string) =>
  unstable_cache(async (): Promise<string[] | null> => {
    const m = await readRankings([companyId]);
    const keys = m?.get(companyId);
    return keys && keys.length > 0 ? keys.map((k) => JOIN_DECISION_LABELS[k] ?? k) : null;
  }, ["company-reason-ranking-v1", companyId], { revalidate: 86400, tags: [COMPANY_REASON_RANKINGS_TAG] })();

/** ★提案の根拠用。会社ごとの上位3つのキー（下限に届いた会社だけが入っている） */
export async function companyReasonTop3(companyIds: readonly string[]): Promise<Map<string, string[]>> {
  return (await readRankings(companyIds)) ?? new Map();
}

/**
 * ★毎月1日のバッチの本体。会社ごとに、数えてよい回答が `MIN_REASON_COUNT`（10人）以上なら上位3つを入れ直す。
 *   数えてよい回答 = 今の版で答えた・入社日から3か月以内に答えた・集計の母数に入る人・会社名を出してよい職歴・検証用でない会社
 * ⚠️ answered_at が無い回答（旧の決め手の写しなど）は数えない。部門・職種・経歴とは掛け合わせない
 * ⚠️ 呼び出し側は no-store のクライアントを渡すこと（cron。fetch キャッシュに載ると何もしないまま 200 になる）
 */
export async function rebuildCompanyReasonRankings(
  db: ReturnType<typeof createAdminClient>,
  now: Date = new Date(),
): Promise<{ ok: true; companies: number; rows: number } | { ok: false; error: string }> {
  const { data, error } = await db
    .from("ow_join_decisions")
    .select(`user_id, reasons, choice_version, answered_at, ow_experiences!experience_id(company_id, started_at, visibility_company, ow_companies!company_id(is_test)), ow_users!user_id(${AGGREGATE_USER_COLUMNS}, email)`)
    .not("answered_at", "is", null);
  if (error) return { ok: false, error: error.message };

  const byCompany = new Map<string, Map<string, string[]>>();
  type Row = {
    user_id: string; reasons: string[] | null; choice_version: number; answered_at: string | null;
    ow_experiences: { company_id: string | null; started_at: string | null; visibility_company: string | null; ow_companies: { is_test: boolean | null } | null } | null;
    ow_users: AggregateUser | null;
  };
  for (const r of (data ?? []) as unknown as Row[]) {
    const e = r.ow_experiences;
    if (!e?.company_id || e.visibility_company !== "real" || e.ow_companies?.is_test !== false) continue;
    if (r.choice_version !== JOIN_DECISION_VERSION || (r.reasons?.length ?? 0) === 0) continue;
    if (!isAggregatableUser(r.ow_users)) continue;
    if (!isCountableAnswer(r.answered_at, e.started_at)) continue;
    const m = byCompany.get(e.company_id) ?? new Map<string, string[]>();
    m.set(r.user_id, r.reasons ?? []);
    byCompany.set(e.company_id, m);
  }

  const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const rows: { company_id: string; rank: number; reason: string; choice_version: number; period: string }[] = [];
  byCompany.forEach((users, companyId) => {
    const top = topReasons(Array.from(users.values()), MIN_REASON_COUNT);
    top?.forEach((reason, i) => rows.push({ company_id: companyId, rank: i + 1, reason, choice_version: JOIN_DECISION_VERSION, period }));
  });

  /* ★入れ直す。⚠️ 先月は出ていたが今月は下限を割った会社も消える（＝出さない）。
        ⚠️ safeupdate のため WHERE を必ず付ける（全行が対象なので常に真の条件） */
  const del = await db.from("ow_company_reason_rankings").delete().gte("rank", 1);
  if (del.error) return { ok: false, error: del.error.message };
  if (rows.length > 0) {
    const ins = await db.from("ow_company_reason_rankings").insert(rows);
    if (ins.error) return { ok: false, error: ins.error.message };
  }
  return { ok: true, companies: new Set(rows.map((r) => r.company_id)).size, rows: rows.length };
}
