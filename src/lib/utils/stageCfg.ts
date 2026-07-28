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
  "seed":             { label: "シード",           color: "#92400E", bg: "#FEF3C7", border: "#FDE68A" },
  "シード":           { label: "シード",           color: "#92400E", bg: "#FEF3C7", border: "#FDE68A" },
  "series-a":         { label: "シリーズA",        color: "#065F46", bg: "#D1FAE5", border: "#A7F3D0" },
  "series_a":         { label: "シリーズA",        color: "#065F46", bg: "#D1FAE5", border: "#A7F3D0" },
  "シリーズA":        { label: "シリーズA",        color: "#065F46", bg: "#D1FAE5", border: "#A7F3D0" },
  "series-b":         { label: "シリーズB",        color: "#1E40AF", bg: "#DBEAFE", border: "#BFDBFE" },
  "series_b":         { label: "シリーズB",        color: "#1E40AF", bg: "#DBEAFE", border: "#BFDBFE" },
  "シリーズB":        { label: "シリーズB",        color: "#1E40AF", bg: "#DBEAFE", border: "#BFDBFE" },
  "series-c":         { label: "シリーズC",        color: "#5B21B6", bg: "#EDE9FE", border: "#DDD6FE" },
  "series_c":         { label: "シリーズC",        color: "#5B21B6", bg: "#EDE9FE", border: "#DDD6FE" },
  "シリーズC":        { label: "シリーズC",        color: "#5B21B6", bg: "#EDE9FE", border: "#DDD6FE" },
  "series-d":         { label: "シリーズD+",       color: "#991B1B", bg: "#FEE2E2", border: "#FECACA" },
  "series_d":         { label: "シリーズD+",       color: "#991B1B", bg: "#FEE2E2", border: "#FECACA" },
  "シリーズD以降":    { label: "シリーズD+",       color: "#991B1B", bg: "#FEE2E2", border: "#FECACA" },
  "ipo":              { label: "IPO準備中",        color: "#9A3412", bg: "#FFEDD5", border: "#FED7AA" },
  "ipo準備中":        { label: "IPO準備中",        color: "#9A3412", bg: "#FFEDD5", border: "#FED7AA" },
  "IPO準備中":        { label: "IPO準備中",        color: "#9A3412", bg: "#FFEDD5", border: "#FED7AA" },
  "listed":           { label: "上場",             color: "#065F46", bg: "#ECFDF5", border: "#6EE7B7", fontWeight: 800 },
  "上場":             { label: "上場",             color: "#065F46", bg: "#ECFDF5", border: "#6EE7B7", fontWeight: 800 },
  "unicorn":          { label: "ユニコーン",       color: "#6D28D9", bg: "#F3E8FF", border: "#C4B5FD" },
  "ユニコーン":       { label: "ユニコーン",       color: "#6D28D9", bg: "#F3E8FF", border: "#C4B5FD" },
  "growth":           { label: "成長期",           color: "#065F46", bg: "#D1FAE5", border: "#A7F3D0" },
  "外資系":           { label: "🌐 外資系",        color: "#3730A3", bg: "#E0E7FF", border: "#C7D2FE" },
  "foreign":          { label: "🌐 外資系",        color: "#3730A3", bg: "#E0E7FF", border: "#C7D2FE" },
  "非上場":           { label: "非上場",           color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
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
