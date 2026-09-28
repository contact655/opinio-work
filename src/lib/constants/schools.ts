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
  { value: "kindergarten",    label: "幼稚園・こども園" },
  { value: "elementary",      label: "小学校" },
  { value: "junior_high",     label: "中学校" },
  { value: "highschool",      label: "高等学校" },
  { value: "vocational",      label: "専門学校" },
  { value: "college",         label: "短期大学・高専" },
  { value: "university",      label: "大学" },
  { value: "graduate_school", label: "大学院" },
] as const;

export type SchoolType = (typeof SCHOOL_TYPES)[number]["value"];

/**
 * ⚠️★**`kindergarten` のラベルは「幼稚園・こども園」。「保育園」と書かないこと**（2026-09-28）。
 *
 * 文部科学省の学校コードは**幼稚園（A1）と幼保連携型認定こども園（A2）まで**で、
 * **保育所は1件も入っていない**（こども家庭庁の管轄で、この表に無い）。
 * ラベルに「保育園」と書くと、**マスタに無いものを選べるかのように見える。**
 *
 * ⚠️ 保育園出身の人は自由入力になる。`ow_user_educations.school` は text（NOT NULL）で
 *    `school_id` は nullable なので、**マスタに無い園でも保存でき、プロフィールに出る。**
 *
 * ⚠️ このラベルが画面に出るのは **`/schools/[id]` の見出しだけ**（2026-09-28 実測）。
 *    学歴の入力欄が選ばせるのは `ow_user_educations.degree` で、**別の項目**。混同しないこと。
 */

/** ⚠️ 値が引けないときは「学校」。**推測で別の種別に丸めないこと** */
export function schoolTypeLabel(type: string | null | undefined): string {
  return SCHOOL_TYPES.find((t) => t.value === type)?.label ?? "学校";
}

/**
 * 学校名の候補を引くときの上限（`EducationForm` の datalist）。
 *
 * ⚠️★★**全件を引く形に戻さないこと**（2026-09-28 に実際に壊した）。
 *    2026-09-28 に高校 5,154件を投入したところ、**PostgREST の `max-rows`（1000）**で
 *    切られ、名前順で1000位より後ろにあった**大学25校が候補から消えた**
 *    （東京大学・早稲田大学・慶應義塾大学・大阪大学・東北大学ほか）。
 *    ⚠️ **status は 200。エラーもコンソールも出ない。**「候補に出ない」だけ。
 *    ⚠️ それまでは37件だったので、全件取得でも成立していた。
 *       **器（マスタ）を増やすと、取得の仕方が壊れる**という形。
 */
export const SCHOOL_SUGGEST_LIMIT = 50;

/**
 * 候補を引き始める最短の文字数。
 *
 * ⚠️ **1文字にしてある。** 「灘」のように1文字が意味を持つ校名があるため。
 *    ⚠️ 「高」のような頻出文字では上限で切られるが、**利用者は文字を足せる**ので害は小さい。
 *    ⚠️ 企業の `lookup`（2文字）と揃えていないのは意図的。あちらは
 *       「名前を引ける以上のことをさせない」ための下限で、目的が違う。
 */
export const MIN_SCHOOL_QUERY_LENGTH = 1;

/**
 * 候補（datalist）の `<option label>` に出す補助文字。**`value` は校名のままにする。**
 *
 * ⚠️★**廃止の印を消さないこと**（2026-09-28）。廃止校 193校を意図して入れてあるので、
 *    印が無いと現役校と見分けられない（「東京都立第四商業高等学校」など名前からは分からない）。
 * ⚠️ 都道府県を入れているのは**同名の別校**を見分けるため。高校には同名が24組ある。
 *    ⚠️★**うち11組は都道府県まで同じ**なので、これでも見分けられない組が残る。
 * ⚠️ 既存の大学（37件のうち）は `prefecture` を持たないので**何も出ない**。それが正しい
 *    （推測で県を入れない）。
 */
export function schoolOptionLabel(s: {
  prefecture: string | null;
  closed_at: string | null;
}): string | undefined {
  const parts = [s.prefecture, s.closed_at ? "廃止" : null].filter(Boolean);
  return parts.length ? parts.join("・") : undefined;
}
