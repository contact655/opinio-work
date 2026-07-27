-- Migration 267: contact+001@opinio.co.jp の auth_id をリンクし、
-- 企業作成時に admin 登録が漏れた件を修正する
--
-- 背景:
--   contact+001@opinio.co.jp の ow_users 行は auth_id = NULL（孤立レコード）だった。
--   auth.users.id = '7c719913-49a8-43a6-900b-c19a3f173820' が正しい auth ユーザー。
--   企業新規作成時に auth_id で ow_users が引けなかったため ow_company_admins が未挿入だった。

-- 1. auth_id をリンク
UPDATE public.ow_users
SET auth_id = '7c719913-49a8-43a6-900b-c19a3f173820',
    updated_at = NOW()
WHERE email = 'contact+001@opinio.co.jp'
  AND auth_id IS NULL;

-- 2. 作成された「株式会社TEST」(admin_count=0, created 2026-07-21) に admin を追加
INSERT INTO public.ow_company_admins (user_id, company_id, permission, is_active, created_at)
SELECT
  u.id,
  '1c5fc5fe-2354-4b5c-9481-6c4aca59a308',
  'admin',
  true,
  NOW()
FROM public.ow_users u
WHERE u.email = 'contact+001@opinio.co.jp'
ON CONFLICT DO NOTHING;
