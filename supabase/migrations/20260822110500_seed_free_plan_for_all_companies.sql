-- ============================================================================
-- 有料プラン基盤 ②：全企業に free の行を1本ずつ入れる
--
-- ⚠️ **「行が無い＝無料」は採らない**（2026-08-22 の判断）。
--    行の不在で無料を表すと、「まだ設定していない」と「無料と決めた」の
--    区別がつかなくなる。取得に失敗したときも無料に見えてしまう（fail-open）。
--    **必ず1本入れて、プランは常に行から読む。**
--
-- started_at は会社の created_at。「いつから無料だったか」を後から作らないため、
-- 推測値ではなく実在する日時を使う。
--
-- ⚠️ 冪等。既に active な行がある企業には入れない。
--
-- ── 復元用 ──────────────────────────────────────────────────────────────
-- DELETE FROM public.ow_company_plans
--  WHERE plan_type = 'free' AND monthly_fee = 0 AND status = 'active';
-- ⚠️ ただし運営が手で変えた行まで消えないよう、実行前に件数を確認すること。
-- ============================================================================

INSERT INTO public.ow_company_plans
  (company_id, plan_type, billing_cycle, monthly_fee, started_at, ended_at, status)
SELECT
  c.id,
  'free',
  'monthly',
  0,
  c.created_at,
  NULL,
  'active'
FROM public.ow_companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.ow_company_plans p
   WHERE p.company_id = c.id AND p.status = 'active'
);

-- ── 検算 ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_companies int;
  v_active    int;
  v_multi     int;
BEGIN
  SELECT count(*) INTO v_companies FROM public.ow_companies;
  SELECT count(*) INTO v_active    FROM public.ow_company_plans WHERE status = 'active';

  -- 1社に active が2本以上ある状態を作っていないか
  SELECT count(*) INTO v_multi FROM (
    SELECT company_id FROM public.ow_company_plans
     WHERE status = 'active' GROUP BY company_id HAVING count(*) > 1
  ) x;

  RAISE NOTICE '企業 % 社 / active なプラン % 本 / active が重複している企業 % 社',
    v_companies, v_active, v_multi;

  IF v_active <> v_companies THEN
    RAISE EXCEPTION '企業数(%)と active なプラン数(%)が一致しない', v_companies, v_active;
  END IF;
  IF v_multi > 0 THEN
    RAISE EXCEPTION '1社に active が複数ある企業が % 社', v_multi;
  END IF;
END $$;
