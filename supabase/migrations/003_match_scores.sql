-- マッチ度スコアテーブル
CREATE TABLE IF NOT EXISTS ow_match_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  overall_score INTEGER DEFAULT 0,         -- 総合スコア (0-100)
  culture_score INTEGER DEFAULT 0,         -- カルチャー軸 (0-100)
  skill_score INTEGER DEFAULT 0,           -- スキル軸 (0-100)
  career_score INTEGER DEFAULT 0,          -- キャリア軸 (0-100)
  workstyle_score INTEGER DEFAULT 0,       -- 働き方軸 (0-100)
  match_reasons TEXT[],                    -- マッチ理由テキスト配列
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE ow_match_scores ENABLE ROW LEVEL SECURITY;

-- 自分のスコアのみ閲覧可能
CREATE POLICY "ow_match_scores_own_read"
  ON ow_match_scores FOR SELECT
  USING (auth.uid() = user_id);

-- システム（管理者）による書き込みは service_role 経由
