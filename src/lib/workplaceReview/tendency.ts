/**
 * ★④「あなたが合う職場の傾向」を本人の回答だけから組む（2026-10-16）。AI 生成ではなくルール。
 *
 * ⚠️★使うのは**本人の回答だけ**。他人・他社の回答は渡さないこと（呼び出し側で本人の分に絞る）。
 * ⚠️ 純粋な関数にしてある（DB も画面も触らない）。テストは tendency.test.mjs。
 *
 * ルール
 *   1. 対象 = ①を答えた（fitScore がある）かつ ②で1軸以上答えたレビュー
 *   2. 対象が2件以上: フィット度が最も高い会社と最も低い会社を比べる
 *      - 差が FIT_GAP_MIN（3）未満 → 「差が小さく、傾向はまだ出ていません」
 *      - 軸ごと（両方が答えた軸だけ）に差を出す: 2以上「差が大きい」／1「差は小さい」／0「差なし」
 *      - 見出し = 差が大きい軸（差の大きい順・同じなら並び順、最大2つ）の高フィット側の言い回し
 *        1つ: 言い切る形＋「職場で、…」 ／ 2つ: 1つ目のつなぐ形＋「、」＋2つ目の言い切る形＋「職場で、…」
 *        高フィット側 = 高い会社の値が低い会社より右なら右の言い回し、左なら左の言い回し
 *   3. 対象が1件: その会社の②の要約だけ
 *   4. 対象が0件: 案内だけ
 */

/* ⚠️★このファイルは何も import しない（node のテストから直接読むため。lib/careerAI/resolve.ts と同じ）。
      値は constants.ts と同じ: 5段階（0〜4）・真ん中は 2。軸の形も constants.ts の ReviewAxis と同じ */
const AXIS_MID = 2;
const AXIS_LAST = 4;
type ReviewAxis = {
  key: string; name: string; leftText: string; rightText: string;
  leftHeadlineJoin: string; leftHeadlineEnd: string; rightHeadlineJoin: string; rightHeadlineEnd: string;
};

/** フィット度の差がこれ未満なら「傾向はまだ出ていません」 */
export const FIT_GAP_MIN = 3;
/** 見出しに使う軸の数 */
export const HEADLINE_AXES_MAX = 2;

export type TendencyReview = {
  /** 職歴の id（保存先の行） */
  experienceId: string;
  companyName: string;
  fitScore: number | null;
  /** 軸 key → 0〜4 */
  axes: Record<string, number>;
  /** 同点のときの並び（新しいものを先に）。ISO 文字列 */
  updatedAt: string;
};

export type AxisCompare = {
  key: string;
  name: string;
  leftText: string;
  rightText: string;
  high: number;
  low: number;
  diff: number;
  level: "large" | "small" | "none";
};

export type Tendency =
  | { kind: "none" }
  | {
      kind: "single";
      company: { name: string; fitScore: number };
      /** 答えた軸だけ。label は「やり方は自分で決める（やや）」の形 */
      summary: { key: string; name: string; value: number; label: string }[];
    }
  | {
      kind: "small_gap";
      high: { name: string; fitScore: number };
      low: { name: string; fitScore: number };
    }
  | {
      kind: "compare";
      high: { name: string; fitScore: number };
      low: { name: string; fitScore: number };
      /** 見出しの一文。差が大きい軸が無ければ null */
      headline: string | null;
      axes: AxisCompare[];
    };

/** 軸の値を言葉に（真ん中は「どちらとも」） */
export function axisValueLabel(axis: ReviewAxis, value: number): string {
  if (value === AXIS_MID) return "どちらとも";
  const side = value < AXIS_MID ? axis.leftText : axis.rightText;
  const strong = value === 0 || value === AXIS_LAST;
  return `${side}（${strong ? "かなり" : "やや"}）`;
}

/** 見出しの一文。0個なら null。⚠️ 3つ目以降は渡さない（HEADLINE_AXES_MAX） */
export function headlineFor(phrases: { join: string; end: string }[]): string | null {
  if (phrases.length === 0) return null;
  const body = phrases.length === 1 ? phrases[0].end : `${phrases[0].join}、${phrases[1].end}`;
  return `${body}職場で、満足度が高くなりやすいタイプです。`;
}

export function computeTendency(reviews: TendencyReview[], axes: ReviewAxis[]): Tendency {
  const axisByKey = new Map(axes.map((a) => [a.key, a]));
  const known = (r: TendencyReview) => Object.keys(r.axes).some((k) => axisByKey.has(k));
  const targets = reviews.filter((r) => r.fitScore !== null && known(r));

  if (targets.length === 0) return { kind: "none" };

  if (targets.length === 1) {
    const t = targets[0];
    return {
      kind: "single",
      company: { name: t.companyName, fitScore: t.fitScore as number },
      summary: axes
        .filter((a) => t.axes[a.key] !== undefined)
        .map((a) => ({ key: a.key, name: a.name, value: t.axes[a.key], label: axisValueLabel(a, t.axes[a.key]) })),
    };
  }

  /* 高い順。同点なら新しい回答を先に（高い側・低い側とも決定的に決まるように） */
  const sorted = targets.slice().sort((a, b) =>
    (b.fitScore as number) - (a.fitScore as number) || b.updatedAt.localeCompare(a.updatedAt) || a.experienceId.localeCompare(b.experienceId));
  const hi = sorted[0];
  const lo = sorted[sorted.length - 1];
  const high = { name: hi.companyName, fitScore: hi.fitScore as number };
  const low = { name: lo.companyName, fitScore: lo.fitScore as number };

  if ((hi.fitScore as number) - (lo.fitScore as number) < FIT_GAP_MIN) return { kind: "small_gap", high, low };

  const compared: (AxisCompare & { order: number; phrase: { join: string; end: string } | null })[] = [];
  axes.forEach((a, order) => {
    const h = hi.axes[a.key];
    const l = lo.axes[a.key];
    if (h === undefined || l === undefined) return;
    const diff = Math.abs(h - l);
    compared.push({
      key: a.key, name: a.name, leftText: a.leftText, rightText: a.rightText,
      high: h, low: l, diff,
      level: diff >= 2 ? "large" : diff === 1 ? "small" : "none",
      order,
      phrase: diff === 0 ? null
        : h > l ? { join: a.rightHeadlineJoin, end: a.rightHeadlineEnd }
          : { join: a.leftHeadlineJoin, end: a.leftHeadlineEnd },
    });
  });

  const picks = compared
    .filter((c) => c.level === "large")
    .sort((a, b) => b.diff - a.diff || a.order - b.order)
    .slice(0, HEADLINE_AXES_MAX)
    .map((c) => c.phrase as { join: string; end: string });

  return {
    kind: "compare",
    high,
    low,
    headline: headlineFor(picks),
    axes: compared.map(({ order: _o, phrase: _p, ...rest }) => rest),
  };
}
