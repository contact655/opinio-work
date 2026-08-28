-- ═══════════════════════════════════════════════════════════════════════════
-- anon が読める表から `ow_users` の副問い合わせを無くす（2026-08-28）
--
-- ── ゴール ──────────────────────────────────────────────────────────────────
-- 「**anon が読める表**の SELECT 系ポリシーで `ow_users` を副問い合わせしているもの」を
-- **0 にする。** これが片付くと `REVOKE SELECT ON ow_users FROM anon` の前提が揃う
-- （docs/todo.md「`ow_users` を副問い合わせしているポリシーを…」）。
--
-- 2026-08-19 に anon の露出を塞いだときは「列単位 GRANT に置き替える」案を採った。
-- ⚠️ ポリシー式は**実行ユーザーの権限で評価される**（PostgreSQL: CREATE POLICY / Notes）ので、
--    素朴に `REVOKE SELECT ON ow_users FROM anon` すると、
--    **ow_users を副問い合わせしているポリシーを持つ表が anon から丸ごと 401 になる。**
--
-- 2026-08-28 の `20260828080000` で「式が ow_users の副問い合わせ**だけ**」の8本を
-- `auth_ow_user_id()` に置き換えた。**残っていた7本**をこの migration で片付ける。
--
-- ── ★7本を2通りに分けた。理由が違うので同じ手を当てない ────────────────────
--
-- 【1】`ow_company_posts` … **anon から権限を剥がせない**
--   同じ表に `public_read_published_posts`（`is_published = true` / FOR SELECT / 全ロール）
--   があり、**anon が公開投稿を読むのは意図どおり**。実測でも anon に 1件返っていた。
--   → **ポリシーの式のほうを書き換える。**
--
-- 【2】残り6表 … **そもそも anon が読む必要が無い**
--   `ow_casual_meetings` / `ow_conversations` / `ow_conversation_messages` /
--   `ow_conversation_participants` / `ow_job_applications` / `ow_matches`
--   実測（2026-08-28）: **anon には全部 200 / 0件**。
--   src を全ファイル調べたが、**anon クライアント（`createPublicClient`）でも
--   ブラウザクライアントでも触っている箇所は 1つも無い**（admin か認証済みセッションのみ）。
--   → **式を直すより、権限を剥がすほうが安全で確実。**
--
-- 【3】`ow_message_reads` … **巻き添えの1件**
--   `ow_message_reads_select` が `ow_conversation_participants` を副問い合わせしている。
--   ⚠️ 6表だけ剥がすと、**この表が anon から 401 になる**（CLAUDE.md の
--      「剥がす前に、その表を参照しているポリシーを数える」がまさにこれ）。
--   実測: **src からの参照 0件**（アプリが一度も使っていない）。**一緒に剥がす。**
--   ⚠️ さらに先の連鎖は無いことを確認済み（`ow_message_reads` を参照する
--      anon 可読の表は 0）。
--
-- ── ★`auth_is_company_admin()` を使わない理由（ここを間違えると人が締め出される）──
-- 既存の `auth_is_company_admin(company_id)` は **`permission = 'admin'` を追加で要求する**。
-- いま置き換える `company_admin_all` は **`is_active` だけ**を見ている。
-- 実測（2026-08-28）: `ow_company_admins` は admin 10（有効）/ admin 1（無効）/
-- **member 1（有効）**。`auth_is_company_admin()` に寄せると、**その member が
-- 自社の投稿を触れなくなる。** **権限の意味が変わる置換は「言い換え」ではない。**
-- → **`is_active` だけを見る別の関数**を新しく作る。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   .dumps/20260828-rls-before-revoke.txt に ACL と旧ポリシー定義、戻す SQL を置いた。
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── ① 前提の確認 ───────────────────────────────────────────────────────────
DO $$
DECLARE v_blocking int; v_member int;
BEGIN
  -- ★いま「anon が読める表 × ow_users を副問い合わせする SELECT 系ポリシー」が7本あること
  SELECT count(*) INTO v_blocking
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relnamespace='public'::regnamespace
     AND p.polcmd IN ('r','*')
     AND (p.polroles = '{0}'::oid[] OR 'anon'::regrole = ANY(p.polroles))
     AND has_table_privilege('anon', c.oid, 'SELECT')
     AND pg_get_expr(p.polqual, p.polrelid) ~ '\mow_users\M';
  IF v_blocking <> 7 THEN
    RAISE EXCEPTION '対象が % 本（7 のはず）。前提が違う。中止', v_blocking;
  END IF;

  -- ★`permission='admin'` ではない有効な管理者が実在すること（＝寄せてはいけない証拠）
  SELECT count(*) INTO v_member FROM public.ow_company_admins
   WHERE is_active = true AND permission IS DISTINCT FROM 'admin';
  RAISE NOTICE '適用前: 対象ポリシー % 本 / admin 以外の有効な管理者 % 名', v_blocking, v_member;
END $$;

-- ── ② `is_active` だけを見る SECURITY DEFINER 関数 ─────────────────────────
/* ⚠️ **`auth_is_company_admin()` と混同しないこと。** あちらは permission='admin' を要求する。
      こちらは **is_active だけ**で、既存ポリシーの条件をそのまま関数にしたもの。
   ⚠️ `row_security = off` を付ける。付けないと関数の中でも RLS が効き、
      `ow_company_admins` / `ow_users` のポリシーに再帰的に引っかかる。
   ⚠️ `search_path` を固定する（SECURITY DEFINER の定石）。 */
CREATE OR REPLACE FUNCTION public.auth_is_active_company_admin(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.ow_company_admins ca
      JOIN public.ow_users ou ON ou.id = ca.user_id
     WHERE ou.auth_id = auth.uid()
       AND ca.company_id = p_company_id
       AND ca.is_active = true
  );
$$;

COMMENT ON FUNCTION public.auth_is_active_company_admin(uuid) IS
  '在籍が有効な企業管理者か（is_active のみ。⚠️ permission は見ない）。auth_is_company_admin() は permission=admin を追加で要求するので別物。混ぜないこと。';

REVOKE ALL ON FUNCTION public.auth_is_active_company_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_active_company_admin(uuid) TO anon, authenticated, service_role;

-- ── ③ ow_company_posts のポリシーを置き換える（意味は変えない）─────────────
DROP POLICY IF EXISTS company_admin_all ON public.ow_company_posts;
CREATE POLICY company_admin_all ON public.ow_company_posts
  FOR ALL
  USING      (public.auth_is_active_company_admin(company_id))
  WITH CHECK (public.auth_is_active_company_admin(company_id));

/* ⚠️ `public_read_published_posts`（is_published = true / FOR SELECT / 全ロール）は
      **触っていない。** anon が公開投稿を読む経路はここ。消さないこと。 */

-- ── ④ anon が読む必要の無い表から SELECT を剥がす ──────────────────────────
/* ⚠️ **`authenticated` からは剥がさない。** 運営も authenticated ロールで来るので、
      剥がすと RLS まで到達せず運営でも読めなくなる（CLAUDE.md / 2026-08-16 に実際に踏んだ）。 */
REVOKE SELECT ON public.ow_casual_meetings           FROM anon;
REVOKE SELECT ON public.ow_conversations             FROM anon;
REVOKE SELECT ON public.ow_conversation_messages     FROM anon;
REVOKE SELECT ON public.ow_conversation_participants FROM anon;
REVOKE SELECT ON public.ow_job_applications          FROM anon;
REVOKE SELECT ON public.ow_matches                   FROM anon;
REVOKE SELECT ON public.ow_message_reads             FROM anon;   -- ★巻き添えの1件

-- ── ⑤ 事後の検証。★「エラーが出なかった」を成功にしない ────────────────────
DO $$
DECLARE
  v_blocking int; v_anon int; v_auth int; v_posts_anon boolean; v_fn int;
BEGIN
  -- ★これがこの migration の目的。0 でなければ中止
  SELECT count(*) INTO v_blocking
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relnamespace='public'::regnamespace
     AND p.polcmd IN ('r','*')
     AND (p.polroles = '{0}'::oid[] OR 'anon'::regrole = ANY(p.polroles))
     AND has_table_privilege('anon', c.oid, 'SELECT')
     AND pg_get_expr(p.polqual, p.polrelid) ~ '\mow_users\M';
  IF v_blocking <> 0 THEN
    RAISE EXCEPTION 'まだ % 本残っている。中止', v_blocking;
  END IF;

  -- ★7表から anon の SELECT が消えたこと
  SELECT count(*) INTO v_anon FROM unnest(ARRAY[
    'ow_casual_meetings','ow_conversations','ow_conversation_messages',
    'ow_conversation_participants','ow_job_applications','ow_matches','ow_message_reads'
  ]) t WHERE has_table_privilege('anon', ('public.'||t)::regclass, 'SELECT');
  IF v_anon <> 0 THEN RAISE EXCEPTION 'anon がまだ % 表を読める。中止', v_anon; END IF;

  -- ★★authenticated は1つも失っていないこと（ここを落とすと運営まで読めなくなる）
  SELECT count(*) INTO v_auth FROM unnest(ARRAY[
    'ow_casual_meetings','ow_conversations','ow_conversation_messages',
    'ow_conversation_participants','ow_job_applications','ow_matches','ow_message_reads'
  ]) t WHERE has_table_privilege('authenticated', ('public.'||t)::regclass, 'SELECT');
  IF v_auth <> 7 THEN RAISE EXCEPTION 'authenticated が % 表しか読めない（7 のはず）。中止', v_auth; END IF;

  -- ★ow_company_posts は anon から読めるまま（公開投稿の経路を壊していない）
  v_posts_anon := has_table_privilege('anon', 'public.ow_company_posts'::regclass, 'SELECT');
  IF NOT v_posts_anon THEN RAISE EXCEPTION 'ow_company_posts を anon から剥がしてしまった。中止'; END IF;

  -- ★2つのポリシーが揃っていること
  SELECT count(*) INTO v_fn FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relname = 'ow_company_posts' AND c.relnamespace='public'::regnamespace
     AND p.polname IN ('company_admin_all','public_read_published_posts');
  IF v_fn <> 2 THEN RAISE EXCEPTION 'ow_company_posts のポリシーが % 本（2 のはず）。中止', v_fn; END IF;

  RAISE NOTICE '完了: 対象ポリシー % 本 / anon 可読 % 表 / authenticated 可読 % 表',
    v_blocking, v_anon, v_auth;
END $$;

COMMIT;
