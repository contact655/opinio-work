/**
 * logoPresets.ts
 *
 * 学校ロゴ用グラデーションプリセット。
 * 既存 ow_schools の logo_gradient 値から代表的な 8 色を抽出。
 * ApproveSchoolRequestModal のスウォッチパレットで使用する。
 *
 * 段階7-F Phase 5-b
 */

export const SCHOOL_LOGO_GRADIENT_PRESETS = [
  { label: "紺青",     value: "linear-gradient(135deg, #1E3A8A, #312E81)" },
  { label: "濃紺",     value: "linear-gradient(135deg, #1A2B5A, #0F1A3A)" },
  { label: "ネイビー", value: "linear-gradient(135deg, #003B6F, #002448)" },
  { label: "深緑",     value: "linear-gradient(135deg, #2C5F2D, #1A3D1B)" },
  { label: "エンジ",   value: "linear-gradient(135deg, #8B1A2B, #5A0F1A)" },
  { label: "深赤",     value: "linear-gradient(135deg, #8B0000, #5A0000)" },
  { label: "パープル", value: "linear-gradient(135deg, #6B4A8A, #4A2F5C)" },
  { label: "グレー",   value: "linear-gradient(135deg, #B5C5D6, #6B8CAE)" },
] as const;
