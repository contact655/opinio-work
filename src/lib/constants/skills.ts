/**
 * 標準スキル（`ow_skills`）の区分と上限（2026-08-27）。
 *
 * ⚠️ **選択肢を UI / API に書き写さない。** ここを通す
 *    （CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。
 *    DB 側は `ow_skills.category` の CHECK が同じ3値を持っている。
 *
 * ⚠️ `sales_domain` は**売り先の業界**。`ow_business_domains`（企業の事業領域）とは
 *    **別物**。`domain` と呼ぶと必ず混同されるので、この綴りを変えないこと。
 */

export const SKILL_CATEGORIES = [
  { value: "product",      label: "プロダクト・ツール" },
  { value: "method",       label: "手法・型" },
  { value: "sales_domain", label: "売り先の業界" },
] as const;

export const SKILL_CATEGORY_VALUES: string[] = SKILL_CATEGORIES.map((c) => c.value);

/** ⚠️ 知らない値は null。**生の値（`product` 等）を画面に出さない。** */
export function skillCategoryLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  return SKILL_CATEGORIES.find((c) => c.value === v)?.label ?? null;
}

/** 並び順。⚠️ `ow_skills.category` の CHECK と同じ3値を、表示したい順に並べたもの */
export function skillCategoryRank(v: string): number {
  const i = SKILL_CATEGORY_VALUES.indexOf(v);
  return i < 0 ? SKILL_CATEGORY_VALUES.length : i;
}

/**
 * 1人が持てる標準スキルの上限。
 *
 * ⚠️ **担保するのは UI と API の2層だけ。DB のトリガーは足さない。**
 *    これは「値の集合」ではなく「行数（濃度）」の制約で、
 *    1スキル1行の表では CHECK で書けずトリガーが要る。
 *    破られても事故にならず（識別力が落ちるだけ）、
 *    トリガーは後から読む人が気づけない隠れた挙動になるため、そこまでしない。
 *    → CLAUDE.md「この規約の適用範囲 —— 『値の集合』の制約だけ」
 */
export const MAX_USER_SKILLS = 15;
