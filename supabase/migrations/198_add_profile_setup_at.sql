-- Migration 198: ow_users に profile_setup_at を追加
-- /profile/start フロー完了時刻を記録。NULL = 未セットアップ、非NULL = 完了済み

ALTER TABLE public.ow_users
  ADD COLUMN IF NOT EXISTS profile_setup_at TIMESTAMPTZ DEFAULT NULL;

-- 既存ユーザーのうち about_me が入っているユーザーは完了済みとみなす
UPDATE public.ow_users
SET profile_setup_at = updated_at
WHERE about_me IS NOT NULL AND about_me != '' AND profile_setup_at IS NULL;

COMMENT ON COLUMN public.ow_users.profile_setup_at IS
  '初回プロフィール公開フロー(/profile/start)完了時刻。NULL=未完了。';
