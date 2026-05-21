-- migration: 107_add_company_member_counts.sql
-- ow_companies に Opinio 登録者カウントカラムを追加し、トリガーで自動更新する

-- 1. カラム追加
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS current_member_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS obog_count INTEGER NOT NULL DEFAULT 0;

-- 2. 既存データの再集計
UPDATE ow_companies c
SET
  current_member_count = COALESCE((
    SELECT COUNT(DISTINCT user_id)
    FROM ow_experiences
    WHERE company_id = c.id AND is_current = true
  ), 0),
  obog_count = COALESCE((
    SELECT COUNT(DISTINCT user_id)
    FROM ow_experiences
    WHERE company_id = c.id AND is_current = false
  ), 0);

-- 3. トリガー関数
CREATE OR REPLACE FUNCTION update_company_member_counts()
RETURNS TRIGGER AS $$
DECLARE
  target_company_id UUID;
BEGIN
  -- INSERT / UPDATE / DELETE のいずれでも対象 company_id を特定
  target_company_id := COALESCE(NEW.company_id, OLD.company_id);

  IF target_company_id IS NOT NULL THEN
    UPDATE ow_companies
    SET
      current_member_count = COALESCE((
        SELECT COUNT(DISTINCT user_id)
        FROM ow_experiences
        WHERE company_id = target_company_id AND is_current = true
      ), 0),
      obog_count = COALESCE((
        SELECT COUNT(DISTINCT user_id)
        FROM ow_experiences
        WHERE company_id = target_company_id AND is_current = false
      ), 0)
    WHERE id = target_company_id;
  END IF;

  -- UPDATE で company_id が変わったケース（旧 company も再集計）
  IF TG_OP = 'UPDATE'
     AND OLD.company_id IS NOT NULL
     AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    UPDATE ow_companies
    SET
      current_member_count = COALESCE((
        SELECT COUNT(DISTINCT user_id)
        FROM ow_experiences
        WHERE company_id = OLD.company_id AND is_current = true
      ), 0),
      obog_count = COALESCE((
        SELECT COUNT(DISTINCT user_id)
        FROM ow_experiences
        WHERE company_id = OLD.company_id AND is_current = false
      ), 0)
    WHERE id = OLD.company_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 4. トリガー設定
DROP TRIGGER IF EXISTS trg_update_company_member_counts ON ow_experiences;
CREATE TRIGGER trg_update_company_member_counts
AFTER INSERT OR UPDATE OR DELETE ON ow_experiences
FOR EACH ROW
EXECUTE FUNCTION update_company_member_counts();
