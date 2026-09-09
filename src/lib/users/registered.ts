/**
 * 「本人が登録しているユーザーか」の判定。**一覧・公開表示・人数カウントの除外に使う。**
 *
 * ── なぜ要るか（2026-09-10）────────────────────────────────────────────────
 * `ow_users` には **`auth_id` が NULL の行**が存在しうる。運営が履歴書などから
 * 先に作ったプロフィール（`supabase/migrations/archive/154_add_users_narifuji_komatsu.sql`）が
 * これで、**本人は一度もログインしておらず、利用規約への同意も経ていない。**
 * それでも `is_test=false` / `is_system=false` なので、従来の除外をすり抜けて
 * **ログイン中の利用者に氏名・職歴・所属企業が出ていた**（2026-09-10 に実測）。
 *
 * ⚠️★**個別の行を `visibility='private'` にする対処は採らなかった。** 1行の UPDATE は
 *    次に同じ経緯の行が生まれたときに効かない。**規約ではなく型と関数で担保する**
 *    （2026-08-19 に年齢で決めたのと同じ考え方）。
 *
 * ⚠️★**`auth_id` を SELECT に含めること。** 含めないと `undefined` になり、
 *    `isRegisteredUser` が**全員 false** を返して**一覧が丸ごと空になる。**
 *    型では気づけない（DB 行は `Record<string, any>` で来る）。
 *    ⚠️ 逆に `?? true` のような既定値で埋めないこと。「取得漏れ」を「登録済み」に
 *       化けさせることになる（CLAUDE.md「値が無いことを、ある値に置き換えない」）。
 *
 * ⚠️ `auth_id` は anon / authenticated とも SELECT できる（2026-09-10 実測）。
 *    列単位 GRANT に弾かれる心配は無い。
 *
 * ── 使っている場所（2026-09-10 時点で7箇所）────────────────────────────────
 *   1. `lib/people/directory.ts`            … `/people` の一覧
 *   2. `lib/search/companies.ts`            … `/companies` のカードの「現役社員 N名」
 *   3. `lib/supabase/queries.ts`            … `getCompaniesForList`（`/feed` の企業一覧の人数）
 *   4. `lib/supabase/queries.ts`            … `getJobPositionMembers`（求人ページの経験者）
 *   5. `lib/supabase/queries.ts`            … `getCompanyEmployees`（現役社員 / OB・OG）
 *   6. `lib/supabase/queries.ts`            … 面談対応者（ambassadors）
 *   7. `app/(jobseeker)/u/[id]/page.tsx`    … 公開プロフィール（**404 にする**）
 *
 * ⚠️★**8箇所目を作らないこと。** `ow_users` から人を出す経路を新しく足すときは、
 *    ここを呼ぶ。呼ばないと、登録していない人がその画面にだけ出る。
 *
 * ⚠️ **`is_test` / `is_system` の除外は集約していない**（7箇所すべてインラインの式のまま）。
 *    今回はこの新しい条件だけを関数にした。集約は別タスク（docs/todo.md）。
 */
export function isRegisteredUser(
  u: { auth_id?: string | null } | null | undefined,
): boolean {
  return !!u && u.auth_id != null;
}

/**
 * `ow_users` を埋め込みで引くときの最小列。
 * ⚠️ `isRegisteredUser` に渡すなら `auth_id` が要る。**足し忘れると全員が除外される。**
 */
export const REGISTERED_USER_COL = "auth_id";
