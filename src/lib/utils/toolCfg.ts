// ow_tool_masters.category スラッグ → 日本語ラベル
// CHECK制約の8値すべてを網羅すること:
// CHECK (category IN ('crm','marketing','cloud_infra','dev','data','communication','productivity','security'))

export const TOOL_CATEGORY_LABELS: Record<string, string> = {
  crm:           "CRM・営業支援",
  marketing:     "マーケティング",
  cloud_infra:   "クラウド・インフラ",
  dev:           "開発",
  data:          "データ・分析",
  communication: "コミュニケーション",
  productivity:  "生産性・業務",
  security:      "セキュリティ",
} as const;

// 表示順（CHECK制約と同順）
export const TOOL_CATEGORY_ORDER: string[] = [
  "crm",
  "marketing",
  "cloud_infra",
  "dev",
  "data",
  "communication",
  "productivity",
  "security",
];

// マッピングに無い値は非表示（スラッグが露出しないよう undefined を返す）
export function getToolCategoryLabel(category: string): string | undefined {
  return TOOL_CATEGORY_LABELS[category];
}
