-- 企業テーブルに働き方関連フィールドとブランドカラーを追加
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS brand_color TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS remote_rate INTEGER;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS avg_overtime INTEGER;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS paid_leave_rate INTEGER;

-- 社員の声テーブル
CREATE TABLE IF NOT EXISTS ow_company_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name TEXT NOT NULL,
  role TEXT,
  content TEXT NOT NULL,
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ow_company_reviews ENABLE ROW LEVEL SECURITY;

-- 承認済みレビューのみ公開読み取り可
CREATE POLICY "ow_company_reviews_public_read"
  ON ow_company_reviews FOR SELECT
  USING (is_approved = TRUE);

-- 自分のレビューは管理可能
CREATE POLICY "ow_company_reviews_own_manage"
  ON ow_company_reviews FOR ALL
  USING (auth.uid() = user_id);
