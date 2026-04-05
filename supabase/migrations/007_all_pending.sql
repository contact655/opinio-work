-- ============================================================
-- 未適用マイグレーション一括実行SQL
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

-- 1. ow_companiesにカラム追加
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS brand_color TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS avg_salary TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS remote_rate INTEGER;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS avg_overtime INTEGER;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS paid_leave_rate INTEGER;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS avg_age INTEGER;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS funding_total TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS founded_year INTEGER;

-- 2. 企業サンプルデータ投入
UPDATE ow_companies SET brand_color='#7C3AED',founded_year=2011,avg_salary='600万〜900万',remote_rate=100,avg_overtime=15,paid_leave_rate=80,avg_age=32,phase='上場企業' WHERE name='株式会社kubell';
UPDATE ow_companies SET brand_color='#6B4FBB',founded_year=2018,avg_salary='600万〜950万',remote_rate=100,avg_overtime=20,paid_leave_rate=75,avg_age=29,funding_total='32億円',phase='シリーズB' WHERE name='株式会社LayerX';
UPDATE ow_companies SET brand_color='#1D9E75',founded_year=2017,avg_salary='500万〜800万',remote_rate=100,avg_overtime=18,paid_leave_rate=80,avg_age=30,funding_total='43億円',phase='シリーズC' WHERE name='Ubie株式会社';
UPDATE ow_companies SET brand_color='#7C3AED',founded_year=2012,avg_salary='600万〜1000万',remote_rate=60,avg_overtime=20,paid_leave_rate=85,avg_age=33,phase='上場企業' WHERE name='株式会社PKSHA Technology';
UPDATE ow_companies SET brand_color='#0066CC',founded_year=2007,avg_salary='650万〜950万',remote_rate=80,avg_overtime=20,paid_leave_rate=85,avg_age=33,phase='上場企業' WHERE name='Sansan株式会社';
UPDATE ow_companies SET brand_color='#FF4B00',founded_year=2012,avg_salary='600万〜900万',remote_rate=80,avg_overtime=18,paid_leave_rate=90,avg_age=32,phase='上場企業' WHERE name='フリー株式会社';
UPDATE ow_companies SET brand_color='#EA4335',founded_year=2001,avg_salary='900万〜1500万',remote_rate=60,avg_overtime=20,paid_leave_rate=90,avg_age=35,phase='上場企業' WHERE name='Google Japan合同会社';
UPDATE ow_companies SET brand_color='#FF9900',founded_year=2000,avg_salary='700万〜1200万',remote_rate=50,avg_overtime=25,paid_leave_rate=80,avg_age=36,phase='上場企業' WHERE name='Amazon Japan合同会社';
UPDATE ow_companies SET brand_color='#00A4EF',founded_year=1986,avg_salary='800万〜1300万',remote_rate=70,avg_overtime=18,paid_leave_rate=90,avg_age=38,phase='上場企業' WHERE name='日本マイクロソフト株式会社';
UPDATE ow_companies SET brand_color='#00A1E0',founded_year=2000,avg_salary='800万〜1400万',remote_rate=70,avg_overtime=20,paid_leave_rate=90,avg_age=36,phase='上場企業' WHERE name='Salesforce Japan株式会社';
UPDATE ow_companies SET brand_color='#003B87',founded_year=2012,avg_salary='650万〜1000万',remote_rate=75,avg_overtime=20,paid_leave_rate=85,avg_age=33,phase='上場企業' WHERE name='株式会社マネーフォワード';
UPDATE ow_companies SET brand_color='#00C4CC',founded_year=2013,avg_salary='600万〜900万',remote_rate=80,avg_overtime=18,paid_leave_rate=85,avg_age=31,funding_total='156億円',phase='上場企業' WHERE name='株式会社SmartHR';
UPDATE ow_companies SET brand_color='#1D9E75',founded_year=2023,avg_salary='500万〜800万',remote_rate=80,avg_overtime=15,paid_leave_rate=80,avg_age=32,phase='シード' WHERE name='Opinio株式会社';
UPDATE ow_companies SET brand_color='#7C3AED',founded_year=2021,avg_salary='500万〜750万',remote_rate=60,avg_overtime=20,paid_leave_rate=75,avg_age=30,phase='シリーズA' WHERE name='株式会社Third Box';

-- 3. ow_threadsテーブル（カジュアル面談）
CREATE TABLE IF NOT EXISTS ow_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  candidate_id UUID NOT NULL,
  status TEXT DEFAULT 'casual_requested',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, candidate_id)
);
ALTER TABLE ow_threads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_threads' AND policyname='service_role_all_threads') THEN
    CREATE POLICY service_role_all_threads ON ow_threads FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_threads' AND policyname='users_own_threads') THEN
    CREATE POLICY users_own_threads ON ow_threads FOR SELECT TO authenticated USING (candidate_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_threads' AND policyname='users_insert_threads') THEN
    CREATE POLICY users_insert_threads ON ow_threads FOR INSERT TO authenticated WITH CHECK (candidate_id = auth.uid());
  END IF;
END $$;

-- 4. ow_messagesテーブル
CREATE TABLE IF NOT EXISTS ow_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  sender_type TEXT DEFAULT 'candidate',
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ow_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_messages' AND policyname='service_role_all_messages') THEN
    CREATE POLICY service_role_all_messages ON ow_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_messages' AND policyname='thread_participants_read') THEN
    CREATE POLICY thread_participants_read ON ow_messages FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM ow_threads WHERE ow_threads.id = thread_id AND ow_threads.candidate_id = auth.uid()));
  END IF;
END $$;

-- 5. ow_match_scoresテーブル
CREATE TABLE IF NOT EXISTS ow_match_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  overall_score INTEGER DEFAULT 0,
  culture_score INTEGER DEFAULT 0,
  skill_score INTEGER DEFAULT 0,
  career_score INTEGER DEFAULT 0,
  workstyle_score INTEGER DEFAULT 0,
  match_reasons TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);
ALTER TABLE ow_match_scores ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_match_scores' AND policyname='own_read') THEN
    CREATE POLICY own_read ON ow_match_scores FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_match_scores' AND policyname='service_role_all_match') THEN
    CREATE POLICY service_role_all_match ON ow_match_scores FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. ow_company_reviewsテーブル
CREATE TABLE IF NOT EXISTS ow_company_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  user_id UUID,
  content TEXT NOT NULL,
  role TEXT,
  rating INTEGER DEFAULT 4,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ow_company_reviews ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_company_reviews' AND policyname='public_approved') THEN
    CREATE POLICY public_approved ON ow_company_reviews FOR SELECT USING (is_approved = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_company_reviews' AND policyname='service_role_all_reviews') THEN
    CREATE POLICY service_role_all_reviews ON ow_company_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
