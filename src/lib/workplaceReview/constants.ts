/**
 * ★入社後レビュー（「株式会社◯◯について」。2026-10-16 に作り直した）の決めごと。
 *   表は migration 20261016190000（ow_workplace_reviews ほか）。
 *
 * ⚠️★回答は公開しない。企業ページにも、企業側の画面・API にも出さない。
 *    使い道は ①本人への「あなたが合う職場の傾向」 ②将来の根拠つき提案 ③将来の企業向け非公開フィードバック だけ。
 * ⚠️★②の軸と③の「合う人」タグは**DB のマスタ**（ow_review_axes / ow_review_fit_tags）が正。ここに書き写さない。
 *    回答の表にラベルを持たせないのは、求職者側・企業側にも同じ軸で聞くため。
 * ⚠️ このファイルはクライアントからも読む。サーバー専用のものを import しない。
 */

/** ① Q1: 合っていたか（0〜10） */
export const FIT_SCORE_MIN = 0;
export const FIT_SCORE_MAX = 10;
export const FIT_SCORE_ENDS = { low: "まったく合わなかった", high: "とても合っていた" } as const;

/** ① Q2: 入社前の期待と比べて（4項目 × 3択）。列名は ow_workplace_reviews.gap_* */
export const GAP_ITEMS = [
  { key: "gap_job",     label: "仕事内容",             hint: "入社前の説明と一致していたか" },
  { key: "gap_pay",     label: "年収・待遇",           hint: "提示条件や昇給の実態" },
  { key: "gap_growth",  label: "成長の機会",           hint: "任された範囲・できるようになったこと" },
  { key: "gap_culture", label: "人間関係・カルチャー", hint: "雰囲気や大事にしている価値観" },
] as const;
export type GapKey = (typeof GAP_ITEMS)[number]["key"];

/** 0=下回った 1=期待どおり 2=上回った（DB の CHECK は 0〜2） */
export const GAP_CHOICES = ["下回った", "期待どおり", "上回った"] as const;

/** ② 5段階（0〜4）。0 が左にかなり、4 が右にかなり（DB の CHECK は 0〜4） */
export const AXIS_SCALE = ["← かなり", "← やや", "どちらとも", "やや →", "かなり →"] as const;
export const AXIS_MID = 2;

/** ③ 働き方の事実（各4択・0〜3）。列名は ow_workplace_reviews の overtime / office / english */
export const FACT_ITEMS = [
  { key: "overtime", label: "残業（月あたり）", choices: ["10h未満", "10〜20h", "20〜40h", "40h以上"] },
  { key: "office",   label: "出社",             choices: ["フルリモート", "週1〜2", "週3〜4", "ほぼ毎日"] },
  { key: "english",  label: "英語",             choices: ["使わない", "読み書きのみ", "会議で使う", "日常的に話す"] },
] as const;
export type FactKey = (typeof FACT_ITEMS)[number]["key"];

/** ③ 離れた理由の上限（以前の質問と同じ。careerReasons.ts の REASON_MAX = 3） */
export const LEAVE_REASON_MAX = 3;

/** ③ 入る前に知りたかったこと（DB の CHECK も 80字） */
export const MEMO_MAX = 80;

/** マスタの形（GET で返す） */
export type ReviewAxis = {
  key: string;
  name: string;
  leftText: string;
  rightText: string;
  /** ④の見出し。つなぐ形（2つ目の前）と言い切る形（「職場」にかかる）を左右それぞれ */
  leftHeadlineJoin: string;
  leftHeadlineEnd: string;
  rightHeadlineJoin: string;
  rightHeadlineEnd: string;
};
export type ReviewFitTag = { key: string; label: string };

/** 回答（画面とAPIで共通） */
export type WorkplaceReviewAnswers = {
  fitScore: number | null;
  gaps: Record<GapKey, number | null>;
  /** 軸 key → 0〜4。答えていない軸はキーごと無い */
  axes: Record<string, number>;
  facts: Record<FactKey, number | null>;
  tags: string[];
  memo: string;
  /** ③の末尾「この会社を離れた理由」（終了した会社だけ・3つまで）。
      ⚠️★選択肢と保存先は以前のまま（careerReasons.ts の LEAVE_REASONS ／ ow_experience_leave_reasons）。
         新しいレビューの表には入れない（2026-10-16 / 柴さんの指示） */
  leaveReasons: string[];
};

export const EMPTY_ANSWERS: WorkplaceReviewAnswers = {
  fitScore: null,
  gaps: { gap_job: null, gap_pay: null, gap_growth: null, gap_culture: null },
  axes: {},
  facts: { overtime: null, office: null, english: null },
  tags: [],
  memo: "",
  leaveReasons: [],
};

/** ①がそろっているか（「次へ」「ここで保存」を押せる条件） */
export function requiredDone(a: WorkplaceReviewAnswers): boolean {
  return a.fitScore !== null && GAP_ITEMS.every((g) => a.gaps[g.key] !== null);
}

/** 文字数は DB の char_length と同じく「文字」で数える（絵文字を2と数えない） */
export function memoLength(memo: string): number {
  return Array.from(memo.trim()).length;
}

export type ReviewStatus = "required_done" | "complete";

/**
 * 保存の中身を確かめる（API で使う）。⚠️ 軸とタグの key がマスタにあるかは呼び出し側が確かめる。
 * 不正なら message を返す（400 で出す）。
 */
export function parseAnswers(body: unknown): { ok: true; value: WorkplaceReviewAnswers } | { ok: false; message: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const int = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : undefined;

  const fit = int(b.fitScore, FIT_SCORE_MIN, FIT_SCORE_MAX);
  if (fit === undefined) return { ok: false, message: "「合っていましたか」に答えてください。" };

  const g = (b.gaps ?? {}) as Record<string, unknown>;
  const gaps = { ...EMPTY_ANSWERS.gaps };
  for (const it of GAP_ITEMS) {
    const v = int(g[it.key], 0, GAP_CHOICES.length - 1);
    if (v === undefined) return { ok: false, message: "「入社前の期待と比べて」の4項目すべてに答えてください。" };
    gaps[it.key] = v;
  }

  const axes: Record<string, number> = {};
  const ax = (b.axes ?? {}) as Record<string, unknown>;
  if (typeof ax !== "object" || Array.isArray(ax)) return { ok: false, message: "回答の形が不正です。" };
  for (const [k, v] of Object.entries(ax)) {
    const n = int(v, 0, AXIS_SCALE.length - 1);
    if (n === undefined || !/^[a-z][a-z0-9_]*$/.test(k)) return { ok: false, message: "「どちら寄りか」の回答が不正です。" };
    axes[k] = n;
  }

  const f = (b.facts ?? {}) as Record<string, unknown>;
  const facts = { ...EMPTY_ANSWERS.facts };
  for (const it of FACT_ITEMS) {
    if (f[it.key] === null || f[it.key] === undefined) continue;
    const v = int(f[it.key], 0, it.choices.length - 1);
    if (v === undefined) return { ok: false, message: "働き方の回答が不正です。" };
    facts[it.key] = v;
  }

  const tagsRaw = Array.isArray(b.tags) ? b.tags : [];
  const tags: string[] = [];
  for (const t of tagsRaw) {
    if (typeof t !== "string" || !/^[a-z][a-z0-9_]*$/.test(t)) return { ok: false, message: "「合う人」の回答が不正です。" };
    if (!tags.includes(t)) tags.push(t);
  }

  /* ⚠️ 選択肢（LEAVE_REASONS）にあるか・終了した会社かは呼び出し側が確かめる。ここは形と件数だけ */
  const lrRaw = Array.isArray(b.leaveReasons) ? b.leaveReasons : [];
  const leaveReasons: string[] = [];
  for (const t of lrRaw) {
    if (typeof t !== "string" || !/^[a-z][a-z0-9_]*$/.test(t)) return { ok: false, message: "離れた理由の回答が不正です。" };
    if (!leaveReasons.includes(t)) leaveReasons.push(t);
  }
  if (leaveReasons.length > LEAVE_REASON_MAX) return { ok: false, message: `離れた理由は${LEAVE_REASON_MAX}つまで選べます。` };

  const memo = typeof b.memo === "string" ? b.memo.trim() : "";
  if (memoLength(memo) > MEMO_MAX) return { ok: false, message: `「入る前に知りたかったこと」は${MEMO_MAX}字までです。` };

  return { ok: true, value: { fitScore: fit, gaps, axes, facts, tags, memo, leaveReasons } };
}
