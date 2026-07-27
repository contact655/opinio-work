-- ow_career_profiles に verified フラグと取材日を追加
ALTER TABLE public.ow_career_profiles
  ADD COLUMN IF NOT EXISTS verified        BOOLEAN   DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS verified_at     DATE      DEFAULT NULL;

-- 既存の公開済み軌跡は全て false のまま（手動でtrueに更新）
-- 例: UPDATE ow_career_profiles SET verified = true, verified_at = '2026-06-20' WHERE user_id = '...';
