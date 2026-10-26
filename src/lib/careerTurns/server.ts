import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateAllowNone, mutateOne } from "@/lib/supabase/mutate";
import { companyDisplayName } from "@/lib/companies/displayName";
import { companyKey, oldest, type ExpRow } from "@/lib/experiences/reasonAnswers";
import {
  DECISIVE_REASON_LABELS, NEXT_PRIORITY_LABELS, FIT_GOOD_MIN, FIT_BAD_MAX,
  canAskFitAfterYear, hasAnyAnswer, type CareerTurnAnswers,
} from "./constants";
import { buildCareerTurnTendency, type TendencyTurn } from "./tendency";
import { companyHasStoredAnswers, loadMasters, type ReviewMasters } from "@/lib/workplaceReview/server";
import { EMPTY_TURN_DETAIL, type CareerTurnDetail } from "./detail";

/**
 * ★転機の3問の読み書き（2026-10-27 / フェーズ1c）。API（/api/jobseeker/experiences/[id]/turn）はここだけを呼ぶ。
 *
 * ⚠️★本人確認は呼び出し側が `requireOwnExperience` で済ませてから呼ぶこと。ここでも user_id で絞る。
 * ⚠️★表 ow_career_turns は anon / authenticated に権限が無い（service role だけ）。セッションのクライアントで読まない。
 * ⚠️ 転機の単位 = その会社に入った職歴1件（同じ会社の職歴のうち、いちばん古い行）。
 * ⚠️ 入社後レビュー（ow_workplace_reviews）には書かない。旧の列（join_reasons ほか）にも書かない。
 */

const TURN_COLS = "experience_id, user_id, decisive_reasons, next_priority, fit_after_year, fit_answered_at, skipped_at, answered_at, copied_from_legacy_at, detail_overtime, detail_office, detail_english, detail_memo" as const;
const EXP_COLS =
  "id, user_id, company_id, company_text, company_anonymized, started_at, ended_at, is_current, join_reasons, join_reason_primary, leave_reasons" as const;

type TurnRow = {
  experience_id: string;
  user_id: string;
  decisive_reasons: string[] | null;
  next_priority: string | null;
  fit_after_year: number | null;
  fit_answered_at: string | null;
  skipped_at: string | null;
  answered_at: string | null;
  copied_from_legacy_at: string | null;
  detail_overtime: number | null;
  detail_office: number | null;
  detail_english: number | null;
  detail_memo: string | null;
};

/** answered … 新しい画面で答えた ／ skipped … 「この転機は答えない」 ／ legacy … 旧の決め手を写しただけ ／ none … 未回答 */
export type TurnStatus = "answered" | "skipped" | "legacy" | "none";

function statusOf(t: TurnRow | null | undefined): TurnStatus {
  if (!t) return "none";
  if (t.skipped_at) return "skipped";
  if (t.answered_at) return "answered";
  if (t.copied_from_legacy_at || (t.decisive_reasons?.length ?? 0) > 0) return "legacy";
  return "none";
}

async function userRows(owUserId: string): Promise<ExpRow[] | null> {
  const { data, error } = await createAdminClient().from("ow_experiences").select(EXP_COLS).eq("user_id", owUserId);
  if (error) { console.error("[careerTurns] experiences:", error.message); return null; }
  return (data ?? []) as ExpRow[];
}

/** この職歴が属する転機（= その会社のいちばん古い行）と、本人の最初の転機か */
function resolveAnchor(all: ExpRow[], base: ExpRow): { anchor: ExpRow; isFirst: boolean } {
  const key = companyKey(base);
  const anchor = oldest(all.filter((r) => companyKey(r) === key));
  const first = oldest(all);
  return { anchor, isFirst: companyKey(first) === key };
}

export type LoadedTurn = {
  anchorId: string;
  isFirst: boolean;
  /** 入社月から12か月たっているか（Q3 を出すか） */
  canAskFit: boolean;
  status: TurnStatus;
  answers: CareerTurnAnswers;
  /** この会社について何か回答が残っているか（3問・以前の質問すべて）。削除の操作を出すか */
  hasStoredAnswers: boolean;
  /** ★任意の段「もう少し詳しく」の回答（2026-10-27） */
  detail: CareerTurnDetail;
  /** 任意の段の軸のマスタ（入社後レビューと同じ ow_review_axes） */
  axes: ReviewMasters["axes"];
};

export async function loadTurn(owUserId: string, base: ExpRow): Promise<LoadedTurn | null> {
  const all = await userRows(owUserId);
  if (!all || all.length === 0) return null;
  const { anchor, isFirst } = resolveAnchor(all, base);
  const { data, error } = await createAdminClient()
    .from("ow_career_turns").select(TURN_COLS).eq("experience_id", anchor.id).eq("user_id", owUserId).maybeSingle();
  if (error) { console.error("[careerTurns] load:", error.message); return null; }
  const t = (data as TurnRow | null) ?? null;
  const canAskFit = canAskFitAfterYear(anchor.started_at);
  const [stored, masters, axRes] = await Promise.all([
    companyHasStoredAnswers(owUserId, base),
    loadMasters(),
    createAdminClient().from("ow_career_turn_axes").select("axis_key, value").eq("experience_id", anchor.id),
  ]);
  if (stored === null || !masters) return null;
  if (axRes.error) { console.error("[careerTurns] load axes:", axRes.error.message); return null; }
  const detail: CareerTurnDetail = t && !t.skipped_at
    ? {
        axes: Object.fromEntries(((axRes.data ?? []) as { axis_key: string; value: number }[]).map((x) => [x.axis_key, x.value])),
        facts: { overtime: t.detail_overtime, office: t.detail_office, english: t.detail_english },
        memo: t.detail_memo ?? "",
      }
    : EMPTY_TURN_DETAIL;
  return {
    hasStoredAnswers: stored,
    detail,
    axes: masters.axes,
    anchorId: anchor.id,
    isFirst,
    canAskFit,
    status: statusOf(t),
    answers: t && !t.skipped_at
      ? { decisiveReasons: t.decisive_reasons ?? [], nextPriority: t.next_priority, fitAfterYear: canAskFit ? t.fit_after_year : null }
      : { decisiveReasons: [], nextPriority: null, fitAfterYear: null },
  };
}

type SaveResult = { ok: true; anchorId: string } | { ok: false; status: 400 | 500; error: string };

/** 3問を保存する。⚠️ 1つも答えていなければ 400（「この転機は答えない」は skipTurn） */
export async function saveTurn(owUserId: string, base: ExpRow, a: CareerTurnAnswers): Promise<SaveResult> {
  if (!hasAnyAnswer(a)) return { ok: false, status: 400, error: "1つ以上答えてください。答えない場合は「この転機は答えない」を選んでください。" };
  const all = await userRows(owUserId);
  if (!all || all.length === 0) return { ok: false, status: 500, error: "保存に失敗しました。もう一度お試しください。" };
  const { anchor } = resolveAnchor(all, base);
  if (a.fitAfterYear !== null && !canAskFitAfterYear(anchor.started_at)) {
    return { ok: false, status: 400, error: "入社から1年たっていない職歴には、合っていたかは答えられません。" };
  }
  const admin = createAdminClient();
  const { data: prev, error: pErr } = await admin
    .from("ow_career_turns").select(TURN_COLS).eq("experience_id", anchor.id).eq("user_id", owUserId).maybeSingle();
  if (pErr) { console.error("[careerTurns] prev:", pErr.message); return { ok: false, status: 500, error: "保存に失敗しました。もう一度お試しください。" }; }
  const p = prev as TurnRow | null;
  const now = new Date().toISOString();
  /* ★Q3 の日付は値が変わったときだけ更新する（同じ値で保存し直しても、答えた時点は動かさない） */
  const fitAnsweredAt = a.fitAfterYear === null ? null : (p && p.fit_after_year === a.fitAfterYear && p.fit_answered_at ? p.fit_answered_at : now);
  const up = await mutateOne(
    admin.from("ow_career_turns").upsert({
      experience_id: anchor.id,
      user_id: owUserId,
      decisive_reasons: a.decisiveReasons.length > 0 ? a.decisiveReasons : null,
      next_priority: a.nextPriority,
      fit_after_year: a.fitAfterYear,
      fit_answered_at: fitAnsweredAt,
      skipped_at: null,
      answered_at: now,
      updated_at: now,
    }, { onConflict: "experience_id" }),
    "career turn 保存", { returning: "experience_id" },
  );
  if (!up.ok) return { ok: false, status: 500, error: "保存に失敗しました。もう一度お試しください。" };
  return { ok: true, anchorId: anchor.id };
}

/** 「この転機は答えない」。⚠️ 回答は消す（答えないと選んだので残さない）。あとで答えれば skipped_at は null に戻る */
export async function skipTurn(owUserId: string, base: ExpRow): Promise<SaveResult> {
  const all = await userRows(owUserId);
  if (!all || all.length === 0) return { ok: false, status: 500, error: "保存に失敗しました。もう一度お試しください。" };
  const { anchor } = resolveAnchor(all, base);
  const now = new Date().toISOString();
  const up = await mutateOne(
    createAdminClient().from("ow_career_turns").upsert({
      experience_id: anchor.id, user_id: owUserId,
      decisive_reasons: null, next_priority: null, fit_after_year: null, fit_answered_at: null,
      detail_overtime: null, detail_office: null, detail_english: null, detail_memo: null,
      skipped_at: now, answered_at: null, updated_at: now,
    }, { onConflict: "experience_id" }),
    "career turn スキップ", { returning: "experience_id" },
  );
  if (!up.ok) return { ok: false, status: 500, error: "保存に失敗しました。もう一度お試しください。" };
  /* 任意の段の軸も消す（答えないと選んだので残さない） */
  const ax = await mutateAllowNone(createAdminClient().from("ow_career_turn_axes").delete().eq("experience_id", anchor.id), "career turn 軸の掃除", { returning: "axis_key" });
  if (!ax.ok) return { ok: false, status: 500, error: "保存に失敗しました。もう一度お試しください。" };
  return { ok: true, anchorId: anchor.id };
}

/**
 * ★本人の回答だけから「あなたが合う職場の傾向」の文を作る。⚠️ 他人の回答・AI は使わない（tendency.ts）。
 *   null は取得失敗（画面は傾向の部分だけ出さない）。
 */
export async function loadTurnTendency(owUserId: string): Promise<string[] | null> {
  const admin = createAdminClient();
  const [turns, all] = await Promise.all([
    admin.from("ow_career_turns").select(TURN_COLS).eq("user_id", owUserId),
    admin.from("ow_experiences").select("id, started_at, company_id, company_text, company_anonymized, ow_companies!company_id(name, name_en)").eq("user_id", owUserId),
  ]);
  if (turns.error || all.error) { console.error("[careerTurns] tendency:", turns.error?.message ?? all.error?.message); return null; }
  const exps = (all.data ?? []) as unknown as { id: string; started_at: string; company_id: string | null; company_text: string | null; company_anonymized: string | null; ow_companies: { name: string; name_en: string | null } | null }[];
  if (exps.length === 0) return [];
  const byId = new Map(exps.map((e) => [e.id, e]));
  const firstId = exps.slice().sort((a, b) => a.started_at.localeCompare(b.started_at) || a.id.localeCompare(b.id))[0].id;
  const list: (TendencyTurn & { startedAt: string })[] = [];
  for (const t of (turns.data ?? []) as TurnRow[]) {
    if (t.skipped_at) continue;
    const e = byId.get(t.experience_id);
    if (!e) continue;
    const name = e.ow_companies ? companyDisplayName(e.ow_companies.name, e.ow_companies.name_en).displayName : (e.company_text ?? e.company_anonymized ?? "この会社");
    list.push({
      companyName: name, isFirst: companyKey(e) === companyKey(byId.get(firstId)!), startedAt: e.started_at,
      decisiveReasons: t.decisive_reasons ?? [], nextPriority: t.next_priority, fitAfterYear: t.fit_after_year,
    });
  }
  list.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return buildCareerTurnTendency(list, {
    reason: (k) => DECISIVE_REASON_LABELS[k] ?? k,
    priority: (k) => NEXT_PRIORITY_LABELS[k] ?? k,
    goodMin: FIT_GOOD_MIN, badMax: FIT_BAD_MAX,
  });
}

/**
 * ★任意の段「もう少し詳しく」を保存する（2026-10-27）。⚠️ 3問を保存した転機にだけ（答えない・未回答の転機には 400）。
 *   軸は入れ替え（消してから入れる）。⚠️ 3問の回答には触らない（任意の段を飛ばしても3問は残る）。
 */
export async function saveTurnDetail(owUserId: string, base: ExpRow, d: CareerTurnDetail): Promise<SaveResult> {
  const all = await userRows(owUserId);
  if (!all || all.length === 0) return { ok: false, status: 500, error: "保存に失敗しました。もう一度お試しください。" };
  const { anchor } = resolveAnchor(all, base);
  const admin = createAdminClient();
  const { data: cur, error: cErr } = await admin.from("ow_career_turns").select("answered_at, skipped_at").eq("experience_id", anchor.id).eq("user_id", owUserId).maybeSingle();
  if (cErr) { console.error("[careerTurns] detail cur:", cErr.message); return { ok: false, status: 500, error: "保存に失敗しました。もう一度お試しください。" }; }
  if (!cur || !cur.answered_at || cur.skipped_at) return { ok: false, status: 400, error: "先に3つの質問に答えてください。" };
  const up = await mutateOne(
    admin.from("ow_career_turns").update({
      detail_overtime: d.facts.overtime, detail_office: d.facts.office, detail_english: d.facts.english,
      detail_memo: d.memo.trim() === "" ? null : d.memo.trim(),
      updated_at: new Date().toISOString(),
    }).eq("experience_id", anchor.id).eq("user_id", owUserId),
    "career turn 任意の段", { returning: "experience_id" },
  );
  if (!up.ok) return { ok: false, status: 500, error: "保存に失敗しました。もう一度お試しください。" };
  let m = await mutateAllowNone(admin.from("ow_career_turn_axes").delete().eq("experience_id", anchor.id), "career turn 軸の掃除", { returning: "axis_key" });
  if (!m.ok) return { ok: false, status: 500, error: "「どちら寄りか」の保存に失敗しました。" };
  const axes = Object.entries(d.axes);
  if (axes.length > 0) {
    m = await mutateAllowNone(admin.from("ow_career_turn_axes").insert(axes.map(([axis_key, value]) => ({ experience_id: anchor.id, axis_key, value }))), "career turn 軸", { returning: "axis_key" });
    if (!m.ok) return { ok: false, status: 500, error: "「どちら寄りか」の保存に失敗しました。" };
  }
  return { ok: true, anchorId: anchor.id };
}

/** 任意の段の検証に使う、有効な軸のキー。null は取得失敗 */
export async function activeAxisKeys(): Promise<Set<string> | null> {
  const m = await loadMasters();
  return m ? new Set(m.axes.map((a) => a.key)) : null;
}
