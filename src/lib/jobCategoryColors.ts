/**
 * src/lib/jobCategoryColors.ts
 *
 * ow_roles 親カテゴリ UUID → アバター背景色 / 文字色 のマッピング。
 * Phase γ-3（修正②）で追加。
 *
 * - キー: ow_roles テーブルの親カテゴリ UUID (parent_id IS NULL の行の id)
 * - 子カテゴリ所属社員: roleParentId で引く（親の色を継承）
 * - 親直カテゴリ所属社員: roleCategoryId で引く
 * - どちらも null の場合: FALLBACK_CATEGORY_COLOR
 *
 * 色方針: Tailwind 50 系（淡い背景）+ 800 系（濃い文字）で
 * 7 カテゴリが視覚的に区別でき、royal/navy と競合しない組み合わせを採用。
 */

export type CategoryColor = {
  bg: string;   // アバター背景色
  text: string; // アバター文字色
};

// ─── 親カテゴリ UUID → 色マッピング ──────────────────────────────────────────
// UUID は 2026-05 時点の ow_roles テーブル実値
export const JOB_CATEGORY_COLORS: Record<string, CategoryColor> = {
  // エンジニア (a905184b) — indigo 系
  "a905184b-2a26-4be6-8881-fa96e3b0d94a": { bg: "#EEF2FF", text: "#3730A3" },

  // PdM / PM (15077bd6) — violet 系
  "15077bd6-0b80-49bf-875c-b5068a615de5": { bg: "#F5F3FF", text: "#5B21B6" },

  // マーケティング (9ff6eb0c) — amber 系
  "9ff6eb0c-4726-4d71-9d84-863b2e674f19": { bg: "#FFFBEB", text: "#92400E" },

  // 営業 (89b056f4) — emerald 系
  "89b056f4-ef14-4e4a-a71c-5fd5e4c4618a": { bg: "#ECFDF5", text: "#065F46" },

  // カスタマーサクセス (093cd4bb) — sky 系
  "093cd4bb-e610-464a-90b7-8caae04996c9": { bg: "#F0F9FF", text: "#075985" },

  // 経営・CxO (3b29af59) — rose 系
  "3b29af59-7601-43ff-8a32-beec3ac5b084": { bg: "#FFF1F2", text: "#9F1239" },

  // その他 (d035e864) — slate 系
  "d035e864-320a-4adb-97f0-05526d9be6db": { bg: "#F1F5F9", text: "#475569" },
};

// カテゴリ情報がない社員（孤児）用の fallback
export const FALLBACK_CATEGORY_COLOR: CategoryColor = {
  bg: "#F1F5F9",
  text: "#475569",
};

/**
 * CompanyEmployee の roleParentId / roleCategoryId から色を解決する。
 *
 * 優先順位:
 *   1. roleParentId がある → 親カテゴリ色（子カテゴリ所属）
 *   2. roleCategoryId がある → そのカテゴリ色（親直カテゴリ所属）
 *   3. どちらも null → FALLBACK_CATEGORY_COLOR
 */
export function resolveAvatarColor(
  roleParentId: string | null,
  roleCategoryId: string | null
): CategoryColor {
  const key = roleParentId ?? roleCategoryId;
  if (!key) return FALLBACK_CATEGORY_COLOR;
  return JOB_CATEGORY_COLORS[key] ?? FALLBACK_CATEGORY_COLOR;
}
