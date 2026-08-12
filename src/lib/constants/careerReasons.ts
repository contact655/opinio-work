/**
 * 経歴の「理由データ」と「勤務地」の選択肢。**クライアントと API の両方がここを見る。**
 *
 * ── なぜ1箇所に集めるか ─────────────────────────────────────────────────────
 * careerOptions.ts / careerPreferences.ts と同じ理由。選択肢を JSX に直書きすると
 * API 側の許容値とずれ、**選べるのに保存されない**状態が静かに生まれる
 * （2026-07-01 に employment_type で実際に起き、「派遣社員」が消えていた）。
 *
 * ⚠️ 選択肢を増やすときはこの1箇所を直し、**DB の CHECK も同時に広げる**。
 *    CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」。
 *    どれか1つでも忘れると「選べるのに保存できない」か
 *    「保存できるのに絞れない」のどちらかになる。
 *
 * ⚠️ **値は英字スラッグで固定。削除と改名はしない（追加のみ）。**
 *    日本語ラベルを後から変えても過去データと繋がるようにするため。
 *    ラベルを変えるのは自由。value を変えると DB の CHECK と既存行が壊れる。
 *
 * ── 公開範囲 ───────────────────────────────────────────────────────────────
 * ⚠️ **理由データ3種（入社理由 / 退職理由 / ギャップ）は非公開。本人と集計のみ。**
 *    他ユーザー・企業には一切出さない。/u/[id] /people 企業詳細 スカウト
 *    /biz/candidates のどこにも出さないこと。
 *    DB 側でも GRANT を付けていないので、admin クライアント以外からは読めない
 *    （20260811184225_experience_location_and_reasons.sql）。
 *
 * ⚠️ 既存の `ow_experiences.join_reason`（自由記述・公開トグル visibility_reason つき）
 *    とは**別物**。あちらは撤去予定だが、このファイルは関与しない。
 */

import { PREFECTURES } from "@/lib/utils/location";
import { VALID_REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";

// ── 入社理由 ──────────────────────────────────────────────────────────────────

export const JOIN_REASONS = [
  { value: "business",   label: "事業内容・プロダクト" },
  { value: "autonomy",   label: "裁量・ポジション" },
  { value: "people",     label: "面接で会った人" },
  { value: "salary",     label: "年収・待遇" },
  { value: "growth",     label: "事業の成長性" },
  { value: "work_style", label: "働き方" },
  { value: "skills",     label: "身につくスキル" },
  { value: "stability",  label: "知名度・安定性" },
] as const;

export const JOIN_REASON_LABELS: Record<string, string> =
  Object.fromEntries(JOIN_REASONS.map((o) => [o.value, o.label]));

export const VALID_JOIN_REASONS = new Set<string>(JOIN_REASONS.map((o) => o.value));

// ── 退職理由 ──────────────────────────────────────────────────────────────────

/**
 * ⚠️ `salary` と `work_style` は入社理由にも同じ value がある。
 *    別の列に入る別の集合なので衝突しない。ラベル辞書を共通化しないこと
 *    （"年収・待遇" と "給与・待遇" で文言が違う）。
 */
export const LEAVE_REASONS = [
  { value: "salary",        label: "給与・待遇" },
  { value: "evaluation",    label: "評価のされ方・昇進" },
  { value: "management",    label: "マネジメント・組織体制" },
  { value: "outlook",       label: "事業の先行き" },
  { value: "job_fit",       label: "仕事内容が合わない・伸び代" },
  { value: "work_style",    label: "働き方" },
  { value: "relationships", label: "人間関係" },
  { value: "company",       label: "会社都合・組織変更" },
] as const;

export const LEAVE_REASON_LABELS: Record<string, string> =
  Object.fromEntries(LEAVE_REASONS.map((o) => [o.value, o.label]));

export const VALID_LEAVE_REASONS = new Set<string>(LEAVE_REASONS.map((o) => o.value));

// ── 入社前後のギャップ ────────────────────────────────────────────────────────

export const GAP_AXES = [
  { value: "autonomy",       label: "裁量の大きさ" },
  { value: "onboarding",     label: "教育・オンボーディング" },
  { value: "work_hours",     label: "労働時間" },
  { value: "evaluation",     label: "評価の納得感" },
  { value: "decision_speed", label: "意思決定のスピード" },
  { value: "client_quality", label: "顧客・案件の質" },
] as const;

export const GAP_AXIS_LABELS: Record<string, string> =
  Object.fromEntries(GAP_AXES.map((o) => [o.value, o.label]));

export const VALID_GAP_AXES = new Set<string>(GAP_AXES.map((o) => o.value));

/**
 * ⚠️ 「未回答」という value を作らないこと。未回答は
 *    `ow_experience_gaps` に**行が無い**ことで表す。
 */
export const GAP_RATINGS = [
  { value: "better",      label: "想像より良かった" },
  { value: "as_expected", label: "想像通り" },
  { value: "worse",       label: "想像より厳しかった" },
] as const;

export const GAP_RATING_LABELS: Record<string, string> =
  Object.fromEntries(GAP_RATINGS.map((o) => [o.value, o.label]));

export const VALID_GAP_RATINGS = new Set<string>(GAP_RATINGS.map((o) => o.value));

// ── 勤務地 ────────────────────────────────────────────────────────────────────

/**
 * 勤務地の選択肢は既存の定数をそのまま使う。ここで作り直さない。
 *   都道府県   … src/lib/utils/location.ts の PREFECTURES（47値）
 *   勤務形態   … src/lib/constants/workStyle.ts の REMOTE_WORK_STATUSES（3値）
 *
 * ⚠️ `ow_experiences.remote_work_status` は「その在籍期間に本人がどう働いていたか」。
 *    求職者の**希望**（careerPreferences.ts の DESIRED_WORK_STYLES）とは別物。
 */
const VALID_PREFECTURES = new Set<string>(PREFECTURES);

// ── 保存API 共通のホワイトリスト検証 ──────────────────────────────────────────

export type GapInput = { axis: string; rating: string };

/** ow_experiences に書き込む値。undefined の列は触らない。 */
export type ReasonFieldsPatch = {
  prefecture: string | null;
  remote_work_status: string | null;
  join_reasons: string[] | null;
  join_reason_primary: string | null;
  leave_reasons: string[] | null;
};

export type ParseReasonFieldsResult =
  | {
      ok: true;
      patch: ReasonFieldsPatch;
      /** null = リクエストに gaps キーが無い（＝触らない）。[] = 全消し。 */
      gaps: GapInput[] | null;
    }
  | { ok: false; error: string; message: string };

function isBlankish(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

/**
 * 文字列配列をホワイトリストで検証する。
 *
 * ⚠️ **不正値を黙って捨てない。** 1つでも知らない値があればエラーを返す。
 *    落とした値を握り潰すと、利用者には「保存できたのに消えている」に見える
 *    （CLAUDE.md「入力させたのに保存しない UI を作らない」）。
 */
function parseSlugArray(
  raw: unknown,
  valid: Set<string>,
  fieldLabel: string
): { ok: true; value: string[] | null } | { ok: false; message: string } {
  if (isBlankish(raw)) return { ok: true, value: null };
  if (!Array.isArray(raw)) {
    return { ok: false, message: `${fieldLabel}の形式が不正です。` };
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string" || !valid.has(v)) {
      return { ok: false, message: `${fieldLabel}に不正な値が含まれています。` };
    }
    // 重複は詰めるだけ。値を失わないのでエラーにしない
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  // 空配列は「未回答」と同じ扱いにする。'{}' を保存すると
  // 「選ばなかった」と「答えていない」が集計で区別できなくなる
  return { ok: true, value: out.length > 0 ? out : null };
}

/**
 * POST / PATCH が共通で使う検証。**片方にだけ書かないこと。**
 * 割れると「作成時は保存されるが更新すると消える」が起きる。
 */
export function parseReasonFields(body: Record<string, unknown>): ParseReasonFieldsResult {
  // ── 勤務地
  let prefecture: string | null = null;
  if (!isBlankish(body.prefecture)) {
    const v = body.prefecture;
    if (typeof v !== "string" || !VALID_PREFECTURES.has(v)) {
      return { ok: false, error: "INVALID_PREFECTURE", message: "勤務地（都道府県）の値が不正です。" };
    }
    prefecture = v;
  }

  let remoteWorkStatus: string | null = null;
  if (!isBlankish(body.remote_work_status)) {
    const v = body.remote_work_status;
    if (typeof v !== "string" || !VALID_REMOTE_WORK_STATUSES.has(v)) {
      return { ok: false, error: "INVALID_REMOTE_WORK_STATUS", message: "勤務形態の値が不正です。" };
    }
    remoteWorkStatus = v;
  }

  // ── 入社理由
  const join = parseSlugArray(body.join_reasons, VALID_JOIN_REASONS, "入社理由");
  if (!join.ok) return { ok: false, error: "INVALID_JOIN_REASONS", message: join.message };

  let joinPrimary: string | null = null;
  if (!isBlankish(body.join_reason_primary)) {
    const v = body.join_reason_primary;
    if (typeof v !== "string" || !VALID_JOIN_REASONS.has(v)) {
      return { ok: false, error: "INVALID_JOIN_REASON_PRIMARY", message: "入社の決め手の値が不正です。" };
    }
    /* ⚠️ DB の CHECK（ow_experiences_join_reason_primary_check）と同じ条件。
          ここで弾かないと 23514 になり、利用者には原因の分からない500に見える。 */
    if (!join.value || !join.value.includes(v)) {
      return {
        ok: false,
        error: "JOIN_REASON_PRIMARY_NOT_SELECTED",
        message: "入社の決め手は、選んだ入社理由の中から選んでください。",
      };
    }
    joinPrimary = v;
  }

  // ── 退職理由
  const leave = parseSlugArray(body.leave_reasons, VALID_LEAVE_REASONS, "退職理由");
  if (!leave.ok) return { ok: false, error: "INVALID_LEAVE_REASONS", message: leave.message };

  // ── ギャップ（別テーブル）
  let gaps: GapInput[] | null = null;
  if (body.gaps !== undefined) {
    if (!Array.isArray(body.gaps)) {
      return { ok: false, error: "INVALID_GAPS", message: "入社前後のギャップの形式が不正です。" };
    }
    const seenAxis = new Set<string>();
    const out: GapInput[] = [];
    for (const g of body.gaps) {
      if (typeof g !== "object" || g === null) {
        return { ok: false, error: "INVALID_GAPS", message: "入社前後のギャップの形式が不正です。" };
      }
      const { axis, rating } = g as Record<string, unknown>;
      if (typeof axis !== "string" || !VALID_GAP_AXES.has(axis)) {
        return { ok: false, error: "INVALID_GAP_AXIS", message: "入社前後のギャップの項目が不正です。" };
      }
      if (typeof rating !== "string" || !VALID_GAP_RATINGS.has(rating)) {
        return { ok: false, error: "INVALID_GAP_RATING", message: "入社前後のギャップの回答が不正です。" };
      }
      /* 同じ軸が2回来たら弾く。UNIQUE(experience_id, axis) に当たって
         23505 になる前に、意味の分かるエラーにする。 */
      if (seenAxis.has(axis)) {
        return { ok: false, error: "DUPLICATE_GAP_AXIS", message: "入社前後のギャップに同じ項目が重複しています。" };
      }
      seenAxis.add(axis);
      out.push({ axis, rating });
    }
    gaps = out;
  }

  return {
    ok: true,
    patch: {
      prefecture,
      remote_work_status: remoteWorkStatus,
      join_reasons: join.value,
      join_reason_primary: joinPrimary,
      leave_reasons: leave.value,
    },
    gaps,
  };
}
