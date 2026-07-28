// ow_tool_masters.category スラッグ → 日本語ラベル・アイコン定義
//
// CHECK制約の10値（ow_tool_masters_category_check）と完全に一致させること:
//   CHECK (category IN (
//     'calendar','email','crm','sales','marketing',
//     'communication','data','dev','ai','other'
//   ))
//
// 統合スイートの扱いルール:
//   カレンダー・メール・ドキュメント等を兼ねる製品
//   （Google Workspace, Microsoft 365, Garoon, desknet's NEO 等）は
//   'other' に置く。単体ツールのみ各カテゴリに配置する。
//
// BUILD-TIME 整合性チェック:
//   TOOL_CATEGORY_LABELS / TOOL_CATEGORY_ICONS の型は Record<CategorySlug, ...>。
//   CHECK_CONSTRAINT_VALUES にスラッグを追加したとき、両方を同時に更新すること。

// CHECK制約と同じ10値。追加時はここに足してから下の2つの Record にも足す。
const CHECK_CONSTRAINT_VALUES = [
  "calendar", "email", "crm", "sales", "marketing",
  "communication", "data", "dev", "ai", "other",
] as const;

export type CategorySlug = typeof CHECK_CONSTRAINT_VALUES[number];

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

// アイコン定義。svgContent は <svg> の innerHTML として使用（静的コンテンツのみ）
export type ToolIconDef = {
  svgContent: string;
  color: string;
  bg: string;
  border: string;
};

// 10カテゴリすべてにアイコンが定義されていることを型で保証
export const TOOL_CATEGORY_ICONS: Record<CategorySlug, ToolIconDef> = {
  calendar: {
    svgContent: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)",
  },
  email: {
    svgContent: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)",
  },
  crm: {
    svgContent: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    color: "#065f46", bg: "#d1fae5", border: "#a7f3d0",
  },
  sales: {
    svgContent: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    color: "#065f46", bg: "#d1fae5", border: "#a7f3d0",
  },
  marketing: {
    svgContent: '<path d="M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 0 0 0-6M5.436 13.683A4.001 4.001 0 0 1 7 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.994 3.994 0 0 1-1.564-.317z"/>',
    color: "#92400e", bg: "#fef3c7", border: "#fde68a",
  },
  communication: {
    svgContent: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)",
  },
  data: {
    svgContent: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    color: "#5b21b6", bg: "#ede9fe", border: "#ddd6fe",
  },
  dev: {
    svgContent: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    color: "#374151", bg: "#f3f4f6", border: "#e5e7eb",
  },
  ai: {
    svgContent: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    color: "#5b21b6", bg: "#ede9fe", border: "#ddd6fe",
  },
  other: {
    svgContent: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    color: "#374151", bg: "#f3f4f6", border: "#e5e7eb",
  },
};

// 表示順（CHECK制約10値と対応）
export const TOOL_CATEGORY_ORDER: string[] = [...CHECK_CONSTRAINT_VALUES];

// マッピングに無い値は非表示（スラッグが露出しないよう undefined を返す）
export function getToolCategoryLabel(category: string): string | undefined {
  return (TOOL_CATEGORY_LABELS as Record<string, string>)[category];
}

export function getToolCategoryIcon(category: string): ToolIconDef | undefined {
  return (TOOL_CATEGORY_ICONS as Record<string, ToolIconDef>)[category];
}
