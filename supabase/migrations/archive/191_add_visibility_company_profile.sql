-- Migration 191: プロフィールページでの企業名表示制御を追加
-- visibility_company (既存) = キャリア軌跡ページ向け
-- visibility_company_profile (新規) = プロフィールページ (/u/[id]) 向け

ALTER TABLE ow_experiences
  ADD COLUMN IF NOT EXISTS visibility_company_profile TEXT NOT NULL DEFAULT 'real'
  CONSTRAINT ow_experiences_vc_profile_check
    CHECK (visibility_company_profile IN ('real', 'masked', 'hidden'));

COMMENT ON COLUMN ow_experiences.visibility_company_profile IS
  'プロフィールページ (/u/[id]) での企業名表示制御: real=実名 / masked=業界・規模で表示 / hidden=この職歴を非表示';
