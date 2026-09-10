/**
 * 会社名の公開範囲（`ow_experiences.visibility_company`）。
 *
 * ⚠️★**DB の CHECK（`ow_experiences_visibility_company_check` 相当）と同じ3値。**
 *    片方だけ増やすと「選べるのに保存できない」か「保存できるのに絞れない」になる
 *    （CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。
 *
 * ⚠️★**2026-09-11 に `visibility_company_profile` をここへ畳んだ。**
 *    面ごとに「どう表示するか」は違ってよいが、「伏せるかどうか」の値は**1つ**。
 *    経緯は docs/visibility-company-two-columns-20260910.md。
 */
export const COMPANY_VISIBILITY_VALUES = ["real", "masked", "hidden"] as const;

export type CompanyVisibility = (typeof COMPANY_VISIBILITY_VALUES)[number];

/**
 * 選択肢のラベルと、**その値を選ぶと何がどう変わるか**。
 *
 * ⚠️★**「どこに出るか」ではなく「どう見えるか」を書くこと。** 読み手は6面あり、
 *    面の名前を並べても本人には分からない（`/mypage/settings` の3層の説明と役割が重なる）。
 * ⚠️ `masked` の実際の文字列は面によって違う（候補者検索は「非公開企業」、
 *    プロフィールは会社マスタから作る代替表示）。**画面ではその実物を添えること。**
 */
export const COMPANY_VISIBILITY_OPTIONS: {
  value: CompanyVisibility;
  label: string;
  desc: string;
}[] = [
  {
    value: "real",
    label: "会社名を出す",
    desc: "勤務先の会社名が、そのまま表示されます。企業ページの現役社員・OB/OG にも載ります。",
  },
  {
    value: "masked",
    label: "会社名を伏せる",
    desc: "会社名だけを伏せます。職種・役職・在籍期間は表示されます。",
  },
  {
    value: "hidden",
    label: "職歴ごと出さない",
    desc: "この職歴そのものを、あなた以外には表示しません。",
  },
];
