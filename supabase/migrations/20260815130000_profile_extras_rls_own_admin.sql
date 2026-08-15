-- ═══════════════════════════════════════════════════════════════════════════
-- 実績・受賞・メディア掲載・発信コンテンツの SELECT を「本人 + admin」に絞る
--
-- 対象4テーブル:
--   ow_user_achievements / ow_user_awards / ow_user_media_appearances /
--   ow_user_content_links
--
-- ── なぜ（2026-08-15）────────────────────────────────────────────────────
-- 4テーブルとも `FOR SELECT USING (true)` ＋ **anon にテーブルレベルの SELECT**。
-- 実測（PostgREST を anon キーで直接）:
--     ow_user_achievements       200 []
--     ow_user_awards             200 []
--     ow_user_media_appearances  200 []
--     ow_user_content_links      200 []
--     ow_user_educations         401 permission denied   ← 学歴だけ閉じている
-- ⚠️ **200 が返るのは0件だからで、閉じているからではない。**
--    フェーズ4-2 で実績が書かれ始めた瞬間に、未ログインの第三者が全ユーザー分を読める。
--
-- 学歴で採った形（20260806200000_educations_rls_own_admin.sql）に揃える。
--   ① anon の SELECT を剥がす（学歴は同日に別途剥奪済みだった）
--   ② USING(true) を drop し、own + admin の2本にする
--
-- ⚠️ 可視性（ow_users.visibility）の判定はポリシーに持ち込まない。学歴と同じ。
--    公開表示（/u/[id]）は createAdminClient に寄せる。**同じコミットで差し替える。**
--    アプリとポリシーに二重に置くと、片方だけ直したときに食い違う。
--
-- ── user_id の空間 ───────────────────────────────────────────────────────
-- 4テーブルとも user_id の FK は **ow_users(id)**（pg_constraint で確認）。
-- したがって own ポリシーは学歴・ow_experiences と同じ書き方でよい。
-- ⚠️ admin 判定は auth_is_admin()。あちらは auth.uid() 空間で ow_user_roles を引く。
--    自前で ow_users を JOIN して書くと空間を取り違える。
--
-- ── 触らないもの ─────────────────────────────────────────────────────────
-- ⚠️ 同じ形（USING(true) ＋ anon SELECT）のテーブルは全部で **25件**ある
--    （2026-08-15 実測）。この migration は**上の4つだけ**を触る。
--    残りは docs/todo.md に一覧を記録した。プロフィール面の外まで広げると
--    検証範囲が一気に増えるため、ここでは広げない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_all int; v_space int;
BEGIN
  -- USING(true) の SELECT ポリシーが4本とも存在すること
  SELECT count(*) INTO v_all FROM pg_policies
   WHERE schemaname='public'
     AND tablename IN ('ow_user_achievements','ow_user_awards',
                       'ow_user_media_appearances','ow_user_content_links')
     AND cmd='SELECT' AND qual='true';
  IF v_all <> 4 THEN
    RAISE EXCEPTION 'USING(true) の SELECT ポリシーが % 本（想定4）。既に適用済み？中止', v_all;
  END IF;

  -- user_id が ow_users.id 空間であること（0件なので FK 由来の想定を壊す行が無いことの確認）
  SELECT
    (SELECT count(*) FROM public.ow_user_achievements a
      WHERE NOT EXISTS (SELECT 1 FROM public.ow_users u WHERE u.id = a.user_id))
  + (SELECT count(*) FROM public.ow_user_awards a
      WHERE NOT EXISTS (SELECT 1 FROM public.ow_users u WHERE u.id = a.user_id))
  + (SELECT count(*) FROM public.ow_user_media_appearances a
      WHERE NOT EXISTS (SELECT 1 FROM public.ow_users u WHERE u.id = a.user_id))
  + (SELECT count(*) FROM public.ow_user_content_links a
      WHERE NOT EXISTS (SELECT 1 FROM public.ow_users u WHERE u.id = a.user_id))
  INTO v_space;
  IF v_space <> 0 THEN
    RAISE EXCEPTION 'user_id が ow_users.id に対応しない行が % 件。空間の想定が違う。中止', v_space;
  END IF;

  RAISE NOTICE '適用前: USING(true) が4本 / user_id は ow_users.id 空間';
END $$;

-- ── ① anon の SELECT を剥がす ───────────────────────────────────────────────
REVOKE SELECT ON public.ow_user_achievements      FROM anon;
REVOKE SELECT ON public.ow_user_awards            FROM anon;
REVOKE SELECT ON public.ow_user_media_appearances FROM anon;
REVOKE SELECT ON public.ow_user_content_links     FROM anon;

-- ── ② USING(true) を own + admin に差し替える ──────────────────────────────
DROP POLICY "ow_user_achievements_select_all"      ON public.ow_user_achievements;
DROP POLICY "ow_user_awards_select_all"            ON public.ow_user_awards;
DROP POLICY "ow_user_media_appearances_select_all" ON public.ow_user_media_appearances;
DROP POLICY "ow_ucl_select_all"                    ON public.ow_user_content_links;

CREATE POLICY "ow_user_achievements_select_own" ON public.ow_user_achievements
  FOR SELECT USING (user_id IN (SELECT u.id FROM public.ow_users u WHERE u.auth_id = auth.uid()));
CREATE POLICY "ow_user_achievements_select_admin" ON public.ow_user_achievements
  FOR SELECT USING (public.auth_is_admin());

CREATE POLICY "ow_user_awards_select_own" ON public.ow_user_awards
  FOR SELECT USING (user_id IN (SELECT u.id FROM public.ow_users u WHERE u.auth_id = auth.uid()));
CREATE POLICY "ow_user_awards_select_admin" ON public.ow_user_awards
  FOR SELECT USING (public.auth_is_admin());

CREATE POLICY "ow_user_media_appearances_select_own" ON public.ow_user_media_appearances
  FOR SELECT USING (user_id IN (SELECT u.id FROM public.ow_users u WHERE u.auth_id = auth.uid()));
CREATE POLICY "ow_user_media_appearances_select_admin" ON public.ow_user_media_appearances
  FOR SELECT USING (public.auth_is_admin());

CREATE POLICY "ow_user_content_links_select_own" ON public.ow_user_content_links
  FOR SELECT USING (user_id IN (SELECT u.id FROM public.ow_users u WHERE u.auth_id = auth.uid()));
CREATE POLICY "ow_user_content_links_select_admin" ON public.ow_user_content_links
  FOR SELECT USING (public.auth_is_admin());

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_true int; v_sel int; v_write int; v_rows int; t text;
BEGIN
  -- USING(true) が残っていないこと
  SELECT count(*) INTO v_true FROM pg_policies
   WHERE schemaname='public'
     AND tablename IN ('ow_user_achievements','ow_user_awards',
                       'ow_user_media_appearances','ow_user_content_links')
     AND cmd='SELECT' AND qual='true';
  IF v_true <> 0 THEN RAISE EXCEPTION 'USING(true) が % 本残っている。ロールバック', v_true; END IF;

  -- SELECT ポリシーが 4テーブル × 2本 = 8本
  SELECT count(*) INTO v_sel FROM pg_policies
   WHERE schemaname='public'
     AND tablename IN ('ow_user_achievements','ow_user_awards',
                       'ow_user_media_appearances','ow_user_content_links')
     AND cmd='SELECT';
  IF v_sel <> 8 THEN RAISE EXCEPTION 'SELECT ポリシーが % 本（想定8）。ロールバック', v_sel; END IF;

  -- 本人の編集経路が残っていること（4テーブル × INSERT/UPDATE/DELETE = 12本）
  SELECT count(*) INTO v_write FROM pg_policies
   WHERE schemaname='public'
     AND tablename IN ('ow_user_achievements','ow_user_awards',
                       'ow_user_media_appearances','ow_user_content_links')
     AND cmd IN ('INSERT','UPDATE','DELETE');
  IF v_write <> 12 THEN RAISE EXCEPTION '編集ポリシーが % 本（想定12）。ロールバック', v_write; END IF;

  -- authenticated の SELECT は残っていること（消すと本人も読めない）
  FOREACH t IN ARRAY ARRAY['ow_user_achievements','ow_user_awards',
                           'ow_user_media_appearances','ow_user_content_links']
  LOOP
    IF NOT has_table_privilege('authenticated', 'public.'||t, 'SELECT') THEN
      RAISE EXCEPTION '% の authenticated SELECT まで消えた。ロールバック', t;
    END IF;
    IF has_table_privilege('anon', 'public.'||t, 'SELECT') THEN
      RAISE EXCEPTION '% の anon SELECT が残っている。ロールバック', t;
    END IF;
  END LOOP;

  -- 件数は変えていないこと（4テーブルとも0件）
  SELECT (SELECT count(*) FROM public.ow_user_achievements)
       + (SELECT count(*) FROM public.ow_user_awards)
       + (SELECT count(*) FROM public.ow_user_media_appearances)
       + (SELECT count(*) FROM public.ow_user_content_links)
    INTO v_rows;
  IF v_rows <> 0 THEN RAISE EXCEPTION '4テーブルの合計が % 件（想定0）。ロールバック', v_rows; END IF;

  RAISE NOTICE '完了: SELECT は own + admin（計8本）/ anon は剥奪 / 件数0のまま';
END $$;

COMMIT;
