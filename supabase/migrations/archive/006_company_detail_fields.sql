-- ow_companiesテーブルにカラムを追加
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS brand_color TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS avg_salary TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS remote_rate INTEGER;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS avg_overtime INTEGER;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS paid_leave_rate INTEGER;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS avg_age INTEGER;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS funding_total TEXT;
ALTER TABLE ow_companies ADD COLUMN IF NOT EXISTS founded_year INTEGER;

-- 企業データ更新
UPDATE ow_companies SET brand_color='#7C3AED',founded_year=2011,avg_salary='600万〜900万',remote_rate=100,avg_overtime=15,paid_leave_rate=80,avg_age=32,funding_total=NULL,phase='上場企業' WHERE name='株式会社kubell';
UPDATE ow_companies SET brand_color='#6B4FBB',founded_year=2018,avg_salary='600万〜950万',remote_rate=100,avg_overtime=20,paid_leave_rate=75,avg_age=29,funding_total='32億円',phase='シリーズB' WHERE name='株式会社LayerX';
UPDATE ow_companies SET brand_color='#1D9E75',founded_year=2017,avg_salary='500万〜800万',remote_rate=100,avg_overtime=18,paid_leave_rate=80,avg_age=30,funding_total='43億円',phase='シリーズC' WHERE name='Ubie株式会社';
UPDATE ow_companies SET brand_color='#7C3AED',founded_year=2012,avg_salary='600万〜1000万',remote_rate=60,avg_overtime=20,paid_leave_rate=85,avg_age=33,funding_total=NULL,phase='上場企業' WHERE name='株式会社PKSHA Technology';
UPDATE ow_companies SET brand_color='#0066CC',founded_year=2007,avg_salary='650万〜950万',remote_rate=80,avg_overtime=20,paid_leave_rate=85,avg_age=33,funding_total=NULL,phase='上場企業' WHERE name='Sansan株式会社';
UPDATE ow_companies SET brand_color='#FF4B00',founded_year=2012,avg_salary='600万〜900万',remote_rate=80,avg_overtime=18,paid_leave_rate=90,avg_age=32,funding_total=NULL,phase='上場企業' WHERE name='フリー株式会社';
UPDATE ow_companies SET brand_color='#EA4335',founded_year=2001,avg_salary='900万〜1500万',remote_rate=60,avg_overtime=20,paid_leave_rate=90,avg_age=35,funding_total=NULL,phase='上場企業' WHERE name='Google Japan合同会社';
UPDATE ow_companies SET brand_color='#FF9900',founded_year=2000,avg_salary='700万〜1200万',remote_rate=50,avg_overtime=25,paid_leave_rate=80,avg_age=36,funding_total=NULL,phase='上場企業' WHERE name='Amazon Japan合同会社';
UPDATE ow_companies SET brand_color='#00A4EF',founded_year=1986,avg_salary='800万〜1300万',remote_rate=70,avg_overtime=18,paid_leave_rate=90,avg_age=38,funding_total=NULL,phase='上場企業' WHERE name='日本マイクロソフト株式会社';
UPDATE ow_companies SET brand_color='#00A1E0',founded_year=2000,avg_salary='800万〜1400万',remote_rate=70,avg_overtime=20,paid_leave_rate=90,avg_age=36,funding_total=NULL,phase='上場企業' WHERE name='Salesforce Japan株式会社';
UPDATE ow_companies SET brand_color='#003B87',founded_year=2012,avg_salary='650万〜1000万',remote_rate=75,avg_overtime=20,paid_leave_rate=85,avg_age=33,funding_total=NULL,phase='上場企業' WHERE name='株式会社マネーフォワード';
UPDATE ow_companies SET brand_color='#00C4CC',founded_year=2013,avg_salary='600万〜900万',remote_rate=80,avg_overtime=18,paid_leave_rate=85,avg_age=31,funding_total='156億円',phase='上場企業' WHERE name='株式会社SmartHR';
UPDATE ow_companies SET brand_color='#1D9E75',founded_year=2023,avg_salary='500万〜800万',remote_rate=80,avg_overtime=15,paid_leave_rate=80,avg_age=32,funding_total=NULL,phase='シード' WHERE name='Opinio株式会社';
UPDATE ow_companies SET brand_color='#7C3AED',founded_year=2021,avg_salary='500万〜750万',remote_rate=60,avg_overtime=20,paid_leave_rate=75,avg_age=30,funding_total=NULL,phase='シリーズA' WHERE name='株式会社Third Box';

-- NEWバッジリセット: 全社を30日前に設定
UPDATE ow_companies SET created_at = NOW() - INTERVAL '30 days';

-- Opinioだけ新着として設定（3日前）
UPDATE ow_companies SET created_at = NOW() - INTERVAL '3 days' WHERE name = 'Opinio株式会社';
