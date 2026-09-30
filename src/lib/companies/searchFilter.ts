import { normalizeCompanyName } from "./normalizeName";

/**
 * 企業を名前で引くときの PostgREST `.or()` 文字列を作る。**検索3経路の共有**。
 *
 * ⚠️★★**検索できる場所は3つある。3つともここを通すこと**（CLAUDE.md 2026-08-20）:
 *      ・`/api/companies/lookup`  … 職歴の企業ピッカー
 *      ・`/api/companies/search`  … `/biz` の重複チェック
 *      ・`/api/search/suggest`    … ヘッダーのサジェスト
 *    **1つ直すと他が取り残される**、を実際に3回踏んでいる。列を足すならここに1回。
 *
 * ── 何を見るか ──────────────────────────────────────────────────────────────
 * ① 打った文字そのまま … name / name_en / brand_name / slug / search_aliases
 * ② ★正規化どうし      … `search_key`（`normalize_company_name()` で作った列）
 *
 * ②があるおかげで**入力の揺れ**が吸収される。実測（2026-10-01 / 本番）:
 *   せーるすふぉーす（ひらがな）／ セールスフォースジャパン（中黒なし）／
 *   ｾｰﾙｽﾌｫｰｽ（半角カナ）／ ＳＡＬＥＳＦＯＲＣＥ（全角）… **①だけだと全部0件。**
 *
 * ⚠️ ①も残す。`search_key` は法人格を落とすので、
 *    「株式会社」だけで引きたい場面（重複チェック）を①が受ける。
 *
 * ⚠️★**読みの揺れは吸収できない。**「スノーフレ**イ**ク」と「スノーフレ**ー**ク」は
 *    音が違うので正規化では畳めない。**`search_aliases` に両方書く運用**で受ける。
 */
export function companyNameOrFilter(rawQuery: string): string {
  /* ⚠️ `.or()` は `,` と `()` で構文が決まるので**先に落とす**。
        エスケープでは足りない（PostgREST に構文エラーを投げさせることになる）。
     ⚠️ `%` `_` は ILIKE のパターン文字なのでエスケープする。 */
  const strip = (s: string) => s.replace(/[(),]/g, "");
  const esc = (s: string) => s.replace(/%/g, "\\%").replace(/_/g, "\\_");

  const raw = esc(strip(rawQuery));
  const parts = [
    `name.ilike.%${raw}%`,
    `name_en.ilike.%${raw}%`,
    `brand_name.ilike.%${raw}%`,
    `slug.ilike.%${raw}%`,
    /* 読み仮名（2026-08-21）。画面には出さない */
    `search_aliases.ilike.%${raw}%`,
  ];

  /* ⚠️ 正規化して**空になる**入力（「株式会社」「・・・」など）では足さない。
        足すと `%%` になって全件に当たる。 */
  const normalized = normalizeCompanyName(rawQuery);
  if (normalized) parts.push(`search_key.ilike.%${esc(strip(normalized))}%`);

  return parts.join(",");
}
