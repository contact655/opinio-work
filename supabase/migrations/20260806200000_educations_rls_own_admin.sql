-- ═══════════════════════════════════════════════════════════════════════════
-- ow_user_educations の SELECT ポリシーを「本人 + admin」に絞る
--
-- ── なぜ（2026-08-06）──────────────────────────────────────────────────────
-- ow_user_educations_select_all は `FOR SELECT USING (true)` で、
-- 「学歴は誰でも見てよい」と宣言しているに等しかった。
-- ow_users.visibility とも /u/[id] の 404 判定とも噛み合っていない。
-- 同日 anon の GRANT は剥がしたが、**authenticated からは 11件そのまま読めていた**。
--
-- ⚠️ visibility 判定はポリシーに持ち込まない。
--    表示経路はすべて createAdminClient で、ポリシーを通らない:
--      /schools/[id]:47 … :78 で login_only を未ログインに出さない判定を持っている
--      /u/[id]:198      … ページ到達時点で ow_users の RLS を通過済み
--      /mypage:148      … 母校カード（同校の他ユーザー数）
--      lib/people/directory.ts:191
--    session が読むのは本人の行だけ（/mypage:58 /profile/edit:40 api/jobseeker/educations/*）。
--    可視性の判定をアプリとポリシーに二重に置くと、片方だけ直したときに食い違う。
--
-- ⚠️ 列剥奪は不要。行で閉じられるならそちらが素直。
--
-- ── user_id の空間（実測 2026-08-06）────────────────────────────────────────
--   ow_user_educations.user_id … distinct 6件すべてが **ow_users.id** と一致。
--                                auth_id との一致は 0 件
--   ow_experiences.user_id     … 同じく ow_users.id 空間
--   → own ポリシーは ow_experiences_own_manage と同じ書き方に揃える。
-- ⚠️ 一方 ow_user_roles.user_id は **auth.uid() 空間**（別の空間）。
--    admin 判定は auth_is_admin()（ow_user_roles を auth.uid() で引く）を使う。
--    自前で ow_users を JOIN して書くと空間を取り違える。
--    実際 career_profiles_admin_all はその形で書かれており、要確認の候補。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_pol int; v_all int; v_rows int; v_space int;
BEGIN
  SELECT count(*) INTO v_pol FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_user_educations';
  IF v_pol <> 4 THEN RAISE EXCEPTION 'ポリシーが % 本（想定4）。中止', v_pol; END IF;

  SELECT count(*) INTO v_all FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_user_educations'
     AND policyname='ow_user_educations_select_all';
  IF v_all <> 1 THEN RAISE EXCEPTION '対象ポリシーが無い。既に適用済み？中止'; END IF;

  -- user_id が ow_users.id 空間であること（auth.uid() 空間ではないこと）
  SELECT count(*) INTO v_space
    FROM public.ow_user_educations e
   WHERE NOT EXISTS (SELECT 1 FROM public.ow_users u WHERE u.id = e.user_id);
  IF v_space <> 0 THEN
    RAISE EXCEPTION 'user_id が ow_users.id に対応しない行が % 件。空間の想定が違う。中止', v_space;
  END IF;

  SELECT count(*) INTO v_rows FROM public.ow_user_educations;
  RAISE NOTICE '適用前: 学歴 % 件 / ポリシー % 本 / user_id は ow_users.id 空間', v_rows, v_pol;
END $$;

-- ── 差し替え ────────────────────────────────────────────────────────────────
DROP POLICY "ow_user_educations_select_all" ON public.ow_user_educations;

-- 本人。ow_experiences_own_manage と同じ書き方
CREATE POLICY "ow_user_educations_select_own" ON public.ow_user_educations
  FOR SELECT USING (
    user_id IN (SELECT u.id FROM public.ow_users u WHERE u.auth_id = auth.uid())
  );

-- 運営。auth_is_admin() は SECURITY DEFINER + row_security off で、
-- ow_user_roles を auth.uid() で引く（そちらは auth 空間）
CREATE POLICY "ow_user_educations_select_admin" ON public.ow_user_educations
  FOR SELECT USING (public.auth_is_admin());

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_pol int; v_all int; v_rows int; v_sel int;
BEGIN
  SELECT count(*) INTO v_all FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_user_educations'
     AND policyname='ow_user_educations_select_all';
  IF v_all <> 0 THEN RAISE EXCEPTION 'USING (true) のポリシーが残っている。ロールバック'; END IF;

  SELECT count(*) INTO v_sel FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_user_educations' AND cmd='SELECT';
  IF v_sel <> 2 THEN RAISE EXCEPTION 'SELECT ポリシーが % 本（想定2）。ロールバック', v_sel; END IF;

  SELECT count(*) INTO v_pol FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_user_educations';
  IF v_pol <> 5 THEN RAISE EXCEPTION 'ポリシー総数が % 本（想定5）。ロールバック', v_pol; END IF;

  -- 本人の編集経路（INSERT/UPDATE/DELETE ポリシー）が残っていること
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname='public' AND tablename='ow_user_educations'
         AND cmd IN ('INSERT','UPDATE','DELETE')) <> 3 THEN
    RAISE EXCEPTION '本人の編集ポリシーが欠けている。ロールバック';
  END IF;

  -- 列権限は触っていないこと（authenticated は表レベル SELECT のまま）
  IF NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                  WHERE table_schema='public' AND table_name='ow_user_educations'
                    AND grantee='authenticated' AND privilege_type='SELECT') THEN
    RAISE EXCEPTION 'authenticated の SELECT 権限まで消えた。ロールバック';
  END IF;

  -- anon は剥奪済みのままであること
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
              WHERE table_schema='public' AND table_name='ow_user_educations'
                AND grantee='anon' AND privilege_type='SELECT') THEN
    RAISE EXCEPTION 'anon の SELECT が復活している。ロールバック';
  END IF;

  SELECT count(*) INTO v_rows FROM public.ow_user_educations;
  IF v_rows <> 11 THEN RAISE EXCEPTION '学歴が % 件（想定11）。ロールバック', v_rows; END IF;

  RAISE NOTICE '完了: SELECT は own + admin の2本。ポリシー % 本 / 学歴 % 件は変更なし', v_pol, v_rows;
END $$;

COMMIT;
