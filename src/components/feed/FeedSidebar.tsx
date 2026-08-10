/*
 * フィードのサイドバーで使う型。
 *
 * ⚠️ 同名の `FeedSidebar` コンポーネントは `feed/(list)/FeedClient.tsx` の中に
 *    別途あり、そちらが実際に描画している。ここに描画部品を戻さないこと
 *    （2026-08-09 に、使われていなかった描画部品を削除した）。
 */

export type SidebarJob = {
  id: string;
  title: string;
  companyName: string;
  dept: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  workStyle: string | null;
  logoUrl: string | null;
  logoGradient: string | null;
  logoLetter: string | null;
};
