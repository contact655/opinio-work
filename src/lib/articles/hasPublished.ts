import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★公開中の記事が1本以上あるか（2026-10-22）。ヘッダー・フッター・メニューの「記事」を出すかどうかに使う。**サーバー専用。**
 *
 * 2026-10-20〜21 に見本の記事を全部非公開にしてから、「記事」を押すと空の一覧が開いていた。
 * 記事を公開すれば、コードを触らずに最大5分でナビに戻る。
 *
 * ⚠️ 取得に失敗したときは **true**（リンクを出す）に倒す。空の一覧に着くほうが、ナビが黙って消えるより害が小さい。
 * ⚠️ dev でも `is_published` で絞る（getArticles は dev では絞らないが、ナビは本番と同じ見え方にする）。
 * ⚠️ `unstable_cache` の中で no-store のクライアントを使わないこと（CLAUDE.md）。createAdminClient はよい。
 */
export const hasPublishedArticles = unstable_cache(
  async (): Promise<boolean> => {
    const { count, error } = await createAdminClient()
      .from("ow_articles")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true);
    if (error) {
      console.error("[hasPublishedArticles]", error.message);
      return true;
    }
    return (count ?? 0) > 0;
  },
  ["has-published-articles"],
  { revalidate: 300, tags: ["articles"] },
);
