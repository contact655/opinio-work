-- ═══════════════════════════════════════════════════════
-- マイページ再設計: DB変更
-- Supabase SQL Editorで実行してください
-- ═══════════════════════════════════════════════════════

-- 1. お気に入りテーブル（企業・求人を統合）
CREATE TABLE IF NOT EXISTS ow_favorites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('company', 'job')),
  target_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);
ALTER TABLE ow_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own favorites" ON ow_favorites
  FOR ALL USING (auth.uid() = user_id);

-- 2. 相談履歴テーブル
CREATE TABLE IF NOT EXISTS ow_consultations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  mentor_id uuid REFERENCES mentors(id),
  consulted_at timestamptz NOT NULL,
  duration_min integer DEFAULT 30,
  tags text[] DEFAULT '{}',
  memo text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ow_consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own consultations" ON ow_consultations
  FOR ALL USING (auth.uid() = user_id);

-- 3. mentorsテーブルにtotal_consultationsカラム追加
ALTER TABLE mentors
  ADD COLUMN IF NOT EXISTS total_consultations integer DEFAULT 0;

-- 4. opinio_commentカラム追加（前回の残り）
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS opinio_comment text;

-- 5. メンター相談カウントトリガー
CREATE OR REPLACE FUNCTION increment_mentor_consultations()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE mentors
  SET total_consultations = total_consultations + 1
  WHERE id = NEW.mentor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_consultation_insert ON ow_consultations;
CREATE TRIGGER after_consultation_insert
AFTER INSERT ON ow_consultations
FOR EACH ROW EXECUTE FUNCTION increment_mentor_consultations();
