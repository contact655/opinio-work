-- ===========================================================
-- Migration 032: auth.users → ow_users 自動作成トリガー + backfill
-- Created: 2026-04-23
--
-- 目的:
--   Supabase Auth でユーザーが作成されるたびに、
--   public.ow_users にレコードを自動挿入する。
--
-- 内容:
--   A. handle_new_ow_user() 関数 — トリガー本体
--   B. on_auth_user_created トリガー — auth.users INSERT 後に発火
--   C. 既存 auth.users の backfill（ow_profiles.name を優先使用）
-- ===========================================================


-- ═══════════════════════════════════════════════════════════
-- A. トリガー関数
-- ═══════════════════════════════════════════════════════════
-- SECURITY DEFINER: auth スキーマの NEW レコードを読める権限で実行
-- ON CONFLICT DO NOTHING: 二重実行・再実行でも安全

CREATE OR REPLACE FUNCTION public.handle_new_ow_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ow_users (
    auth_id,
    email,
    name,
    visibility,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    -- 名前の優先順位:
    --   1. サインアップ時の raw_user_meta_data->>'name'（Google OAuth や フォーム入力）
    --   2. raw_user_meta_data->>'full_name'（一部 OAuth プロバイダ）
    --   3. メールアドレスの @ 前部分（フォールバック）
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    'public',
    NOW(),
    NOW()
  )
  ON CONFLICT (auth_id) DO NOTHING;

  RETURN NEW;
END;
$$;


-- ═══════════════════════════════════════════════════════════
-- B. トリガー設定
-- ═══════════════════════════════════════════════════════════
-- auth.users への INSERT 後に発火（AFTER INSERT）
-- FOR EACH ROW: 1件ずつ処理

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_ow_user();


-- ═══════════════════════════════════════════════════════════
-- C. 既存 auth.users の backfill
-- ═══════════════════════════════════════════════════════════
-- ow_profiles に name が存在する場合はそちらを優先。
-- ON CONFLICT (auth_id) DO NOTHING で冪等。

INSERT INTO public.ow_users (
  auth_id,
  email,
  name,
  visibility,
  created_at,
  updated_at
)
SELECT
  au.id,
  au.email,
  COALESCE(
    -- ow_profiles に登録済みの名前を最優先
    NULLIF(TRIM(op.name), ''),
    -- Google OAuth などのメタデータ
    NULLIF(TRIM(au.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''),
    -- フォールバック: メアドの @ 前
    split_part(au.email, '@', 1)
  ) AS name,
  'public',
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
LEFT JOIN public.ow_profiles op ON op.user_id = au.id
ON CONFLICT (auth_id) DO NOTHING;
