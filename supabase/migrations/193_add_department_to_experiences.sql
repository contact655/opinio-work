-- Migration 193: ow_experiences に部署名カラムを追加

ALTER TABLE ow_experiences
  ADD COLUMN IF NOT EXISTS department TEXT;

COMMENT ON COLUMN ow_experiences.department IS
  '部署名（例: エンタープライズ営業本部、プロダクト開発部）';
