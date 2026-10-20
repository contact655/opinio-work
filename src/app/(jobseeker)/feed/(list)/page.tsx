import { Metadata } from "next";
import FeedClient from "./FeedClient";
import { loadFeedProps } from "./loadFeedProps";

export type { SidebarFollow, SidebarUserFollow, SidebarJob, SidebarCompany } from "./loadFeedProps";

export const metadata: Metadata = {
  /* ⚠️ **`| OPINIO` を自分で書くなら `absolute` にする。** ルートの
          `template: "%s | OPINIO"`（app/layout.tsx）が後ろに足すので、
          素の `title` に書くと **「… | OPINIO | OPINIO」** になる。実測で3ページ該当した。 */
  /* ⚠️ ナビの語と揃える（2026-10-01 に「投稿」から「ホーム」へ）。
        `/feed` はログイン後の既定の着地でもある（`DEFAULT_AFTER_LOGIN`）。 */
  title: { absolute: "ホーム | OPINIO" },
  description: "IT業界で働く人たちの投稿",
};

/* ★データの読み込みは loadFeedProps（2026-10-21 に切り出した。検索結果の左右の列も同じものを使う） */
export default async function FeedPage() {
  const props = await loadFeedProps();
  return <FeedClient {...props} />;
}
