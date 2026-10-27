/**
 * ★お知らせ（参加しました・募集の公開・記事）をフィードの真ん中に混ぜるか（2026-10-28 / 柴さんの決定）。
 *
 *   閲覧者に見える「人が書いた投稿」がしきい値未満のあいだは、お知らせも真ん中の流れに時系列で混ぜる
 *   （人の投稿が少ないうちは、真ん中が空になって「何も無い」と読まれるため）。しきい値以上になったら、
 *   お知らせは右の箱（スマホは差し込み）へ自動で切り替わる。
 *   ⚠️ 真ん中に出しているあいだは、右の「新しく掲載された企業」「新着の募集」「取材記事」の箱は重複するので出さない。
 *   ⚠️ 何を「見える」とするかは isPostVisibleTo（lib/feed/visibility.ts）の判定のまま。検証用を指す投稿の判定もそこで効く。
 *
 * 純粋な関数と定数だけ（何も import しない。node のテストから読む）。
 */

/** ★人が書いた投稿がこの件数未満なら、お知らせを真ん中に混ぜる。⚠️ 変えるときはここだけ */
export const HUMAN_POST_THRESHOLD_FOR_ANNOUNCEMENTS = 10;

/** お知らせの種類（真ん中に混ぜる／箱に分ける対象） */
export const ANNOUNCEMENT_POST_TYPES = ["company_joined", "job_posted", "article_published"] as const;

export function announcementsInStream(visibleHumanPostCount: number, threshold = HUMAN_POST_THRESHOLD_FOR_ANNOUNCEMENTS): boolean {
  return visibleHumanPostCount < threshold;
}
