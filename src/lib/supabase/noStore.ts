/* ★サーバー専用（2026-10-09）。クライアントコンポーネントから（間接的にでも）読まれると
      **ビルドが落ちる**。`server-only` は Next に同梱されている（追加のインストールは不要）。
   ⚠️ 外さないこと。外すと、2026-10-09 に /mypage で起きた「admin クライアントの
      コードがブラウザ向けファイルに入る」が、気づけないまま戻る。 */
import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * RLS をバイパスし、**Next の fetch キャッシュにも載らない**管理クライアント。
 *
 * ── なぜ要るか（2026-08-06）────────────────────────────────────────────────
 * supabase-js は内部で `fetch` を使う。Next はその `fetch` をパッチして結果を
 * メモリと `.next/cache/fetch-cache` に保存するため、`createAdminClient()` の
 * 読み取りは**黙ってキャッシュされる**。
 *
 * ⚠️ ルートに `export const dynamic = "force-dynamic"` を書いてもこの層は止まらない。
 *    2026-08-06 に実際に踏んだ: 会社呼称を論理削除しても `deleted_at` が null のまま
 *    返り続け、dev サーバーを再起動して `.next/cache/fetch-cache` を消すまで直らなかった。
 *
 * ⚠️ `unstable_cache`（`getJobs` は revalidate 300 / `jobs/[id]` は 60）とは別の層。
 *    そちらは意図した鮮度契約なので残す。切りたいのは二重にかかっている fetch キャッシュだけ。
 *
 * 使い分け:
 *   - 運営や企業の操作が**すぐ画面に出てほしい**読み取り（職種タグ・会社呼称など）→ これ
 *   - それ以外 → `createAdminClient()`
 */
export function createNoStoreAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
