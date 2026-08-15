-- ═══════════════════════════════════════════════════════════════════════════
-- ow_job_assignees（求人の担当者）の SELECT を「その企業のメンバー」だけにする
--
-- ── 直す前（2026-08-16 実測）────────────────────────────────────────────
--   ow_job_assignees_public_read  … `FOR SELECT USING (true)` ＋ anon に GRANT
--   ow_job_assignees_admin_manage … ALL。job の会社に **is_active な ow_company_admins
--                                    行がある人**（★permission は見ていない＝メンバー粒度）
--   行: **0件**
--
-- 「どの求人を誰が担当しているか」は**企業の内部情報**。求職者にも他社にも見せない。
--
-- ── ★粒度は admin ではなく **member** ───────────────────────────────────
--   `auth_is_company_admin()` は `permission = 'admin'` を要求する。
--   担当者を**読む**のに管理者権限を要求するのは過剰で、しかも
--   **既存の書き込みポリシー（admin_manage）が既に is_active だけを見ている**。
--   読みだけ厳しくすると「自分が書いた行を自分で読めない一般メンバー」が生まれる。
--   → `public.auth_is_company_member()`（is_active なメンバーなら true）を使う。
--
-- ⚠️ 運営（admin ロール）はこのポリシーに**含めない**。
--    運営画面は `createAdminClient`（service_role）で読む作法になっている（CLAUDE.md）。
--    ポリシーに足すと、実際には使わない経路を増やすことになる。
--
-- ⚠️ GRANT と RLS の役割分担（CLAUDE.md）:
--    anon は revoke（誰にも読ませない側）／authenticated は grant のまま（誰に読ませるかは RLS）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_rows int;
BEGIN
  SELECT count(*) INTO v_rows FROM public.ow_job_assignees;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ow_job_assignees が % 件（想定0）。中止', v_rows; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='ow_job_assignees'
                    AND policyname='ow_job_assignees_public_read') THEN
    RAISE EXCEPTION '対象ポリシーが無い。既に適用済み？中止';
  END IF;
  RAISE NOTICE '適用前: ow_job_assignees 0件 / public_read あり';
END $$;

REVOKE SELECT ON public.ow_job_assignees FROM anon;

DROP POLICY "ow_job_assignees_public_read" ON public.ow_job_assignees;

CREATE POLICY "ow_job_assignees_select_company_member" ON public.ow_job_assignees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ow_jobs j
       WHERE j.id = ow_job_assignees.job_id
         AND public.auth_is_company_member(j.company_id)
    )
  );

DO $$
BEGIN
  IF has_table_privilege('anon','public.ow_job_assignees','SELECT') THEN
    RAISE EXCEPTION 'anon の SELECT が残っている。ロールバック';
  END IF;
  IF NOT has_table_privilege('authenticated','public.ow_job_assignees','SELECT') THEN
    RAISE EXCEPTION 'authenticated の SELECT まで消えた。ロールバック（RLS まで到達しなくなる）';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname='public' AND tablename='ow_job_assignees'
                AND cmd='SELECT' AND qual='true') THEN
    RAISE EXCEPTION 'USING(true) が残っている。ロールバック';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='ow_job_assignees'
                    AND policyname='ow_job_assignees_admin_manage') THEN
    RAISE EXCEPTION '書き込みポリシーまで消えた。ロールバック';
  END IF;
  IF (SELECT count(*) FROM public.ow_job_assignees) <> 0 THEN
    RAISE EXCEPTION '件数が変わった。ロールバック';
  END IF;
  RAISE NOTICE '完了: SELECT はその企業のメンバーのみ。anon は剥奪。0件のまま';
END $$;

COMMIT;
