-- Migration 187: Fix biz dashboard — allow company members to read their own company
--
-- Problem: ow_companies RLS only allows SELECT when is_published=true or auth.uid()=user_id.
-- When a new company is created with is_published=false and user_id=null (via admin invite flow),
-- the company member cannot see the company row in getTenantContext(), which returns null
-- and shows "企業アカウントを追加しますか？" even though an ow_company_admins record exists.
--
-- Fix: Add a SELECT policy that uses auth_is_company_member(id) — a SECURITY DEFINER function
-- that bypasses RLS and checks ow_company_admins directly.

CREATE POLICY ow_companies_member_select ON public.ow_companies
  FOR SELECT
  USING (public.auth_is_company_member(id));
