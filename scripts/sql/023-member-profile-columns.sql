-- 023-1: ow_company_membersにカラム追加
ALTER TABLE ow_company_members
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS age_range text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS hometown text,
  ADD COLUMN IF NOT EXISTS skill_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hobby_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hobby_description text,
  ADD COLUMN IF NOT EXISTS header_color text DEFAULT '#1D9E75',
  ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- 023-2: 本音Q&Aテーブル新規作成
CREATE TABLE IF NOT EXISTS ow_member_honest_qa (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES ow_company_members(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ow_member_honest_qa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "honest_qa_public_read" ON ow_member_honest_qa
  FOR SELECT USING (true);

-- 023-3: work_historiesにカラム追加
ALTER TABLE work_histories
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS reason_join text;
