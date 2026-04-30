-- opinio.jp テーブル作成（ow_ プレフィックスで既存ATSテーブルと区別）

-- 求職者プロフィール
CREATE TABLE IF NOT EXISTS ow_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  name_kana TEXT,
  location TEXT,
  job_type TEXT,
  experience_years TEXT,
  desired_salary_min INTEGER,
  desired_salary_max INTEGER,
  desired_work_style TEXT,
  desired_phase TEXT[],
  transfer_timing TEXT,
  skills TEXT[],
  tools TEXT[],
  bio TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 企業情報
CREATE TABLE IF NOT EXISTS ow_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  name_en TEXT,
  founded_at TEXT,
  employee_count TEXT,
  location TEXT,
  industry TEXT,
  phase TEXT,
  url TEXT,
  mission TEXT,
  description TEXT,
  logo_url TEXT,
  status TEXT DEFAULT 'pending',
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 企業メンバー
CREATE TABLE IF NOT EXISTS ow_company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT,
  background TEXT,
  photo_url TEXT,
  display_order INTEGER DEFAULT 0
);

-- 社員写真
CREATE TABLE IF NOT EXISTS ow_company_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  photo_url TEXT,
  is_main BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0
);

-- カルチャータグ
CREATE TABLE IF NOT EXISTS ow_company_culture_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  tag_category TEXT,
  tag_value TEXT
);

-- 求人
CREATE TABLE IF NOT EXISTS ow_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  job_category TEXT,
  employment_type TEXT,
  description TEXT,
  appeal TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  location TEXT,
  work_style TEXT,
  selection_process JSONB,
  status TEXT DEFAULT 'draft',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 求人要件
CREATE TABLE IF NOT EXISTS ow_job_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ow_jobs(id) ON DELETE CASCADE,
  requirement_type TEXT,
  content TEXT,
  display_order INTEGER DEFAULT 0
);

-- マッチングタグ
CREATE TABLE IF NOT EXISTS ow_job_matching_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ow_jobs(id) ON DELETE CASCADE,
  tag_category TEXT,
  tag_value TEXT
);

-- 応募
CREATE TABLE IF NOT EXISTS ow_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES auth.users(id),
  job_id UUID REFERENCES ow_jobs(id),
  status TEXT DEFAULT 'applied',
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- スカウト
CREATE TABLE IF NOT EXISTS ow_scouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES ow_companies(id),
  candidate_id UUID REFERENCES auth.users(id),
  job_id UUID REFERENCES ow_jobs(id),
  message TEXT,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 保存企業
CREATE TABLE IF NOT EXISTS ow_saved_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  company_id UUID REFERENCES ow_companies(id),
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- 保存求人
CREATE TABLE IF NOT EXISTS ow_saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  job_id UUID REFERENCES ow_jobs(id),
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- RLSを有効化
ALTER TABLE ow_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_company_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_company_culture_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_job_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_job_matching_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_scouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_saved_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ow_saved_jobs ENABLE ROW LEVEL SECURITY;

-- 公開テーブルの読み取りポリシー（未認証ユーザーも閲覧可能）
CREATE POLICY "ow_companies_public_read" ON ow_companies FOR SELECT USING (status = 'active');
CREATE POLICY "ow_company_members_public_read" ON ow_company_members FOR SELECT USING (true);
CREATE POLICY "ow_company_photos_public_read" ON ow_company_photos FOR SELECT USING (true);
CREATE POLICY "ow_company_culture_tags_public_read" ON ow_company_culture_tags FOR SELECT USING (true);
CREATE POLICY "ow_jobs_public_read" ON ow_jobs FOR SELECT USING (status = 'active');
CREATE POLICY "ow_job_requirements_public_read" ON ow_job_requirements FOR SELECT USING (true);
CREATE POLICY "ow_job_matching_tags_public_read" ON ow_job_matching_tags FOR SELECT USING (true);

-- 認証ユーザー用ポリシー
CREATE POLICY "ow_profiles_own_read" ON ow_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ow_profiles_own_insert" ON ow_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ow_profiles_own_update" ON ow_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "ow_companies_own_manage" ON ow_companies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "ow_company_members_own_manage" ON ow_company_members FOR ALL USING (
  company_id IN (SELECT id FROM ow_companies WHERE user_id = auth.uid())
);
CREATE POLICY "ow_company_photos_own_manage" ON ow_company_photos FOR ALL USING (
  company_id IN (SELECT id FROM ow_companies WHERE user_id = auth.uid())
);
CREATE POLICY "ow_company_culture_tags_own_manage" ON ow_company_culture_tags FOR ALL USING (
  company_id IN (SELECT id FROM ow_companies WHERE user_id = auth.uid())
);

CREATE POLICY "ow_jobs_own_manage" ON ow_jobs FOR ALL USING (
  company_id IN (SELECT id FROM ow_companies WHERE user_id = auth.uid())
);
CREATE POLICY "ow_job_requirements_own_manage" ON ow_job_requirements FOR ALL USING (
  job_id IN (SELECT id FROM ow_jobs WHERE company_id IN (SELECT id FROM ow_companies WHERE user_id = auth.uid()))
);
CREATE POLICY "ow_job_matching_tags_own_manage" ON ow_job_matching_tags FOR ALL USING (
  job_id IN (SELECT id FROM ow_jobs WHERE company_id IN (SELECT id FROM ow_companies WHERE user_id = auth.uid()))
);

CREATE POLICY "ow_applications_candidate_read" ON ow_applications FOR SELECT USING (auth.uid() = candidate_id);
CREATE POLICY "ow_applications_candidate_insert" ON ow_applications FOR INSERT WITH CHECK (auth.uid() = candidate_id);

CREATE POLICY "ow_scouts_candidate_read" ON ow_scouts FOR SELECT USING (auth.uid() = candidate_id);
CREATE POLICY "ow_scouts_company_manage" ON ow_scouts FOR ALL USING (
  company_id IN (SELECT id FROM ow_companies WHERE user_id = auth.uid())
);

CREATE POLICY "ow_saved_companies_own" ON ow_saved_companies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "ow_saved_jobs_own" ON ow_saved_jobs FOR ALL USING (auth.uid() = user_id);
