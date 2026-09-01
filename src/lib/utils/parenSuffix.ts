/**
 * src/lib/utils/parenSuffix.ts
 *
 * `名前（補足）` を `{ name, sub }` に分ける。
 *
 * ⚠️★**この規則を各ファイルに書き写さないこと。** 2026-09-02 まで
 *    `ProductsClientsSection.tsx` の `parseProductName` にだけ同じ正規表現があり、
 *    福利厚生でも同じ形が必要になった。**割れると片方だけ直る形の不具合になる。**
 *
 * ⚠️ 全角括弧・半角括弧の両方を受ける。**末尾の1組だけ**を見る
 *    （文中の括弧は分解しない。「A（B）とC」は丸ごと name）。
 *
 * ── なぜ描画側で分けるか ──────────────────────────────
 * 福利厚生も主要製品も**企業の自由入力**で、括弧を使うかどうかを統制できない。
 * 実測（2026-09-02 / 福利厚生29件）: **59%に括弧があり、中身は「月1万円まで」
 * 「週2出社」のような判断に効く値**だった。データ側を直しても次にまた入る。
 *
 * ⚠️ **括弧内を捨てないこと。** `main_products` は `sub` を描画側で捨てており、
 *    「SmartHR（クラウド人事労務ソフト）」の説明が一度も出ていない（CLAUDE.md）。
 */
export function splitParenSuffix(raw: string): { name: string; sub: string | null } {
  const zen = raw.match(/^(.+?)（(.+?)）\s*$/);
  if (zen) return { name: zen[1].trim(), sub: zen[2].trim() };
  const han = raw.match(/^(.+?)\((.+?)\)\s*$/);
  if (han) return { name: han[1].trim(), sub: han[2].trim() };
  return { name: raw, sub: null };
}
