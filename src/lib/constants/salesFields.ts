// セールス職専用構造化項目のマスタ定数
// job_category === "営業" のときのみ入力・表示に使用する。

/** 営業職かどうかの判定ロジックを1箇所に集約 */
export function isSalesJob(jobCategory: string | null | undefined): boolean {
  return jobCategory === "営業";
}

// ─── 担当セグメント ───────────────────────────────────────────────────────────

export const SALES_SEGMENTS = [
  { key: "smb",        label: "SMB",            desc: "中小企業・スタートアップ" },
  { key: "mid",        label: "ミッドマーケット", desc: "中堅企業" },
  { key: "enterprise", label: "エンタープライズ",  desc: "大手・上場企業" },
] as const;

export type SalesSegmentKey = (typeof SALES_SEGMENTS)[number]["key"];

export const SALES_SEGMENT_LABELS: Record<SalesSegmentKey, string> = Object.fromEntries(
  SALES_SEGMENTS.map((s) => [s.key, s.label])
) as Record<SalesSegmentKey, string>;

// ─── 新規/既存の傾向 ─────────────────────────────────────────────────────────

export const SALES_HUNTER_FARMER_OPTIONS = [
  { key: "hunter",   label: "新規開拓中心",  desc: "アウトバウンドやSDRとの連携で新規顧客を獲得" },
  { key: "balanced", label: "半々",          desc: "新規獲得と既存深耕をバランスよく担当" },
  { key: "farmer",   label: "既存深耕中心",  desc: "既存顧客のアップセル・リテンション中心" },
] as const;

export type SalesHunterFarmerKey = (typeof SALES_HUNTER_FARMER_OPTIONS)[number]["key"];

export const SALES_HUNTER_FARMER_LABELS: Record<SalesHunterFarmerKey, string> = Object.fromEntries(
  SALES_HUNTER_FARMER_OPTIONS.map((o) => [o.key, o.label])
) as Record<SalesHunterFarmerKey, string>;

/** key → ラベル変換（DB値から表示ラベルへ） */
export function getSalesSegmentLabel(key: string): string {
  return SALES_SEGMENT_LABELS[key as SalesSegmentKey] ?? key;
}

export function getHunterFarmerLabel(key: string): string {
  return SALES_HUNTER_FARMER_LABELS[key as SalesHunterFarmerKey] ?? key;
}
