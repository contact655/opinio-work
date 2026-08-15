-- ═══════════════════════════════════════════════════════════════════════════
-- ow_settings（運営設定）の SELECT を admin だけにする
--
-- ── 直す前（2026-08-16 実測）────────────────────────────────────────────
--   settings_public_read … `FOR SELECT USING (true)` ＋ anon にテーブルレベル SELECT
--   settings_admin_write … ALL（admin のみ）※こちらは正しい
--   列: key / value / description / updated_at   行: **0件**
--
-- 運営の設定値がそのまま key-value で入る想定の表。**外に見せる理由が無い。**
-- 0件のうちに塞ぐ（値が入ってからでは、入った瞬間に漏れる）。
--
-- ⚠️ この表には「本人」の概念が無い。実績や学歴のような own + admin ではなく、
--    **admin だけ**にする。4-1.5 の形をそのまま当てない。
--
-- ⚠️ 読む経路は src に0件（画面もAPIも参照していない）。塞いでも壊れるものは無い。
--    書き込みの settings_admin_write は**触らない**（将来 /admin から使うときの入口）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_rows int; v_pub int;
BEGIN
  SELECT count(*) INTO v_rows FROM public.ow_settings;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ow_settings が % 件（想定0）。中止', v_rows; END IF;

  SELECT count(*) INTO v_pub FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_settings' AND policyname='settings_public_read';
  IF v_pub <> 1 THEN RAISE EXCEPTION '対象ポリシーが無い。既に適用済み？中止'; END IF;

  RAISE NOTICE '適用前: ow_settings 0件 / settings_public_read あり';
END $$;

-- anon は読む理由が無い。authenticated も同じ（運営以外に見せない）
REVOKE SELECT ON public.ow_settings FROM anon;
REVOKE SELECT ON public.ow_settings FROM authenticated;

DROP POLICY "settings_public_read" ON public.ow_settings;

-- ⚠️ GRANT を剥がしたので RLS まで届かないが、ポリシーも admin で揃えておく
--    （将来 GRANT を戻したときに USING(true) の状態が復活しないように）。
CREATE POLICY "ow_settings_select_admin" ON public.ow_settings
  FOR SELECT USING (public.auth_is_admin());

DO $$
DECLARE v_sel int;
BEGIN
  IF has_table_privilege('anon','public.ow_settings','SELECT') THEN
    RAISE EXCEPTION 'anon の SELECT が残っている。ロールバック';
  END IF;
  IF has_table_privilege('authenticated','public.ow_settings','SELECT') THEN
    RAISE EXCEPTION 'authenticated の SELECT が残っている。ロールバック';
  END IF;

  SELECT count(*) INTO v_sel FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_settings' AND cmd='SELECT' AND qual='true';
  IF v_sel <> 0 THEN RAISE EXCEPTION 'USING(true) が残っている。ロールバック'; END IF;

  -- 書き込みポリシー（admin）は残っていること
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='ow_settings'
                    AND policyname='settings_admin_write') THEN
    RAISE EXCEPTION '運営の書き込みポリシーまで消えた。ロールバック';
  END IF;

  IF (SELECT count(*) FROM public.ow_settings) <> 0 THEN
    RAISE EXCEPTION '件数が変わった。ロールバック';
  END IF;

  RAISE NOTICE '完了: SELECT は admin のみ。anon / authenticated の GRANT を剥奪。0件のまま';
END $$;

COMMIT;
