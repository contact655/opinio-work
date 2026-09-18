/**
 * 見送り理由の選択肢（④）。**クライアントと API の両方がここを見る。**
 *
 * ── ★形は `careerReasons.ts` に揃えた（2026-09-18）─────────────────────────
 * 「コード内定数 + DB の CHECK」で、マスタ表にはしない。
 * **理由は推測ではなく実測。** `careerReasons.ts` の値は、実際に
 * `ow_experiences_join_reasons_check`（12値）/ `..._leave_reasons_check`（13値）/
 * `ow_experience_gaps_axis_check`（6値）として **DB の CHECK に配列で直書き**されており、
 * TS 側の定数と**集合が完全一致**している（2026-09-18 に照合）。
 * ⚠️ **新しい流儀を1つ増やさないこと。** 選択肢の二重定義と綴り不一致は
 *    このリポジトリで繰り返し点検対象になっている領域。
 *
 * ⚠️★**値は英字スラッグで固定。削除も改名もしない（追加のみ）。**
 *    ラベルを変えるのは自由。value を変えると DB の CHECK と既存行が壊れる。
 *
 * ⚠️★**並び順を後から変えないこと。** 上に置いた選択肢ほど選ばれやすい。
 *    順を変えると、選択率の変化が「傾向が変わった」のか「位置を変えたから」なのか
 *    区別できなくなる（careerReasons.ts と同じ理由）。
 *
 * ── ★両側で軸を対応させている ───────────────────────────────────────────────
 * 「年収を理由に見送られた提案が、どちら側から見ても年収だったか」を出すため、
 * **同じ軸には同じスラッグ**を置いた（共通4つ: `salary` / `timing` / `location` / `other`）。
 * ⚠️ 新しい選択肢を足すときは、**対になる側があるかを必ず考えること。**
 *
 * ── ★複数選択にしない ───────────────────────────────────────────────────────
 * ⚠️ 1つだけ選ばせる。`ow_proposal_declines` は `(proposal_id, side)` が一意で、
 *    列も `reason text`（配列ではない）。**配列にしないこと** ——
 *    「いちばんの理由」が取れなくなり、集計が「何となく全部」になる。
 *
 * ── ★公開範囲 ───────────────────────────────────────────────────────────────
 * ⚠️★**求職者の理由は企業に渡さない。企業の理由は要約のみ求職者に渡す。**
 *    2026-09-18 時点では**どちらも相手に渡していない**（保存までしか作っていない）。
 *    担保は**テーブルを分けたこと**と `ow_proposal_declines` の RLS。
 *    ⚠️ 列単位 GRANT では守れない（本人も企業管理者も同じ `authenticated` で来るため）。
 *    **画面側の出し分けに頼らないこと。**
 */

export type DeclineSide = "candidate" | "company";

export type DeclineReasonOption = { value: string; label: string };

/** 求職者が提案を見送るとき（②） */
export const CANDIDATE_DECLINE_REASONS: readonly DeclineReasonOption[] = [
  { value: "job_content", label: "仕事内容が希望と違う" },
  { value: "salary",      label: "年収・待遇が合わない" },
  { value: "work_style",  label: "働き方が合わない" },
  { value: "location",    label: "勤務地が合わない" },
  { value: "phase",       label: "会社の規模・フェーズが合わない" },
  { value: "known",       label: "すでに知っている・検討した" },
  { value: "timing",      label: "いまは転職を考えていない" },
  { value: "other",       label: "その他" },
] as const;

/** 企業が候補者を見送るとき（⑨） */
export const COMPANY_DECLINE_REASONS: readonly DeclineReasonOption[] = [
  { value: "experience",  label: "経験が要件と合わない" },
  { value: "role",        label: "職種が合わない" },
  { value: "salary",      label: "年収の折り合いがつかない" },
  { value: "location",    label: "勤務地が合わない" },
  { value: "timing",      label: "いまは採用していない" },
  { value: "other",       label: "その他" },
] as const;

export function declineReasonsFor(side: DeclineSide): readonly DeclineReasonOption[] {
  return side === "candidate" ? CANDIDATE_DECLINE_REASONS : COMPANY_DECLINE_REASONS;
}

export const CANDIDATE_DECLINE_VALUES = new Set(CANDIDATE_DECLINE_REASONS.map((o) => o.value));
export const COMPANY_DECLINE_VALUES = new Set(COMPANY_DECLINE_REASONS.map((o) => o.value));

/** ⚠️ API の検証はこれを通すこと。side ごとに許容値が違う */
export function isValidDeclineReason(side: DeclineSide, reason: string): boolean {
  return side === "candidate"
    ? CANDIDATE_DECLINE_VALUES.has(reason)
    : COMPANY_DECLINE_VALUES.has(reason);
}

export function declineReasonLabel(side: DeclineSide, reason: string): string {
  return declineReasonsFor(side).find((o) => o.value === reason)?.label ?? reason;
}

/**
 * 自由記述の上限。
 * ⚠️ DB の CHECK（`ow_proposal_declines_note_length`）と**同じ値**にすること。
 *    片方だけ変えると「入力できるのに保存できない」になる。
 */
export const DECLINE_NOTE_MAX = 200;
