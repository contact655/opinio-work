/**
 * 企業フェーズ（`ow_companies.phase`）の選択肢と、DB値への写像。
 * **`/companies` と `/jobs` の両方がここを見る。**
 *
 * ── なぜ集めたか（2026-08-08）────────────────────────────────────────────────
 * 同じ `phase` 列に対して、2ページが**まったく別の実装**で絞り込んでいた。
 *
 *   /companies … PHASE_FILTER_MAP（表示名 → DB値の配列）で `.in("phase", …)`。11段
 *   /jobs      … `matchesStage()` の**正規表現**をクライアント側で評価。3段
 *
 * 結果、`/companies` の「プレシード」「ブートストラップ」「IPO準備中」は
 * `/jobs` のどの段にも当たらず、`non_listed`（公開4社）は**どちらでも絞れない**
 * という穴が空いていた。
 *
 * ⚠️ `/jobs` の正規表現が拾っていた `nasdaq|nyse|グロース|プライム` は
 *    **実データに0件**（2026-08-08 実測）。写像に寄せても失うものは無い。
 *
 * ⚠️ **0件の選択肢を出さない。** 画面に出す前に必ず `availablePhaseOptions()` を通し、
 *    実データに1件でもあるものだけを出すこと。
 *    `/jobs` で「シリーズA」を選んで必ず0件、のような空振りを作らない。
 *
 * ⚠️ 「外資系」はフェーズではない（`/jobs` では別のトグルピル、`/companies` では
 *    別のチップ）。ここに混ぜないこと。
 */

export type PhaseOption = {
  /** UI とフィルタで使うキー。URL やローカル state に入る */
  value: string;
  label: string;
  color: string;
  bg: string;
  dot: string;
  desc: string;
};

/**
 * 選択肢のキー → `ow_companies.phase` に入りうる値。
 * 日本語・英語・ハイフン/アンダースコアの表記ゆれをここで吸収する。
 *
 * ⚠️ 「成長ステージ」は シード〜シリーズC をまとめた**擬似オプション**。
 *    個別の「シード」「シリーズA」等と**範囲が重なる**のは意図どおり
 *    （粗く探したい人と具体的に探したい人の両方を拾う）。
 */
export const PHASE_FILTER_MAP: Record<string, string[]> = {
  "成長ステージ":    ["シード", "seed", "シリーズA", "series-a", "series_a", "シリーズB", "series-b", "series_b", "シリーズC", "series-c", "series_c"],
  "プレシード":      ["プレシード", "pre-seed", "preseed", "pre_seed"],
  "ブートストラップ": ["ブートストラップ", "bootstrap"],
  "シード":          ["シード", "seed"],
  "シリーズA":       ["シリーズA", "series-a", "series_a"],
  "シリーズB":       ["シリーズB", "series-b", "series_b"],
  "シリーズC":       ["シリーズC", "series-c", "series_c"],
  "シリーズD以降":   ["シリーズD以降", "シリーズD", "series-d", "series_d"],
  "IPO準備中":       ["IPO準備中", "ipo"],
  "上場":            ["上場", "listed"],
  "非上場":          ["non_listed", "非上場"],
  "ユニコーン":      ["ユニコーン", "unicorn"],
};

export const PHASE_OPTIONS: PhaseOption[] = [
  { value: "成長ステージ",    label: "成長ステージ",    color: "#1e3a8a", bg: "#e0e7ff", dot: "#4f46e5", desc: "シード〜シリーズCのスタートアップ" },
  { value: "プレシード",      label: "プレシード",      color: "#78350f", bg: "#fff7ed", dot: "#fb923c", desc: "創業初期・アイデア段階" },
  { value: "ブートストラップ", label: "ブートストラップ", color: "#92400e", bg: "#fef3c7", dot: "#f59e0b", desc: "自己資金・非資金調達" },
  { value: "シード",          label: "シード",          color: "#713f12", bg: "#fef9e7", dot: "#ca8a04", desc: "PMF検証・プロダクト開発期" },
  { value: "シリーズA",       label: "シリーズA",       color: "#1e40af", bg: "#dbeafe", dot: "#3b82f6", desc: "グロース開始・急成長期" },
  { value: "シリーズB",       label: "シリーズB",       color: "#5b21b6", bg: "#ede9fe", dot: "#8b5cf6", desc: "事業拡大・組織化" },
  { value: "シリーズC",       label: "シリーズC",       color: "#065f46", bg: "#d1fae5", dot: "#10b981", desc: "スケール・上場準備" },
  { value: "シリーズD以降",   label: "シリーズD以降",   color: "#064e3b", bg: "#ccfbf1", dot: "#14b8a6", desc: "レイトステージ・大規模化" },
  { value: "IPO準備中",       label: "IPO準備中",       color: "#9a3412", bg: "#ffedd5", dot: "#ea580c", desc: "上場直前・承認申請段階" },
  { value: "上場",            label: "上場",            color: "#14532d", bg: "#dcfce7", dot: "#16a34a", desc: "東証グロース・スタンダード・プライム" },
  /* ⚠️ 2026-08-08 に追加。公開4社が non_listed なのに、どちらのページでも
        選択肢が無く絞れなかった。4社とも親会社が非公開の外資系子会社。 */
  { value: "非上場",          label: "非上場",          color: "#334155", bg: "#f1f5f9", dot: "#64748b", desc: "親会社が非公開（PE買収等）" },
  { value: "ユニコーン",      label: "ユニコーン",      color: "#581c87", bg: "#f3e8ff", dot: "#a855f7", desc: "評価額10億ドル超の未上場企業" },
];

/** DB の phase 値が、その選択肢に当たるか */
export function phaseMatches(dbPhase: string | null | undefined, optionValue: string): boolean {
  if (!dbPhase) return false;
  return (PHASE_FILTER_MAP[optionValue] ?? [optionValue]).includes(dbPhase);
}

/**
 * 実データにある phase から、**出してよい選択肢だけ**を返す。
 *
 * ⚠️ 「成長ステージ」は配下（シード〜シリーズC）に1件でもあれば出る。
 *    まとめた擬似オプションなので、個別の段と同じ判定でよい。
 *
 * @param dbPhases そのページが対象にしている行の phase（NULL 込みで渡してよい）
 */
export function availablePhaseOptions(dbPhases: (string | null | undefined)[]): PhaseOption[] {
  const present = new Set(dbPhases.filter(Boolean) as string[]);
  return PHASE_OPTIONS.filter((o) =>
    Array.from(present).some((p) => phaseMatches(p, o.value)),
  );
}
