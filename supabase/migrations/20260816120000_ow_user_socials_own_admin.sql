-- ═══════════════════════════════════════════════════════════════════════════
-- ow_user_socials の SELECT を「本人 + admin」に絞る（3-3）
--
-- ── 直す前（2026-08-16 実測）────────────────────────────────────────────
--   ow_user_socials_select_all … `FOR SELECT USING (true)` ＋ anon に GRANT
--   行: **0件**
--
-- ⚠️ **この表には `oauth_token` 列がある。**
--    値が入っていたら、**未ログインの第三者がトークンを読める**状態だった。
--    0件なので実害は無いが、**書かれる前に閉じる**のが今回の主眼。
--    列: id / user_id / platform / url / username / custom_label / sort_order /
--        verified / oauth_token / created_at
--
-- ⚠️ GRANT と RLS の役割分担（CLAUDE.md）:
--    anon は revoke ／ authenticated は grant のまま ／ 実際の可否は RLS。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_rows int;
BEGIN
  SELECT count(*) INTO v_rows FROM public.ow_user_socials;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ow_user_socials が % 件（想定0）。中止', v_rows; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='ow_user_socials'
                    AND policyname='ow_user_socials_select_all') THEN
    RAISE EXCEPTION '対象ポリシーが無い。既に適用済み？中止';
  END IF;
  RAISE NOTICE '適用前: ow_user_socials 0件 / select_all あり';
END $$;

REVOKE SELECT ON public.ow_user_socials FROM anon;

DROP POLICY "ow_user_socials_select_all" ON public.ow_user_socials;

CREATE POLICY "ow_user_socials_select_own" ON public.ow_user_socials
  FOR SELECT USING (
    user_id IN (SELECT u.id FROM public.ow_users u WHERE u.auth_id = auth.uid())
  );

CREATE POLICY "ow_user_socials_select_admin" ON public.ow_user_socials
  FOR SELECT USING (public.auth_is_admin());

DO $$
BEGIN
  IF has_table_privilege('anon','public.ow_user_socials','SELECT') THEN
    RAISE EXCEPTION 'anon の SELECT が残っている。ロールバック';
  END IF;
  IF NOT has_table_privilege('authenticated','public.ow_user_socials','SELECT') THEN
    RAISE EXCEPTION 'authenticated の SELECT まで消えた。ロールバック';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname='public' AND tablename='ow_user_socials'
                AND cmd='SELECT' AND qual='true') THEN
    RAISE EXCEPTION 'USING(true) が残っている。ロールバック';
  END IF;
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname='public' AND tablename='ow_user_socials'
         AND cmd IN ('INSERT','UPDATE','DELETE')) <> 3 THEN
    RAISE EXCEPTION '本人の編集ポリシーが欠けている。ロールバック';
  END IF;
  IF (SELECT count(*) FROM public.ow_user_socials) <> 0 THEN
    RAISE EXCEPTION '件数が変わった。ロールバック';
  END IF;
  RAISE NOTICE '完了: SELECT は own + admin。anon は剥奪。0件のまま';
END $$;

COMMIT;
