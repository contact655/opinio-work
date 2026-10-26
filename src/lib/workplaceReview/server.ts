import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateAllowNone, mutateOne } from "@/lib/supabase/mutate";
import { companyDisplayName } from "@/lib/companies/displayName";
import { companyKey, companyRows, hasLeft, oldest, type ExpRow } from "@/lib/experiences/reasonAnswers";
import { VALID_LEAVE_REASONS } from "@/lib/constants/careerReasons";
import {
  EMPTY_ANSWERS,
  FACT_ITEMS,
  GAP_ITEMS,
  type ReviewAxis,
  type ReviewFitTag,
  type ReviewStatus,
  type WorkplaceReviewAnswers,
} from "./constants";
import { computeTendency, type Tendency, type TendencyReview } from "./tendency";

/**
 * ★入社後レビューの読み書き（2026-10-16）。API はここだけを呼ぶ。
 *
 * ⚠️★本人確認は呼び出し側が `requireOwnExperience`（lib/experiences/reasonAnswers.ts）で済ませてから呼ぶこと。
 *    書き込みは service role（admin）。表の RLS は本人だけに開いてあるが、アプリはそれに頼らない形にしてある。
 * ⚠️★回答の単位は会社。保存先 = その会社の行のうちレビューのある行。無ければいちばん古い行。
 * ⚠️ 旧形式（ow_experience_reviews ほか・ow_experiences.join_reasons ほか）には書かない・読まない。
 */

type ReviewRow = {
  id: string;
  experience_id: string;
  fit_score: number;
  gap_job: number; gap_pay: number; gap_growth: number; gap_culture: number;
  overtime: number | null; office: number | null; english: number | null;
  memo: string | null;
  status: ReviewStatus;
  updated_at: string;
};
const REVIEW_COLS =
  "id, experience_id, fit_score, gap_job, gap_pay, gap_growth, gap_culture, overtime, office, english, memo, status, updated_at" as const;

export type ReviewMasters = { axes: ReviewAxis[]; tags: ReviewFitTag[] };

export async function loadMasters(): Promise<ReviewMasters | null> {
  const admin = createAdminClient();
  const [ax, tg] = await Promise.all([
    admin.from("ow_review_axes").select("key, name, left_text, right_text, left_headline_join, left_headline_end, right_headline_join, right_headline_end").eq("is_active", true).order("display_order"),
    admin.from("ow_review_fit_tags").select("key, label").eq("is_active", true).order("display_order"),
  ]);
  if (ax.error || tg.error) {
    console.error("[workplaceReview] masters:", ax.error?.message ?? tg.error?.message);
    return null;
  }
  return {
    axes: ((ax.data ?? []) as Record<string, string>[]).map((r) => ({
      key: r.key, name: r.name, leftText: r.left_text, rightText: r.right_text,
      leftHeadlineJoin: r.left_headline_join, leftHeadlineEnd: r.left_headline_end,
      rightHeadlineJoin: r.right_headline_join, rightHeadlineEnd: r.right_headline_end,
    })),
    tags: ((tg.data ?? []) as { key: string; label: string }[]).map((r) => ({ key: r.key, label: r.label })),
  };
}

/** 保存先の行と、その行のレビュー（無ければ null） */
async function resolve(owUserId: string, base: ExpRow): Promise<{ anchor: ExpRow; rows: ExpRow[]; review: ReviewRow | null } | null> {
  const rows = await companyRows(owUserId, base);
  if (!rows || rows.length === 0) return null;
  const { data, error } = await createAdminClient()
    .from("ow_workplace_reviews").select(REVIEW_COLS).in("experience_id", rows.map((r) => r.id));
  if (error) { console.error("[workplaceReview] reviews:", error.message); return null; }
  const review = ((data ?? []) as ReviewRow[])[0] ?? null;
  const anchor = review ? rows.find((r) => r.id === review.experience_id)! : oldest(rows);
  return { anchor, rows, review };
}

/**
 * ★離れた理由（以前の質問のまま）。読むのは①以前の保存先 ow_experience_leave_reasons（会社の行のどれか）、
 *   無ければ旧の列 ow_experiences.leave_reasons（会社の行のどれか）。⚠️ 旧の列には書かない。
 */
async function loadLeaveReasons(rows: ExpRow[]): Promise<string[] | null> {
  const { data, error } = await createAdminClient()
    .from("ow_experience_leave_reasons").select("experience_id, reason, created_at")
    .in("experience_id", rows.map((r) => r.id)).order("created_at");
  if (error) { console.error("[workplaceReview] leave reasons:", error.message); return null; }
  const list = (data ?? []) as { experience_id: string; reason: string }[];
  if (list.length > 0) {
    const first = list[0].experience_id;
    return list.filter((x) => x.experience_id === first).map((x) => x.reason).filter((v) => VALID_LEAVE_REASONS.has(v));
  }
  const legacy = rows.find((r) => (r.leave_reasons?.length ?? 0) > 0);
  return (legacy?.leave_reasons ?? []).filter((v) => VALID_LEAVE_REASONS.has(v));
}

export type LoadedReview = {
  anchorId: string;
  /** ★この会社について、何か回答が残っているか（入社後レビュー・旧形式の決め手・退職理由・ギャップ）。削除ボタンを出すかに使う */
  hasStoredAnswers: boolean;
  /** 終了した会社か（「離れた理由」を出すか） */
  canLeave: boolean;
  status: ReviewStatus | null;
  answers: WorkplaceReviewAnswers;
  masters: ReviewMasters;
};

export async function loadReview(owUserId: string, base: ExpRow): Promise<LoadedReview | null> {
  const [r, masters] = await Promise.all([resolve(owUserId, base), loadMasters()]);
  if (!r || !masters) return null;
  const canLeave = hasLeft(r.rows);
  const leaveReasons = canLeave ? await loadLeaveReasons(r.rows) : [];
  if (leaveReasons === null) return null;
  const stored = await hasStoredAnswers(r.rows, !!r.review);
  if (stored === null) return null;
  if (!r.review) return { anchorId: r.anchor.id, hasStoredAnswers: stored, canLeave, status: null, answers: { ...EMPTY_ANSWERS, leaveReasons }, masters };

  const admin = createAdminClient();
  const [ax, tg] = await Promise.all([
    admin.from("ow_workplace_review_axes").select("axis_key, value").eq("review_id", r.review.id),
    admin.from("ow_workplace_review_tags").select("tag_key").eq("review_id", r.review.id),
  ]);
  if (ax.error || tg.error) {
    console.error("[workplaceReview] load children:", ax.error?.message ?? tg.error?.message);
    return null;
  }
  const v = r.review;
  return {
    anchorId: r.anchor.id,
    hasStoredAnswers: stored,
    canLeave,
    status: v.status,
    masters,
    answers: {
      fitScore: v.fit_score,
      gaps: { gap_job: v.gap_job, gap_pay: v.gap_pay, gap_growth: v.gap_growth, gap_culture: v.gap_culture },
      axes: Object.fromEntries(((ax.data ?? []) as { axis_key: string; value: number }[]).map((x) => [x.axis_key, x.value])),
      facts: { overtime: v.overtime, office: v.office, english: v.english },
      tags: ((tg.data ?? []) as { tag_key: string }[]).map((x) => x.tag_key),
      memo: v.memo ?? "",
      leaveReasons,
    },
  };
}

/**
 * 保存する。`complete` は③の「保存する」から来たとき。⚠️ 一度 complete になった回答は required_done に戻さない。
 * ⚠️ 軸・タグはマスタにある有効な key だけを受ける（無ければ 400 相当のメッセージを返す）。
 */
export async function saveReview(
  owUserId: string,
  base: ExpRow,
  a: WorkplaceReviewAnswers,
  complete: boolean,
): Promise<{ ok: true; anchorId: string; status: ReviewStatus } | { ok: false; status: 400 | 500; error: string }> {
  const [r, masters] = await Promise.all([resolve(owUserId, base), loadMasters()]);
  if (!r || !masters) return { ok: false, status: 500, error: "保存に失敗しました。もう一度お試しください。" };
  const axisKeys = new Set(masters.axes.map((x) => x.key));
  const tagKeys = new Set(masters.tags.map((x) => x.key));
  if (Object.keys(a.axes).some((k) => !axisKeys.has(k))) return { ok: false, status: 400, error: "「どちら寄りか」の回答が不正です。" };
  if (a.tags.some((k) => !tagKeys.has(k))) return { ok: false, status: 400, error: "「合う人」の回答が不正です。" };
  if (a.leaveReasons.some((k) => !VALID_LEAVE_REASONS.has(k))) return { ok: false, status: 400, error: "離れた理由の回答が不正です。" };
  const canLeave = hasLeft(r.rows);
  if (a.leaveReasons.length > 0 && !canLeave) return { ok: false, status: 400, error: "離れた理由は、終了した職歴にだけ答えられます。" };

  const admin = createAdminClient();
  const status: ReviewStatus = complete || r.review?.status === "complete" ? "complete" : "required_done";
  const row = {
    user_id: owUserId,
    experience_id: r.anchor.id,
    company_id: r.anchor.company_id,
    fit_score: a.fitScore,
    ...Object.fromEntries(GAP_ITEMS.map((g) => [g.key, a.gaps[g.key]])),
    ...Object.fromEntries(FACT_ITEMS.map((f) => [f.key, a.facts[f.key]])),
    memo: a.memo.trim() === "" ? null : a.memo.trim(),
    status,
    updated_at: new Date().toISOString(),
  };
  const up = await mutateOne(
    admin.from("ow_workplace_reviews").upsert(row, { onConflict: "experience_id" }),
    "workplace review 保存", { returning: "id" },
  );
  if (!up.ok) return { ok: false, status: 500, error: "保存に失敗しました。もう一度お試しください。" };
  const { data: idRow, error: idErr } = await admin
    .from("ow_workplace_reviews").select("id").eq("experience_id", r.anchor.id).eq("user_id", owUserId).maybeSingle();
  if (idErr || !idRow) {
    console.error("[workplaceReview] review id:", idErr?.message ?? "not found");
    return { ok: false, status: 500, error: "保存に失敗しました。もう一度お試しください。" };
  }
  const reviewId = idRow.id as string;

  /* 子の2表は入れ替え。⚠️ 消してから入れる。入れる前に失敗したら、その旨を返す（黙って成功にしない） */
  let m = await mutateAllowNone(admin.from("ow_workplace_review_axes").delete().eq("review_id", reviewId), "workplace review 軸の掃除", { returning: "axis_key" });
  if (!m.ok) return { ok: false, status: 500, error: "「どちら寄りか」の保存に失敗しました。" };
  const axes = Object.entries(a.axes);
  if (axes.length > 0) {
    m = await mutateAllowNone(admin.from("ow_workplace_review_axes").insert(axes.map(([axis_key, value]) => ({ review_id: reviewId, axis_key, value }))), "workplace review 軸", { returning: "axis_key" });
    if (!m.ok) return { ok: false, status: 500, error: "「どちら寄りか」の保存に失敗しました。" };
  }
  m = await mutateAllowNone(admin.from("ow_workplace_review_tags").delete().eq("review_id", reviewId), "workplace review タグの掃除", { returning: "tag_key" });
  if (!m.ok) return { ok: false, status: 500, error: "「合う人」の保存に失敗しました。" };
  if (a.tags.length > 0) {
    m = await mutateAllowNone(admin.from("ow_workplace_review_tags").insert(a.tags.map((tag_key) => ({ review_id: reviewId, tag_key }))), "workplace review タグ", { returning: "tag_key" });
    if (!m.ok) return { ok: false, status: 500, error: "「合う人」の保存に失敗しました。" };
  }

  /* 離れた理由（以前の保存先のまま・保存先の行に置く）。⚠️ 在籍中の会社では触らない（以前の回答を消さない） */
  if (canLeave) {
    m = await mutateAllowNone(admin.from("ow_experience_leave_reasons").delete().in("experience_id", r.rows.map((x) => x.id)), "離れた理由の掃除", { returning: "reason" });
    if (!m.ok) return { ok: false, status: 500, error: "離れた理由の保存に失敗しました。" };
    if (a.leaveReasons.length > 0) {
      const t0 = Date.now();
      m = await mutateAllowNone(admin.from("ow_experience_leave_reasons").insert(
        a.leaveReasons.map((reason, i) => ({ experience_id: r.anchor.id, reason, created_at: new Date(t0 + i).toISOString() })),
      ), "離れた理由", { returning: "reason" });
      if (!m.ok) return { ok: false, status: 500, error: "離れた理由の保存に失敗しました。" };
    }
  }
  return { ok: true, anchorId: r.anchor.id, status };
}

/**
 * ④ 本人の傾向。⚠️★本人のレビューだけを読む（user_id で絞る）。他人・他社の回答は使わない。
 */
export async function loadTendency(owUserId: string): Promise<Tendency | null> {
  const admin = createAdminClient();
  const [masters, revs] = await Promise.all([
    loadMasters(),
    admin.from("ow_workplace_reviews").select("id, experience_id, fit_score, updated_at").eq("user_id", owUserId),
  ]);
  if (!masters || revs.error) { if (revs.error) console.error("[workplaceReview] tendency:", revs.error.message); return null; }
  const list = (revs.data ?? []) as { id: string; experience_id: string; fit_score: number; updated_at: string }[];
  if (list.length === 0) return computeTendency([], masters.axes);

  const [ax, exps] = await Promise.all([
    admin.from("ow_workplace_review_axes").select("review_id, axis_key, value").in("review_id", list.map((x) => x.id)),
    admin.from("ow_experiences")
      .select("id, company_text, ow_companies!company_id(name, name_en)")
      .eq("user_id", owUserId).in("id", list.map((x) => x.experience_id)),
  ]);
  if (ax.error || exps.error) { console.error("[workplaceReview] tendency children:", ax.error?.message ?? exps.error?.message); return null; }
  const nameById = new Map(((exps.data ?? []) as unknown as { id: string; company_text: string | null; ow_companies: { name: string; name_en: string | null } | null }[])
    .map((e) => [e.id, e.ow_companies ? companyDisplayName(e.ow_companies.name, e.ow_companies.name_en).displayName : (e.company_text ?? "")]));
  const axesByReview = new Map<string, Record<string, number>>();
  for (const x of (ax.data ?? []) as { review_id: string; axis_key: string; value: number }[]) {
    const m = axesByReview.get(x.review_id) ?? {};
    m[x.axis_key] = x.value;
    axesByReview.set(x.review_id, m);
  }
  const reviews: TendencyReview[] = list.map((x) => ({
    experienceId: x.experience_id,
    companyName: nameById.get(x.experience_id) ?? "",
    fitScore: x.fit_score,
    axes: axesByReview.get(x.id) ?? {},
    updatedAt: x.updated_at,
  }));
  return computeTendency(reviews, masters.axes);
}

/** 会社ごとにレビューがあるか（行の印用）。experience_id → true。同じ会社の行すべてに付ける */
export async function reviewedExperienceIds(owUserId: string, rows: ExpRow[]): Promise<Set<string> | null> {
  const { data, error } = await createAdminClient()
    .from("ow_workplace_reviews").select("experience_id").eq("user_id", owUserId);
  if (error) { console.error("[workplaceReview] reviewed ids:", error.message); return null; }
  const reviewedRows = new Set(((data ?? []) as { experience_id: string }[]).map((x) => x.experience_id));
  const companies = new Set(rows.filter((r) => reviewedRows.has(r.id)).map((r) => companyKey(r)));
  return new Set(rows.filter((r) => companies.has(companyKey(r))).map((r) => r.id));
}


/**
 * ★この会社について回答が残っているか（2026-10-26 / フェーズ1a-4）。null は取得失敗。
 *   旧形式（決め手・退職理由の列、ギャップ、v2 の表）も含める。どれか1つでも残っていれば削除の操作を出す。
 */
async function hasStoredAnswers(rows: ExpRow[], hasReview: boolean): Promise<boolean | null> {
  if (hasReview) return true;
  if (rows.some((r) => (r.join_reasons?.length ?? 0) > 0 || (r.leave_reasons?.length ?? 0) > 0 || !!r.join_reason_primary)) return true;
  const ids = rows.map((r) => r.id);
  const admin = createAdminClient();
  const results = await Promise.all(ANSWER_TABLES.map((t) =>
    admin.from(t).select("experience_id", { count: "exact", head: true }).in("experience_id", ids)));
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    if (res.error) { console.error(`[workplaceReview] hasStoredAnswers ${ANSWER_TABLES[i]}:`, res.error.message); return null; }
    if ((res.count ?? 0) > 0) return true;
  }
  return false;
}

/** ★職歴にぶら下がる「回答」の表（入社後レビュー以外）。⚠️ ow_reason_modal_closes（閉じた記録）は回答ではないので入れない */
const ANSWER_TABLES = [
  /* ★転機の3問（2026-10-27 / フェーズ1c）。⚠️ 消すと次回以降の集計・合う会社の並びから外れる */
  "ow_career_turns",
  "ow_experience_leave_reasons",
  "ow_experience_gaps",
  "ow_experience_reviews",
  "ow_experience_expectations",
  "ow_experience_gap_shifts",
  "ow_experience_notes",
] as const;

/**
 * ★本人が、この会社についての回答をすべて消す（2026-10-26 / フェーズ1a-4）。
 *
 * 消すもの（同じ会社の職歴すべてについて）:
 *   - 転機の3問（ow_career_turns。2026-10-27〜）
 *   - 入社後レビュー（ow_workplace_reviews。軸とタグは FK の CASCADE で一緒に消える）
 *   - 退職理由（ow_experience_leave_reasons）・期待とのギャップ（ow_experience_gaps）
 *   - 旧 v2 の表（ow_experience_reviews / _expectations / _gap_shifts / _notes）
 *   - 職歴の行の列（join_reasons / join_reason_primary / join_reason / leave_reasons）を null に
 *
 * ⚠️ 消したものは集計（提案の根拠など）から次回以降外れる。集計は保存しておらず、毎回 ow_experiences から作るため。
 *    ow_transitions（遷移）は職歴の会社と期間だけで作り、回答は使っていない。
 * ⚠️ 職歴そのもの（会社・期間・職種）は消さない。
 * ⚠️ 本人確認は呼び出し側（requireOwnExperience）。ここでも user_id で絞る。
 */
export async function deleteCompanyAnswers(owUserId: string, base: ExpRow): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = await companyRows(owUserId, base);
  if (!rows || rows.length === 0) return { ok: false, error: "職歴を確認できませんでした" };
  const ids = rows.map((r) => r.id);
  const admin = createAdminClient();

  const del = await mutateAllowNone(
    admin.from("ow_workplace_reviews").delete().eq("user_id", owUserId).in("experience_id", ids),
    "workplace review delete",
  );
  if (!del.ok) return { ok: false, error: del.error };
  for (const t of ANSWER_TABLES) {
    const r = await mutateAllowNone(admin.from(t).delete().in("experience_id", ids), `answers delete ${t}`, { returning: "experience_id" });
    if (!r.ok) return { ok: false, error: r.error };
  }
  const upd = await mutateAllowNone(
    admin.from("ow_experiences")
      .update({ join_reasons: null, join_reason_primary: null, join_reason: null, leave_reasons: null })
      .eq("user_id", owUserId).in("id", ids),
    "experience reason columns clear",
  );
  if (!upd.ok) return { ok: false, error: upd.error };
  return { ok: true };
}

/**
 * ★この会社について、何か回答が残っているか（転機の3問・入社後レビュー・旧形式すべて。2026-10-27）。
 *   転機の3問のモーダルが削除の操作を出すかに使う。null は取得失敗。
 */
export async function companyHasStoredAnswers(owUserId: string, base: ExpRow): Promise<boolean | null> {
  const rows = await companyRows(owUserId, base);
  if (!rows || rows.length === 0) return null;
  const { count, error } = await createAdminClient()
    .from("ow_workplace_reviews").select("experience_id", { count: "exact", head: true })
    .eq("user_id", owUserId).in("experience_id", rows.map((r) => r.id));
  if (error) { console.error("[workplaceReview] companyHasStoredAnswers:", error.message); return null; }
  return hasStoredAnswers(rows, (count ?? 0) > 0);
}
