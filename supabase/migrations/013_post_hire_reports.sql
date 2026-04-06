-- 入社後レポートテーブル
CREATE TABLE IF NOT EXISTS ow_post_hire_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES ow_companies(id) ON DELETE CASCADE,
  months_after integer NOT NULL CHECK (months_after IN (3, 6, 12)),

  -- 評価スコア（1-5）
  culture_match integer CHECK (culture_match BETWEEN 1 AND 5),
  workstyle_match integer CHECK (workstyle_match BETWEEN 1 AND 5),
  salary_match integer CHECK (salary_match BETWEEN 1 AND 5),
  overall_satisfaction integer CHECK (overall_satisfaction BETWEEN 1 AND 5),

  -- テキスト
  good_points text,
  concerns text,
  gap_from_expectation text,
  would_recommend boolean,

  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ow_post_hire_reports ENABLE ROW LEVEL SECURITY;

-- 自分のレポートのみ作成可能
CREATE POLICY "Users can insert own reports" ON ow_post_hire_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 自分のレポートは編集・削除可能
CREATE POLICY "Users can manage own reports" ON ow_post_hire_reports
  FOR ALL USING (auth.uid() = user_id);

-- 公開レポートは全員が閲覧可能
CREATE POLICY "Public reports are readable" ON ow_post_hire_reports
  FOR SELECT USING (is_published = true);

-- 企業担当者の顔出しカラム
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS recruiter_name text,
  ADD COLUMN IF NOT EXISTS recruiter_role text,
  ADD COLUMN IF NOT EXISTS recruiter_message text,
  ADD COLUMN IF NOT EXISTS recruiter_avatar_url text;

-- メンター実績カラム
ALTER TABLE mentors
  ADD COLUMN IF NOT EXISTS success_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sessions integer DEFAULT 0;

-- 柴さんの実績を設定
UPDATE mentors SET success_count = 47, total_sessions = 120 WHERE name = '柴 久人';
