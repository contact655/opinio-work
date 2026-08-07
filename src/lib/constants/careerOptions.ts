/**
 * 職歴・学歴の入力で使う許容値。**クライアントと API の両方がここを見る。**
 *
 * ── なぜ共通化したか（2026-08-07）────────────────────────────────────────────
 * 2026-07-01 の一括バリデーション追加（0735cfe7）で、API 側だけに許容値の
 * Set が書かれ、**クライアントの選択肢と食い違った**。
 *   API: 正社員 / 契約社員 / 業務委託 / アルバイト / インターン / その他
 *   UI : 正社員 / 契約社員 / **派遣社員** / 業務委託 / **アルバイト・パート** / その他
 * 「派遣社員」「アルバイト・パート」を選ぶと、API が**黙って null に落としていた**。
 * 同じコミットで学歴の日付形式も食い違い、1ヶ月以上 null に落ち続けた。
 *
 * ⚠️ 許容値を増やすときは、この1箇所を直せば両側に効く。
 *    API 側にだけ Set を書かないこと。
 */

/** 雇用形態。UI のセレクトと API の検証が共有する */
export const EMPLOYMENT_TYPES = [
  "正社員",
  "契約社員",
  "派遣社員",
  "業務委託",
  "アルバイト・パート",
  "その他",
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/**
 * 求人の雇用形態。**経歴側の EMPLOYMENT_TYPES とは意図的に違う。**
 *
 * ── なぜ分けるか（2026-08-07）──────────────────────────────────────────────
 *   求人 = 企業が「これから採る」形態。経歴 = 本人が「経験した」形態。
 *   ・「その他」は経歴には要る（過去の形態は多様）が、求人に出しても
 *     求職者に情報が無いので出さない
 *   ・「インターン」は求人にはあるが、経歴側の選択肢には元から無い
 *   ・「派遣社員」は経歴にはあるが、求人フォームには元から無い
 *
 * ⚠️ **分けてよいが、離して置かない。** 2026-08-07 以前は求人側が
 *    JobEditForm.tsx に、フィルタが JobsClient.tsx に直書きされていて、
 *    3つの語彙に割れていた（フィルタにしか無い「副業」で絞ると必ず0件、
 *    契約社員・インターン・アルバイト・パートは登録できるのに絞れない）。
 *    値を足すときは **UI / API / DB の CHECK の3つ**を揃えること
 *    （ow_jobs_employment_type_check）。
 */
export const JOB_EMPLOYMENT_TYPES = [
  "正社員",
  "業務委託",
  "契約社員",
  "インターン",
  "アルバイト・パート",
] as const;

export type JobEmploymentType = (typeof JOB_EMPLOYMENT_TYPES)[number];

export const VALID_JOB_EMPLOYMENT_TYPES = new Set<string>(JOB_EMPLOYMENT_TYPES);

/** 学位。UI のセレクトと API の検証が共有する */
export const DEGREES = [
  "小学校卒",
  "中学校卒",
  "高校卒",
  "専門卒",
  "短大卒",
  "学士",
  "修士",
  "博士",
  "その他",
] as const;

/** 企業名の公開範囲 */
export const COMPANY_VISIBILITIES = ["real", "masked", "hidden"] as const;
