/**
 * 学校の種別（`ow_schools.type`）。
 *
 * ⚠️★**UI / API / DB の CHECK を3つ揃える**（CLAUDE.md）。ここが唯一の出どころで、
 *    DB 側は `ow_schools_type_check`。**値を足すときは migration も同じコミットで動かす。**
 *
 * ── ★小学校・中学校・幼稚園を足した（2026-09-28 / 柴さんの指示）────────────
 * 狙いは「**同じ中学校出身の人がどこで活躍しているか**」を見られるようにすること。
 *
 * ⚠️★**それには「人と人を学校で突き合わせる」必要がある**ので、自由入力では足りない。
 *    実際、高校で既に表記ゆれが出ている（実測 2026-09-28: 同じ学校が
 *    「朝霞」と「埼玉県立朝霞西高等学校」の2行で入っている）。
 *    CLAUDE.md が企業について決めているのと同じ
 *    （「`company_id` の集合で突き合わせる。社名の文字列で比べないこと」）。
 * ⚠️ `degree`（`ow_user_educations`）の側は**元から小学校卒〜博士まで入る**。
 *    足りなかったのは**学校マスタの種別**だけ。**2つを混同しないこと。**
 *
 * ⚠️★**並びは「新しい学歴ほど上」ではなく、段の順**（幼稚園 → 大学院）。
 *    選ぶ人が学校段階で探すので、学歴の並び順（新しい順）とは別。
 */
export const SCHOOL_TYPES = [
  { value: "kindergarten",    label: "幼稚園・保育園" },
  { value: "elementary",      label: "小学校" },
  { value: "junior_high",     label: "中学校" },
  { value: "highschool",      label: "高等学校" },
  { value: "vocational",      label: "専門学校" },
  { value: "college",         label: "短期大学・高専" },
  { value: "university",      label: "大学" },
  { value: "graduate_school", label: "大学院" },
] as const;

export type SchoolType = (typeof SCHOOL_TYPES)[number]["value"];

/** ⚠️ 値が引けないときは「学校」。**推測で別の種別に丸めないこと** */
export function schoolTypeLabel(type: string | null | undefined): string {
  return SCHOOL_TYPES.find((t) => t.value === type)?.label ?? "学校";
}
