-- ow_users を副問い合わせしているポリシーを auth_ow_user_id() に置き換える（2026-08-28）
--
-- ── なぜやるか ──────────────────────────────────────────────────────────────
-- **ポリシー式は実行ユーザーの権限で評価される**（PostgreSQL: CREATE POLICY / Notes）。
-- 式の中で `ow_users` を副問い合わせしていると、**その表を読む権限が呼び出し側に要る**。
-- そのため 2026-08-19 に `ow_users` の anon 露出を塞いだとき、
-- `REVOKE SELECT ON ow_users FROM anon` を**選べなかった**（無関係な表が丸ごと403になる）。
-- 列単位 GRANT に置き替えて凌いだが、**anon の SELECT 権限そのものは残っている。**
--
-- `public.auth_ow_user_id()` は **SECURITY DEFINER / row_security=off / search_path 固定**で、
-- **anon も authenticated も EXECUTE できる**（実測）。所有者権限で走るので、
-- 呼ぶ側に `ow_users` の権限が要らなくなる。
--
-- ── ★対象は8本だけ。15本すべてではない ────────────────────────────────────
-- 「anon が SELECT できる表の SELECT/ALL ポリシーで、式が ow_users を参照するもの」は
-- **13表・15本**（2026-08-28 実測。2026-08-19 の記録は 15表・19本で、減っていた）。
-- そのうち**式が `ow_users` の副問い合わせ「だけ」の8本**を置き換える。
--
-- ⚠️★**残り7本は触らない。** 理由は下記。**「ついでに」揃えないこと。**
--
--   【B】`ow_company_admins` 経由の4本
--     ow_casual_meetings_company_read / ow_matches_company_read /
--     company_admin_all（ow_company_posts） / company_admins_read_applications
--     ⚠️ **`auth_is_company_admin()` に置き換えてはいけない。**
--        あの関数は **`permission = 'admin'` を追加で要求する**が、
--        この4本は **`is_active` だけ**を見ている。
--        実測（2026-08-28）: `ow_company_admins` は admin 10（有効）/ admin 1（無効）/
--        **member 1（有効）**。置き換えると**その member が面談・応募・マッチを
--        見られなくなる**。権限の意味が変わる置換は「同じことの言い換え」ではない。
--
--   【C】参加者判定と admin ロールの複合3本
--     ow_conversation_messages_select / ow_conversation_participants_select /
--     ow_conversations_select
--     ⚠️ `ow_conversation_participants` や `ow_company_admins` との結合が混ざっており、
--        `ow_users` の部分だけ置き換えても**表の権限要求は消えない**（結局 `ow_users` を
--        読む必要が残る枝がある）。**中途半端に置き換えると「直った」と誤認する。**
--
-- ⚠️ したがって **これを当てても `REVOKE SELECT ON ow_users FROM anon` はまだできない。**
--    できるようになるのは【B】【C】も片付いたとき。**この migration は前進であって完了ではない。**
--
-- ── 置き換えの原則 ──────────────────────────────────────────────────────────
-- **意味を変えない。** `x IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())` は
-- `x = auth_ow_user_id()` と等価（`auth_id` に UNIQUE があり、返る行は高々1行）。
-- ⚠️ 未ログインでは `auth.uid()` が NULL → 関数は NULL を返し、`x = NULL` は NULL
--    ＝行は通らない。**`IN (空集合)` が false になるのと同じ**で、挙動は変わらない。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   置き換え前の15本の定義: .dumps/20260828-policies-before.sql
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
--
-- ⚠️ **適用後に anon / 本人 / 第三者で実測すること。** catalog を見るだけでは足りない
--    （CLAUDE.md「RLS で弾かれても 403 ではない。200＋0件が返る」）。

BEGIN;

-- ── 適用前の確認 ────────────────────────────────────────────────────────────
DO $$
DECLARE v_n int; v_fn int;
BEGIN
  -- ★置き換え先の関数が使える形であること
  SELECT count(*) INTO v_fn FROM pg_proc
   WHERE pronamespace='public'::regnamespace AND proname='auth_ow_user_id'
     AND prosecdef AND has_function_privilege('anon', oid, 'EXECUTE');
  IF v_fn <> 1 THEN
    RAISE EXCEPTION 'auth_ow_user_id() が SECURITY DEFINER かつ anon 実行可でない。中止';
  END IF;

  -- ★対象の母集合が想定どおりであること（15本）
  SELECT count(*) INTO v_n
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relnamespace='public'::regnamespace AND p.polcmd IN ('r','*')
     AND (p.polroles = '{0}'::oid[] OR 'anon'::regrole = ANY(p.polroles))
     AND has_table_privilege('anon', c.oid, 'SELECT')
     AND pg_get_expr(p.polqual, p.polrelid) ~ '\mow_users\M';
  IF v_n <> 15 THEN
    RAISE EXCEPTION '対象ポリシーが % 本（15 のはず）。前提が違う。中止', v_n;
  END IF;
  RAISE NOTICE '適用前: 対象 15 本 / うち置き換えるのは 8 本';
END $$;

-- ① ow_bookmarks
drop policy if exists ow_bookmarks_own on public.ow_bookmarks;
create policy ow_bookmarks_own on public.ow_bookmarks
  as permissive for all to public
  using (user_id = public.auth_ow_user_id());

-- ② ow_casual_meetings（求職者本人）
drop policy if exists ow_casual_meetings_seeker_read on public.ow_casual_meetings;
create policy ow_casual_meetings_seeker_read on public.ow_casual_meetings
  as permissive for select to public
  using (user_id = public.auth_ow_user_id());

-- ③ ow_job_applications（本人）
drop policy if exists "users can read own applications" on public.ow_job_applications;
create policy "users can read own applications" on public.ow_job_applications
  as permissive for select to public
  using (user_id = public.auth_ow_user_id());

-- ④ ow_user_follows（with check も同じ式にする。元がそうだった）
drop policy if exists user_follows_own_manage on public.ow_user_follows;
create policy user_follows_own_manage on public.ow_user_follows
  as permissive for all to public
  using (follower_user_id = public.auth_ow_user_id())
  with check (follower_user_id = public.auth_ow_user_id());

-- ⑤ ow_notifications（元は = (SELECT ... LIMIT 1)）
drop policy if exists notifications_select_own on public.ow_notifications;
create policy notifications_select_own on public.ow_notifications
  as permissive for select to public
  using (recipient_user_id = public.auth_ow_user_id());

-- ⑥ ow_mentor_reservations（元は EXISTS）
--    ⚠️ この表は未使用（CLAUDE.md「メンター機能自体が無い」）。それでも
--       ポリシーが ow_users を参照している限り REVOKE の障害になるので揃える。
drop policy if exists "user can manage own reservations" on public.ow_mentor_reservations;
create policy "user can manage own reservations" on public.ow_mentor_reservations
  as permissive for all to public
  using (user_id = public.auth_ow_user_id())
  with check (user_id = public.auth_ow_user_id());

-- ⑦ ow_company_join_requests（元は auth.uid() = (SELECT auth_id ...)）
drop policy if exists "Users can view their own join requests" on public.ow_company_join_requests;
create policy "Users can view their own join requests" on public.ow_company_join_requests
  as permissive for select to public
  using (user_id = public.auth_ow_user_id());

-- ⑧ ow_user_recommendations（同上）
drop policy if exists recommendations_owner_read on public.ow_user_recommendations;
create policy recommendations_owner_read on public.ow_user_recommendations
  as permissive for select to public
  using (target_user_id = public.auth_ow_user_id());

-- ── 適用後の検証。★「エラーが出なかった」を成功にしない ────────────────────
DO $$
DECLARE v_left int; v_names text;
BEGIN
  SELECT count(*), string_agg(c.relname || '.' || p.polname, ', ') INTO v_left, v_names
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relnamespace='public'::regnamespace AND p.polcmd IN ('r','*')
     AND (p.polroles = '{0}'::oid[] OR 'anon'::regrole = ANY(p.polroles))
     AND has_table_privilege('anon', c.oid, 'SELECT')
     AND pg_get_expr(p.polqual, p.polrelid) ~ '\mow_users\M';

  -- ★15 - 8 = 7 本だけ残るはず（【B】4本 + 【C】3本）
  IF v_left <> 7 THEN
    RAISE EXCEPTION 'ow_users を参照するポリシーが % 本残っている（7 のはず）: %。中止', v_left, v_names;
  END IF;
  RAISE NOTICE '完了: 8本を置き換え / ow_users 参照が残るのは % 本（B:4 + C:3）= %', v_left, v_names;
END $$;

COMMIT;
