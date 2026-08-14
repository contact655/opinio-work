/**
 * 企業の「表示名」を作る。**一覧カード・カルーセル・詳細ページの h1 がここを共有する。**
 *
 * ── なぜ1箇所に集めたか（2026-08-13）────────────────────────────────────────
 * 同じ処理が3箇所に別実装で存在し、**ルールが割れていた**。
 *
 * | 実装 | 末尾 " Japan" の除去 | 法人格の除去 |
 * |---|---|---|
 * | `CompanyCardList`（一覧） | **する** | する |
 * | `CompanyCardCompact`（カルーセル） | しない | **しない** |
 * | `companies/[id]/page.tsx` の h1 | しない | （name_en が無いとき素の name） |
 *
 * 結果、**同じ会社が一覧では「HPE」、詳細ページでは「HPE Japan」**と表示されていた。
 * カルーセルでは「株式会社PKSHA Technology」が法人格ごと出ていた。
 *
 * ── 決めたルール ────────────────────────────────────────────────────────────
 * ・末尾の " Japan" は**除去する**。企業名として読ませたいのはブランド名のため
 * ・法人格（株式会社・合同会社・有限会社の前置／後置）は**除去する**
 * ・正式名称は h1 の副題とサイドバーに出るので、短い名前にしても情報は失われない
 *
 * ⚠️ **新しく企業名を表示する箇所を作るときは、必ずここを通すこと。**
 *    正規表現をコピーして持っていくと、また割れる。
 */

/**
 * 英語社名（`ow_companies.name_en`）から法人格と末尾の " Japan" を落とす。
 *
 * ⚠️ 末尾の " Japan" は**法人格を落としたあとに**判定する。
 *    「Salesforce Japan Co., Ltd.」→「Salesforce」まで1回で到達させるため。
 *
 * @returns 値が無い／削り切って空になった場合は null（呼び出し側は日本語名に倒す）
 */
export function cleanEnName(nameEn: string | null | undefined): string | null {
  if (!nameEn) return null;
  const cleaned = nameEn
    .replace(/\s+Japan\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s*,\s*Inc\.?$/i, "")
    .replace(/\s+Inc\.?$/i, "")
    .replace(/\s+Corp(?:oration)?\.?$/i, "")
    .replace(/\s+Japan$/i, "")
    .trim();
  return cleaned || null;
}

/** 日本語社名から法人格（前置・後置）を落とす。 */
export function stripLegalSuffix(name: string): string {
  return name
    .replace(/^株式会社\s*/, "")
    .replace(/\s*株式会社$/, "")
    .replace(/^合同会社\s*/, "")
    .replace(/\s*合同会社$/, "")
    .replace(/^有限会社\s*/, "")
    .replace(/\s*有限会社$/, "")
    .trim();
}

/**
 * 表示名。英語社名があればそれを、無ければ法人格を落とした日本語名を返す。
 *
 * ⚠️ 削り切って空になる名前（「株式会社」だけ等）では素の name に倒す。
 *    空文字を表示して名前が消えるのを防ぐため。
 */
export function companyDisplayName(
  name: string,
  nameEn: string | null | undefined,
): { displayName: string; isEnName: boolean } {
  const en = cleanEnName(nameEn);
  if (en) return { displayName: en, isEnName: true };
  const ja = stripLegalSuffix(name);
  return { displayName: ja || name, isEnName: false };
}

/**
 * `ow_companies.brand_name` の既定値を社名から作る。
 *
 * ⚠️ **新規作成時にだけ使う。** 既存87社への一括 UPDATE はしない
 *    （CLAUDE.md「全社一括の UPDATE を禁止／推測値を投入しない」）。
 *    表示は `companyDisplayName()` が name_en から作るので、既存分は既に揃っている。
 *
 * ⚠️ **機械的に法人格を落とすだけ。** これで足りない会社は人が直す前提
 *    （例：「日本ヒューレット・パッカード合同会社」→ ここでは
 *    「日本ヒューレット・パッカード」。ブランドの「HPE」にはならない）。
 *
 * @returns 削り切って空になる場合は null（空文字を入れて名前を消さない）
 */
export function deriveBrandName(name: string | null | undefined): string | null {
  if (!name) return null;
  const stripped = stripLegalSuffix(name);
  return stripped && stripped !== name.trim() ? stripped : (stripped || null);
}
