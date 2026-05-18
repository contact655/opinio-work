-- ============================================================================
-- 105: ow_companies に admin 全件 SELECT ポリシーを追加
-- ============================================================================
-- 目的:
--   admin ユーザー（ow_user_roles.role='admin'）が /admin/companies 等から
--   ow_companies の全行を SELECT できるようにする。
--
-- 背景:
--   既存3ポリシー（ow_companies_own_select / ow_companies_public_read /
--   ow_companies_published_read）は admin を考慮しておらず、
--   status='pending' かつ is_published=false かつ user_id=NULL の行
--   （admin_seed で登録した企業など）が admin 画面でも表示されない問題があった。
--   参照: docs/research-2026-05-18-admin-companies-query.md
--         docs/research-2026-05-18-auth-is-admin.md
--
-- 使用関数:
--   auth_is_admin() — migration 036 で定義済み
--   （SECURITY DEFINER + SET row_security = off で RLS 再帰を回避）
-- ============================================================================

-- 冪等: 同名ポリシーが既存の場合は先に DROP してから再作成
DROP POLICY IF EXISTS ow_companies_admin_read ON public.ow_companies;

CREATE POLICY ow_companies_admin_read
  ON public.ow_companies
  FOR SELECT
  TO authenticated
  USING (auth_is_admin());

-- ============================================================================
-- ロールバック手順 (DOWN)
-- ============================================================================
-- Supabase SQL Editor で以下を手動実行:
--
-- DROP POLICY IF EXISTS ow_companies_admin_read ON public.ow_companies;
