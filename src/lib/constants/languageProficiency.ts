/**
 * 言語の習熟度（2026-08-24）。LinkedIn の「言語」に合わせた5段階。
 *
 * ⚠️ **UI / API / DB の CHECK を3つとも揃えること**（CLAUDE.md）。
 *    値を1つ足すときは、ここと
 *    `supabase/migrations/*_create_ow_user_languages.sql` の CHECK の両方を直す。
 *    片方だけだと「選べるのに保存できない」か「保存できるのに絞れない」になる。
 *
 * ⚠️ **画面に出す語と DB に入れる値を分ける。** 日本語ラベルをそのまま送らない
 *    （CLAUDE.md「`{value, label}` で持つ」）。
 *
 * ⚠️ 習熟度は**任意**。未選択は `null` で、画面には行ごと出さない。
 *    「初級」を既定値にしない（値が無いことを、ある値に置き換えない）。
 */
export const LANGUAGE_PROFICIENCIES = [
  { value: "native",       label: "ネイティブ・バイリンガル" },
  { value: "full",         label: "制限なく業務で使える" },
  { value: "professional", label: "業務で使える" },
  { value: "limited",      label: "限定的に業務で使える" },
  { value: "elementary",   label: "初級" },
] as const;

export type LanguageProficiency = (typeof LANGUAGE_PROFICIENCIES)[number]["value"];

/** API の検証用。⚠️ route の中に `new Set([...])` を書き写さないこと */
export const LANGUAGE_PROFICIENCY_VALUES: readonly string[] =
  LANGUAGE_PROFICIENCIES.map((p) => p.value);

/**
 * 表示用のラベル。
 * ⚠️ **知らない値は `null` を返す**（そのまま画面に出さない）。DB の CHECK を
 *    広げてここを直し忘れたときに、生の値が利用者に見えるのを防ぐ。
 */
export function languageProficiencyLabel(value: string | null): string | null {
  if (!value) return null;
  return LANGUAGE_PROFICIENCIES.find((p) => p.value === value)?.label ?? null;
}
