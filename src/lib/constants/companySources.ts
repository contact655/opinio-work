/**
 * 企業データの出典（`ow_company_data_sources`）の語彙と鮮度のしきい値。
 *
 * ⚠️★**語彙は DB の CHECK と必ず揃える。** 値を足すときは3つとも直すこと
 *    （CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」）:
 *      ① この定数
 *      ② `ow_company_data_sources_field_check` / `..._kind_check`
 *      ③ 入力UI（まだ無い。作るときはここを import する）
 *    ⚠️ **route の中に `new Set([...])` を書かない。** 書いた瞬間に UI と割れる。
 *
 * ⚠️ この表は**運営専用**（RLS 有効・ポリシー無し・anon/authenticated に GRANT 無し）。
 *    読むのは admin クライアントだけ。求職者にも企業にも出さない。
 */

/** 出典を記録する対象の項目。⚠️ DB の `field` CHECK と同じ並び。 */
export const COMPANY_SOURCE_FIELDS = ["headquarters_address"] as const;
export type CompanySourceField = (typeof COMPANY_SOURCE_FIELDS)[number];

/**
 * 出所の種別。⚠️ DB の `source_kind` CHECK と同じ並び。
 *
 * ⚠️★`registry` と `official_site` は**意味が違う**。
 *    登記は「本店所在地」、公式サイトは「オフィス所在地（人がいる場所）」で、
 *    一致しないことがある。**同じ住所として扱わないこと。**
 */
export const COMPANY_SOURCE_KINDS = [
  "registry",       // 国税庁 法人番号公表サイト（登記上の本店所在地）
  "official_site",  // 各社の公式サイト（オフィス所在地）
  "company_input",  // 企業自身が入力した
  "unknown",        // 調べたが出所を特定できなかった
] as const;
export type CompanySourceKind = (typeof COMPANY_SOURCE_KINDS)[number];

export const COMPANY_SOURCE_KIND_LABELS: Record<CompanySourceKind, string> = {
  registry: "登記（国税庁）",
  official_site: "公式サイト",
  company_input: "企業の入力",
  unknown: "不明",
};

/**
 * 再確認の目安（日）。
 *
 * ⚠️ **求人（`ow_jobs.source_url`）とは別のしきい値**にしてある。
 *    設立年・資本区分・親会社・本社住所はまず変わらないため。
 * ⚠️ **画面にハードコードしないこと。** `DISCLOSURE_MAX` を表示側に直書きして
 *    取り残された前例がある（CLAUDE.md）。
 */
export const COMPANY_SOURCE_STALE_AFTER_DAYS = 365;

/** `verified_at` から見て再確認の目安を過ぎているか。⚠️ 未記録（null）は「古い」に倒さない。 */
export function isCompanySourceStale(verifiedAt: string | Date | null | undefined, now: Date = new Date()): boolean | null {
  if (!verifiedAt) return null;
  const t = verifiedAt instanceof Date ? verifiedAt : new Date(verifiedAt);
  if (Number.isNaN(t.getTime())) return null;
  return (now.getTime() - t.getTime()) / 86_400_000 > COMPANY_SOURCE_STALE_AFTER_DAYS;
}
