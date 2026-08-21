-- ============================================================================
-- 有料プラン基盤 ①：ow_tenant_plans を ow_company_plans に整理する
--
-- ⚠️ **「テナント」は実体を伴っていない。** `ow_tenant_plans.tenant_id` の FK は
--    はじめから `ow_companies` を指していた（`tenants` ではない）。
--    `tenants` は 2026-03 の別プロダクト（ATS/CRM 試作）の残骸で、
--    10行すべて `株式会社TEST` / `株式会社AAA` のダミー。現行の87社とは無関係。
--    名前だけが「テナント」なので、次に読む人が `tenants` を見に行く。
--
-- 対象は0行（`ow_tenant_plans` / `ow_invoices` とも）。データは失われない。
--
-- ── 変更 ────────────────────────────────────────────────────────────────
--   ow_tenant_plans            -> ow_company_plans
--   ow_tenant_plans.tenant_id  -> company_id
--   performance_rate           削除（成功報酬は 2026-08-21 に廃止済み）
--   billing_cycle              追加（'monthly' | 'yearly'、既定 'monthly'）
--   plan_type の CHECK         free / starter / growth / scale へ
--   ow_invoices.tenant_id      -> company_id
--   ow_user_roles.tenant_id    **触らない**（36行あるため）。COMMENT だけ残す
--
-- ── 復元用（元に戻す場合）────────────────────────────────────────────────
-- ALTER TABLE public.ow_company_plans DROP CONSTRAINT ow_company_plans_plan_type_check;
-- ALTER TABLE public.ow_company_plans DROP CONSTRAINT ow_company_plans_billing_cycle_check;
-- ALTER TABLE public.ow_company_plans DROP COLUMN billing_cycle;
-- ALTER TABLE public.ow_company_plans ADD COLUMN performance_rate numeric;
-- ALTER TABLE public.ow_company_plans RENAME COLUMN company_id TO tenant_id;
-- ALTER TABLE public.ow_company_plans RENAME TO ow_tenant_plans;
-- ALTER TABLE public.ow_tenant_plans ADD CONSTRAINT ow_tenant_plans_plan_type_check
--   CHECK (plan_type = ANY (ARRAY['performance','saas_monthly','saas_yearly']));
-- ALTER TABLE public.ow_invoices RENAME COLUMN company_id TO tenant_id;
-- DROP POLICY "company admins read plan" ON public.ow_company_plans;
-- CREATE POLICY "tenant members read plan" ON public.ow_tenant_plans FOR SELECT USING (
--   tenant_id IN (SELECT tenant_id FROM ow_user_roles
--                  WHERE user_id = auth.uid() AND role = 'company' AND tenant_id IS NOT NULL));
-- ============================================================================

-- ── ① テーブルと列のリネーム ────────────────────────────────────────────
ALTER TABLE public.ow_tenant_plans RENAME TO ow_company_plans;
ALTER TABLE public.ow_company_plans RENAME COLUMN tenant_id TO company_id;

-- ── ② 成功報酬の名残を落とす ────────────────────────────────────────────
-- 掲載サービスの成功報酬は /terms/listing から廃止済み（2026-08-21）。
ALTER TABLE public.ow_company_plans DROP COLUMN IF EXISTS performance_rate;

-- ── ③ 課金サイクル ──────────────────────────────────────────────────────
-- ⚠️ 月額/年額は `plan_type` に混ぜない。旧 `saas_monthly` / `saas_yearly` は
--    「プランの種類」と「支払い周期」を1列に押し込んでいて、
--    プランが増えるたびに値が倍になる形だった。
ALTER TABLE public.ow_company_plans
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly';

ALTER TABLE public.ow_company_plans
  DROP CONSTRAINT IF EXISTS ow_company_plans_billing_cycle_check;
ALTER TABLE public.ow_company_plans
  ADD CONSTRAINT ow_company_plans_billing_cycle_check
  CHECK (billing_cycle IN ('monthly', 'yearly'));

-- ── ④ plan_type を新しい4値に ──────────────────────────────────────────
-- ⚠️ UI / API / DB の CHECK を3つ揃える（CLAUDE.md）。
--    アプリ側の正は `src/lib/constants/plans.ts`。値を足すときは両方直す。
ALTER TABLE public.ow_company_plans
  DROP CONSTRAINT IF EXISTS ow_tenant_plans_plan_type_check;
ALTER TABLE public.ow_company_plans
  DROP CONSTRAINT IF EXISTS ow_company_plans_plan_type_check;
ALTER TABLE public.ow_company_plans
  ADD CONSTRAINT ow_company_plans_plan_type_check
  CHECK (plan_type IN ('free', 'starter', 'growth', 'scale'));

-- ── ⑤ ow_invoices ──────────────────────────────────────────────────────
ALTER TABLE public.ow_invoices RENAME COLUMN tenant_id TO company_id;

-- ── ⑥ 死んでいた SELECT ポリシーを差し替える ────────────────────────────
-- ⚠️ 旧 `tenant members read plan` は
--      tenant_id IN (SELECT tenant_id FROM ow_user_roles
--                     WHERE user_id = auth.uid() AND role = 'company' ...)
--    だったが、**`ow_user_roles` に 'company' ロールは存在しない**
--    （実測: candidate 34 / admin 2、`tenant_id` は36行すべて NULL）。
--    誰に対しても false で、ポリシーが死んだまま残っていた。
--    `ow_invoices` 側と同じ `auth_is_company_admin()` に揃える。
DROP POLICY IF EXISTS "tenant members read plan" ON public.ow_company_plans;

CREATE POLICY "company admins read plan"
  ON public.ow_company_plans
  FOR SELECT
  USING (public.auth_is_company_admin(company_id) OR public.auth_is_admin());

-- ⚠️ INSERT / UPDATE / DELETE のポリシーは**作らない**。
--    プランの変更は運営だけが行う（/admin の画面 → service_role 経由）。
--    RLS 有効かつポリシー未定義なので、authenticated からの書き込みは
--    テーブル権限があっても RLS で落ちる（fail-closed）。

-- ── ⑦ 名前が実体と合っていない列に印を残す ──────────────────────────────
COMMENT ON COLUMN public.ow_user_roles.tenant_id IS
  '⚠️ 名前は tenant だが FK は ow_companies を指す。tenants テーブルとは無関係。'
  '36行すべて NULL で、実質未使用（role は candidate / admin のみ）。'
  '行があるため 2026-08-22 の整理では改名していない。';

COMMENT ON TABLE public.ow_company_plans IS
  '企業の契約プラン。1社に複数行を積み、status=active の最新行が現行プラン。'
  '⚠️ 上書きせず履歴として積むこと（前の行は ended_at を埋めて status=ended）。'
  '⚠️ プランの正はこの表。ow_companies.plan は廃止予定で読まない。';

-- ── ⑧ 検算：リネーム後も権限とポリシーが期待どおりか ────────────────────
DO $$
DECLARE
  v_anon_select boolean;
  v_auth_select boolean;
  v_svc_select  boolean;
  v_policies    int;
BEGIN
  -- リネームでは ACL もポリシーも引き継がれるはずだが、思い込まずに測る
  v_anon_select := has_table_privilege('anon',          'public.ow_company_plans', 'SELECT');
  v_auth_select := has_table_privilege('authenticated', 'public.ow_company_plans', 'SELECT');
  v_svc_select  := has_table_privilege('service_role',  'public.ow_company_plans', 'SELECT');

  SELECT count(*) INTO v_policies
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relname = 'ow_company_plans' AND c.relnamespace = 'public'::regnamespace;

  RAISE NOTICE 'ow_company_plans: anon.SELECT=% authenticated.SELECT=% service_role.SELECT=% policies=%',
    v_anon_select, v_auth_select, v_svc_select, v_policies;

  IF NOT v_svc_select THEN
    RAISE EXCEPTION 'service_role が読めない。getTenantContext が壊れる';
  END IF;
  IF v_policies <> 1 THEN
    RAISE EXCEPTION 'ポリシーが % 本（1本の想定）', v_policies;
  END IF;

  -- 旧名が残っていないこと
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ow_tenant_plans'
              AND relnamespace = 'public'::regnamespace) THEN
    RAISE EXCEPTION 'ow_tenant_plans が残っている';
  END IF;
END $$;
