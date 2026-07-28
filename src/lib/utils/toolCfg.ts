// ow_tool_masters.category スラッグ → 日本語ラベル
//
// CHECK制約の9値（ow_tool_masters_category_check）と完全に一致させること:
//   CHECK (category IN (
//     'calendar','email','crm','sales','marketing',
//     'communication','data','dev','other'
//   ))
//
// 統合スイートの扱いルール:
//   カレンダー・メール・ドキュメント等を兼ねる製品
//   （Google Workspace, Microsoft 365, Garoon, desknet's NEO 等）は
//   'other' に置く。単体ツールのみ各カテゴリに配置する。
//
// BUILD-TIME 整合性チェック:
//   TOOL_CATEGORY_LABELS の型は Record<CategorySlug, string> として宣言する。
//   CHECK_CONSTRAINT_VALUES にスラッグを追加したとき、
//   TOOL_CATEGORY_LABELS にも追加しないと型エラーになる。
//   両方を同時に更新すること。

// CHECK制約と同じ10値。追加時はここに足してから TOOL_CATEGORY_LABELS にも足す。
const CHECK_CONSTRAINT_VALUES = [
  "calendar", "email", "crm", "sales", "marketing",
  "communication", "data", "dev", "ai", "other",
] as const;

type CategorySlug = typeof CHECK_CONSTRAINT_VALUES[number];

// CategorySlug のすべてのキーが揃っていないと型エラーになる
export const TOOL_CATEGORY_LABELS: Record<CategorySlug, string> = {
  calendar:      "カレンダー",
  email:         "メール",
  crm:           "顧客管理",
  sales:         "営業支援",
  marketing:     "マーケティング",
  communication: "コミュニケーション",
  data:          "データ分析",
  dev:           "開発",
  ai:            "AI",
  other:         "その他",
};

// 表示順（CHECK制約10値と対応）
export const TOOL_CATEGORY_ORDER: string[] = [...CHECK_CONSTRAINT_VALUES];

// マッピングに無い値は非表示（スラッグが露出しないよう undefined を返す）
export function getToolCategoryLabel(category: string): string | undefined {
  return (TOOL_CATEGORY_LABELS as Record<string, string>)[category];
}
