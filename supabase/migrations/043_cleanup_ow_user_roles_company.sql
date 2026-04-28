-- ============================================================
-- 043: Clean up ow_user_roles role='company' rows
--
-- These rows were used by the legacy company role detection logic,
-- which has been migrated to ow_company_admins (M-4 + commits 7a〜7c).
--
-- After this migration, ow_user_roles only stores 'candidate' and
-- 'admin' roles. Company memberships are exclusively in ow_company_admins.
-- ============================================================

DELETE FROM public.ow_user_roles
WHERE role = 'company';
