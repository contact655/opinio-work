import { createClient } from "@/lib/supabase/server";

/**
 * `/admin` 配下の**ページ本体**が、自分で運営権限を確かめるための判定（2026-09-18）。
 *
 * ── ★なぜページ側にも要るのか ───────────────────────────────────────────────
 * `admin/layout.tsx` のガードだけでは**データが漏れる。**
 *
 * App Router は**レイアウトとページを並行して描画する**。レイアウトが
 * `auth_is_admin()` を見て `children` を捨て「権限がありません」を返しても、
 * **ページ本体は実行され、その props が RSC フライトデータとして HTML の
 * `<script>` に載る。** 画面には出ないが、HTML を見れば読める。
 *
 * 実測（2026-09-18 / 運営権限の無い `is_test` セッションで本番を curl）:
 *
 *   /admin/placements           実ユーザーの氏名 9 / 非掲載企業の社名 40
 *   /admin/companies            氏名 2 / 社名 40
 *   /admin/candidates           氏名 9
 *   /admin/ambassador-requests  氏名 5
 *   /admin                      氏名 1 / 社名 5
 *
 * ⚠️★**レイアウトのガードは残して二重にする。** こちらは「データを取らない」ため、
 *    あちらは「画面を出さない」ため。役割が違う。
 *
 * ── ★`isAdmin()`（lib/auth/isAdmin.ts）を使わない理由 ───────────────────────
 * あちらは `auth_is_admin()` に加えて **`ADMIN_EMAILS` 環境変数**も見る。
 * 一方 `admin/layout.tsx` は **`auth_is_admin()` だけ**を見ている。
 * ここで `isAdmin()` を使うと、**`ADMIN_EMAILS` にだけ載っている人**が
 * 「ページはデータを取るのにレイアウトは画面を出さない」状態になり、
 * **同じ漏れが復活する。**
 * ⚠️★**レイアウトと同じ述語であることが、この関数の唯一の要件。**
 *    `admin/layout.tsx` の判定を変えるときは、必ずここも一緒に変えること。
 *
 * ── 使い方 ──────────────────────────────────────────────────────────────────
 * ```ts
 * export default async function Page() {
 *   if (!(await viewerIsAdmin())) return null;   // 画面はレイアウトが出す
 *   const db = createAdminClient();              // ★ここから下で初めて DB を触る
 * ```
 * ⚠️★**DB を引く前に返すこと。** 引いてから捨てても、取得そのものは起きる。
 * ⚠️ `notFound()` にしない。レイアウトが出す「権限がありません」の案内
 *    （別のアカウントで入り直す導線）を消してしまう。
 */
export async function viewerIsAdmin(): Promise<boolean> {
  const { data, error } = await createClient().rpc("auth_is_admin");
  /* ⚠️ 握り潰さない。失敗は false に倒れる（fail-closed で正しい）が、
        落ちていることに気づけないのは別の問題（CLAUDE.md）。 */
  if (error) console.error("[adminPageGuard] auth_is_admin:", error.message);
  return !!data;
}
