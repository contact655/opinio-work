/**
 * ★転機の3問のあとの「もう少し詳しく（任意）」（2026-10-27 / フェーズ1c・柴さんの指示）。
 *   入れるのは 実際はどちら寄りだったか（6軸・5段階）／働き方の事実（残業・出社・英語）／入る前に知りたかったこと（80字）。
 *   ⚠️ 「入社前の期待との比較」と「どんな人に合う会社か（タグ）」は入れない。
 *   ⚠️ 選択肢は入社後レビューと同じ（lib/workplaceReview/constants.ts）。書き写さず、そこから読む。
 *   ⚠️ 置き場所は ow_career_turns（detail_*）と ow_career_turn_axes（migration 20261027100000）。
 *   ⚠️ このファイルはクライアントからも読む。サーバー専用のものを import しない。
 */
import { AXIS_SCALE, FACT_ITEMS, MEMO_MAX, memoLength, type FactKey } from "@/lib/workplaceReview/constants";

export type CareerTurnDetail = {
  /** 軸のキー → 0〜4（マスタ ow_review_axes のキーだけ） */
  axes: Record<string, number>;
  facts: Record<FactKey, number | null>;
  memo: string;
};

export const EMPTY_TURN_DETAIL: CareerTurnDetail = { axes: {}, facts: { overtime: null, office: null, english: null }, memo: "" };

export function hasAnyDetail(d: CareerTurnDetail): boolean {
  return Object.keys(d.axes).length > 0 || FACT_ITEMS.some((f) => d.facts[f.key] !== null) || d.memo.trim() !== "";
}

/** API で受けた任意の段を検証する。⚠️ 軸のキーがマスタにあるかはサーバーが確かめる（validAxisKeys） */
export function parseTurnDetail(raw: unknown, validAxisKeys: Set<string>): { ok: true; value: CareerTurnDetail } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object") return { ok: false, message: "回答の形が正しくありません。" };
  const r = raw as Record<string, unknown>;
  const axesRaw = (r.axes ?? {}) as Record<string, unknown>;
  if (typeof axesRaw !== "object" || Array.isArray(axesRaw)) return { ok: false, message: "「どちら寄りか」の回答が正しくありません。" };
  const axes: Record<string, number> = {};
  for (const [k, v] of Object.entries(axesRaw)) {
    if (!validAxisKeys.has(k) || typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > AXIS_SCALE.length - 1) {
      return { ok: false, message: "「どちら寄りか」の回答が正しくありません。" };
    }
    axes[k] = v;
  }
  const factsRaw = (r.facts ?? {}) as Record<string, unknown>;
  const facts = { ...EMPTY_TURN_DETAIL.facts };
  for (const f of FACT_ITEMS) {
    const v = factsRaw[f.key] ?? null;
    if (v !== null && (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > f.choices.length - 1)) {
      return { ok: false, message: "働き方の回答が正しくありません。" };
    }
    facts[f.key] = v as number | null;
  }
  const memo = typeof r.memo === "string" ? r.memo : "";
  if (memoLength(memo) > MEMO_MAX) return { ok: false, message: `入る前に知りたかったことは${MEMO_MAX}字までです。` };
  return { ok: true, value: { axes, facts, memo } };
}
