/**
 * ★保存する文字列の値を整える（2026-11-27 / 柴さんの指示）。
 *   前後の空白を除いて空なら null。それ以外は受け取った文字列をそのまま返す（中身は変えない）。
 *   文字列でないもの（数値・真偽値・配列・null）はそのまま返す。undefined も undefined のまま（＝その項目は触らない）。
 *
 * ⚠️ 運営の保存（PUT /api/admin/companies/[id]）と企業の公開（lib/companies/applyDraft.ts）の両方がここを通る。
 *    空の入力欄を "" のまま書いていたため、株式会社エージェントを1回保存しただけで null だった19列が "" になった。
 *    "" は表示側の `brand_name ?? name` などで「値がある」と読まれ、社名が消える（株式会社Opinio で起きていた）。
 * ⚠️ 何も import しない（テストから直接読む）。
 */
export function blankToNull<T>(v: T): T | null {
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}
