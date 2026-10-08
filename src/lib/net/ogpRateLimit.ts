/**
 * ★OGP 取得の2本（`/api/jobseeker/ogp-fetch`・`/api/jobseeker/content-links/ogp`）の回数制限。
 *   **利用者ごと**（`auth.users.id`）に1分あたり20回（2026-10-09 / 柴さんの指示）。
 *
 * ⚠️ ほかの API は**時間あたり**で、しかも **IP ごと**（`checkRateLimit` の既定）:
 *      投稿 30/時 ・ DM の開始 20/時 ・ 応募 10/時 ・ 面談申込 10/時 ・ 企業向け問い合わせ 5/時
 *    OGP は URL を貼るたび・投稿のたびに呼ばれる補助の取得なので、分単位で少し緩く取ってある。
 * ⚠️ 2本で値を書き分けないこと（ここ1か所）。prefix は API ごとに分けて数える。
 */
export const OGP_RATE_LIMIT = { limit: 20, windowSec: 60 } as const;
