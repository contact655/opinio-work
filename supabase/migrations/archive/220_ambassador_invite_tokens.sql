-- Migration 220: ow_company_members に招待トークンカラムを追加
-- 面談対応者（ambassador）招待フローのためのカラム

ALTER TABLE ow_company_members
  ADD COLUMN IF NOT EXISTS invite_token  UUID        DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS invited_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role_title    TEXT,
  ADD COLUMN IF NOT EXISTS talk_themes   TEXT[];

-- 既存行に invite_token がない場合は生成
UPDATE ow_company_members
SET invite_token = gen_random_uuid()
WHERE invite_token IS NULL;

-- invite_token を NOT NULL に（既存行対応後）
ALTER TABLE ow_company_members
  ALTER COLUMN invite_token SET NOT NULL,
  ALTER COLUMN invite_token SET DEFAULT gen_random_uuid();

-- インデックス
CREATE INDEX IF NOT EXISTS idx_ow_company_members_invite_token ON ow_company_members(invite_token);
