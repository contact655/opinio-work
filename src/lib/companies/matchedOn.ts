/**
 * 企業名の重複照合が「どの列で一致したか」（`find_companies_by_normalized_name.matched_on`）。
 *
 * ⚠️★**値をそのまま画面に出さないこと。** `brand_name` `search_aliases` は実装語で、
 *    利用者にも運営にも意味が伝わらない（CLAUDE.md「`phase` の生値がそのまま出ていた」と同じ形）。
 *    **必ずこの関数で文言に畳んでから出す。**
 *
 * ⚠️ DB 側の語彙と1対1。**値を足すときは migration とここを同じコミットで動かす**
 *    （CLAUDE.md「選択肢が決まっている値は UI / API / DB の3つを揃える」）。
 */

export const COMPANY_MATCH_SOURCES = [
  "name",
  "brand_name",
  "name_en",
  "search_aliases",
] as const;

export type CompanyMatchSource = (typeof COMPANY_MATCH_SOURCES)[number];

/** 運営向け（`/admin` と運営メール）。どの列か分かる言い方にする */
const ADMIN_LABELS: Record<CompanyMatchSource, string> = {
  name: "正式名称",
  brand_name: "ブランド名",
  name_en: "英語名",
  search_aliases: "読み仮名",
};

/**
 * 利用者向け（「もしかして、この会社ですか？」）。
 * ⚠️ 列の名前を出さない。**なぜ候補に出たのかが伝わる言い方**にする。
 * ⚠️ `name` のときは何も出さない —— 名前が一致したことは見れば分かる。
 *    書くと当たり前のことを説明する行が増えるだけ。
 */
const USER_LABELS: Partial<Record<CompanyMatchSource, string>> = {
  brand_name: "ブランド名が一致",
  name_en: "英語名が一致",
  search_aliases: "読み方が一致",
};

export function companyMatchLabelForAdmin(matchedOn: string | null): string {
  if (!matchedOn) return "不明";
  return (ADMIN_LABELS as Record<string, string>)[matchedOn] ?? matchedOn;
}

/** 一致理由を利用者に出す。`name` と未知の値では **null**（行ごと出さない） */
export function companyMatchLabelForUser(matchedOn: string | null): string | null {
  if (!matchedOn) return null;
  return (USER_LABELS as Record<string, string | undefined>)[matchedOn] ?? null;
}
