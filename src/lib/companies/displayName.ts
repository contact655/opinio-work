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
 * ⚠️ 表の `CompanyCardCompact` は **2026-08-28 に削除済み**（描画元が無い孤児だった）。
 *    上は当時の記録。いまの実装は一覧と詳細の2つ。
 *
 * 結果、**同じ会社が一覧では「HPE」、詳細ページでは「HPE Japan」**と表示されていた。
 * カルーセルでは「株式会社PKSHA Technology」が法人格ごと出ていた。
 *
 * ── 決めたルール ────────────────────────────────────────────────────────────
 * ・末尾の " Japan" は**除去する**。企業名として読ませたいのはブランド名のため
 * ・法人格（株式会社・合同会社・有限会社の前置／後置）は**除去する**
 * ・正式名称は h1 の副題とサイドバーに出るので、短い名前にしても情報は失われない
 *
 * ★2026-11-27 から、会社を見分ける場所は `companyBrandName()`、正式な名前が要る場所は `companyLegalName()`。
 *   （それまでの `companyDisplayName()` と `brandOrName()` はこの2つにまとめた。brand_name を優先する）
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
    /* ★略記（2026-10-11）。2026-10-11 時点で該当する社名は0件（実測）。⚠️ 落とすだけ。足さない */
    .replace(/^(?:（株）|\(株\)|㈱)\s*/, "")
    .replace(/\s*(?:（株）|\(株\)|㈱)$/, "")
    .trim();
}

/** 名前の材料。`brand_name` を select し忘れると undefined になり、ブランド名が無い会社として扱われる（型では気づけない） */
export type CompanyNameSource = {
  name: string;
  name_en?: string | null;
  brand_name?: string | null;
};

/**
 * ★ブランド名（2026-11-27 / 柴さんの判断）。**利用者が会社を見分ける場所はすべてこれ**
 *   （一覧・見出し・カード・フィード・検索・メッセージ・通知メール・運営画面の社名）。
 *   `brand_name` → 無ければ英語社名から法人格と「Japan」を外した名前 → 無ければ日本語社名から法人格を外した名前。
 *
 * ⚠️ 空・空白だけの brand_name は「値なし」として扱う（`??` は空文字を拾わないので、素で `brand_name ?? name` と書かない）。
 * ⚠️ 正式社名が要る場所（契約・請求・推薦状・企業情報の正式社名の行）は `companyLegalName()`。
 * ⚠️ select に `brand_name` と `name_en` を入れ忘れないこと。抜けると短い名前や正式社名に化けるだけで、エラーにならない。
 */
export function companyBrandName(c: CompanyNameSource): string {
  return companyBrandNameParts(c).name;
}

/**
 * `companyBrandName()` と同じ名前に、英字の名前かどうか（字間を詰めるため）を添える。
 * ⚠️ 名前の決め方を変えるときは `companyBrandName()` ではなくここを変える（companyBrandName はこれを呼ぶだけ）。
 */
export function companyBrandNameParts(c: CompanyNameSource): { name: string; isLatin: boolean } {
  const brand = c.brand_name;
  if (typeof brand === "string" && brand.trim() !== "") {
    return { name: brand, isLatin: /^[\x20-\x7E]+$/.test(brand) };
  }
  const en = cleanEnName(c.name_en);
  if (en) return { name: en, isLatin: true };
  const ja = stripLegalSuffix(c.name);
  return { name: ja || c.name, isLatin: false };
}

/**
 * ★正式社名（登記の名前。`ow_companies.name` そのもの）。
 *   使うのは正式な名前が要る場所だけ：企業詳細の見出しの下の正式社名・職歴の会社選びの候補に添える正式社名・
 *   運営向けメールなど。**会社を見分ける場所には使わない**（そこは `companyBrandName()`）。
 */
export function companyLegalName(c: Pick<CompanyNameSource, "name">): string {
  return c.name;
}

/**
 * `ow_companies.brand_name` の既定値を社名から作る。
 *
 * ⚠️ **新規作成時にだけ使う。** 既存87社への一括 UPDATE はしない
 *    （CLAUDE.md「全社一括の UPDATE を禁止／推測値を投入しない」）。
 *    表示は `companyBrandName()` が brand_name → name_en の順で作るので、空でも短い名前が出る。
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
