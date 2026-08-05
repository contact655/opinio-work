/**
 * フィード投稿の本文を表示用に整える。
 *
 * ⚠️ DB の ow_posts.content は書き換えない。表示側だけの処理。
 *    一覧・パーマリンク・埋め込みのすべてがこの関数を通ること。
 *    片方だけ通すと、同じ投稿が場所によって違う文面になる。
 */

/** 主語を落とす対象。記事とユーザー投稿は actor が企業ではないので対象外 */
const STRIPPABLE = new Set(["company_joined", "job_posted"]);

/**
 * actor を企業にすると、actor 行と本文で社名が二重になる。
 *
 *   [株式会社SmartHR ・企業]  株式会社SmartHRが「〇〇」の募集を開始しました。
 *   →
 *   [株式会社SmartHR ・企業]  「〇〇」の募集を開始しました。
 *
 * ⚠️ 完全一致したときだけ削る。本文の社名は backfill 時の表記で、
 *    ow_companies の表記とズレていることがある
 *    （例: 本文「Salesforce」/ name「株式会社セールスフォース・ジャパン」）。
 *    推測で削ると別の社名を切り落としかねないので、一致しなければ何もしない。
 *
 * ⚠️ 候補は「表示に使う名前」と「マスタの正式名」の両方を見る。
 *    backfill も生成コードも `brand_name ?? name` で本文を作っているので
 *    通常は前者で当たるが、brand_name が後から入った企業のために両方試す。
 *
 * @param content   ow_posts.content
 * @param postType  ow_posts.post_type
 * @param actorNames actor 企業の名前候補（brand_name, name の順）
 */
export function stripActorPrefix(
  content: string,
  postType: string,
  actorNames: (string | null | undefined)[],
): string {
  if (!STRIPPABLE.has(postType)) return content;

  for (const raw of actorNames) {
    const name = raw?.trim();
    if (!name) continue;
    const prefix = `${name}が`;
    if (!content.startsWith(prefix)) continue;
    const rest = content.slice(prefix.length).trim();
    // 削った結果が空になるなら触らない（本文が主語だけだったケース）
    if (!rest) return content;
    return rest;
  }
  return content;
}
