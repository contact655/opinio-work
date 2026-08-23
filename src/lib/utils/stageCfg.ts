/**
 * ⚠️ **資金調達フェーズを色で出し分けない（2026-08-23）。**
 *    以前はフェーズごとに虹色（シード＝黄 / シリーズA＝緑 / 上場＝緑 …）を当てていた。
 *    凡例が無いので色の意味が伝わらず、とくに緑が
 *    「金銭的にプラスの条件」（年収・確定拠出年金）と衝突していた。
 *    段階はラベルの文字で伝わるので、色はすべてニュートラルにする。
 *    → src/lib/utils/chipVariant.ts
 *
 * ⚠️ `components/companies/CompanyCardCompact.tsx` に**別実装の getStageCfg** がある。
 *    そちらは一覧カード用で、この定義とは繋がっていない。
 */
export type StageCfgEntry = {
  label: string;
  color: string;
  bg: string;
  border: string;
  fontWeight?: number;
};

export const STAGE_CONFIG: Record<string, StageCfgEntry> = {
  "pre-seed":         { label: "プレシード",       color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "プレシード":       { label: "プレシード",       color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "bootstrap":        { label: "ブートストラップ", color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "ブートストラップ": { label: "ブートストラップ", color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "seed":             { label: "シード",           color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "シード":           { label: "シード",           color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "series-a":         { label: "シリーズA",        color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "series_a":         { label: "シリーズA",        color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "シリーズA":        { label: "シリーズA",        color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "series-b":         { label: "シリーズB",        color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "series_b":         { label: "シリーズB",        color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "シリーズB":        { label: "シリーズB",        color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "series-c":         { label: "シリーズC",        color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "series_c":         { label: "シリーズC",        color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "シリーズC":        { label: "シリーズC",        color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "series-d":         { label: "シリーズD+",       color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "series_d":         { label: "シリーズD+",       color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "シリーズD以降":    { label: "シリーズD+",       color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "ipo":              { label: "IPO準備中",        color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "ipo準備中":        { label: "IPO準備中",        color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "IPO準備中":        { label: "IPO準備中",        color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "listed":           { label: "上場",             color: "#475569", bg: "#F1F5F9", border: "#CBD5E1", fontWeight: 800 },
  "上場":             { label: "上場",             color: "#475569", bg: "#F1F5F9", border: "#CBD5E1", fontWeight: 800 },
  "unicorn":          { label: "ユニコーン",       color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "ユニコーン":       { label: "ユニコーン",       color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "growth":           { label: "成長期",           color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "外資系":           { label: "🌐 外資系",        color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "foreign":          { label: "🌐 外資系",        color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "非上場":           { label: "非上場",           color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "non_listed":       { label: "非上場",           color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
};

/**
 * phase 値をバッジ表示設定に変換する。
 * マッピングに存在しない値（自由記述など）は null を返しバッジを非表示にする。
 */
export function getStageCfg(stage: string | null | undefined): StageCfgEntry | null {
  if (!stage) return null;
  const byKey = STAGE_CONFIG[stage.toLowerCase().replace(/\s+/g, "-")];
  if (byKey) return byKey;
  return STAGE_CONFIG[stage] ?? null;
}
