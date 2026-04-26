-- 019: Company expanded fields v2
-- Run this in Supabase Dashboard SQL Editor

-- 大分類①：基本情報
alter table ow_companies add column if not exists engineer_ratio text;
alter table ow_companies add column if not exists funding_stage text;
alter table ow_companies add column if not exists arr_scale text;
alter table ow_companies add column if not exists ceo_name text;
alter table ow_companies add column if not exists office_count text;

-- 大分類②：働き方
alter table ow_companies add column if not exists flex_time boolean;
alter table ow_companies add column if not exists core_time text;
alter table ow_companies add column if not exists office_days_per_week text;
alter table ow_companies add column if not exists annual_holiday_days integer;
alter table ow_companies add column if not exists side_job_ok boolean;

-- 大分類③：報酬・評価（bonus_times, has_stock_option は既存）
alter table ow_companies add column if not exists salary_review_times integer;
alter table ow_companies add column if not exists evaluation_cycle text;

-- 大分類④：成長・キャリア
alter table ow_companies add column if not exists has_book_allowance boolean;
alter table ow_companies add column if not exists has_internal_transfer boolean;
alter table ow_companies add column if not exists avg_tenure_years text;
alter table ow_companies add column if not exists turnover_rate text;

-- 大分類⑤：組織・カルチャー（mid_career_ratio, female_manager_ratio 既存）
alter table ow_companies add column if not exists female_ratio text;
alter table ow_companies add column if not exists management_style text;
alter table ow_companies add column if not exists one_on_one_freq text;

-- 大分類⑥：福利厚生
alter table ow_companies add column if not exists childcare_leave_rate text;
alter table ow_companies add column if not exists has_housing_allowance boolean;
alter table ow_companies add column if not exists has_meal_allowance boolean;
alter table ow_companies add column if not exists has_learning_support boolean;
alter table ow_companies add column if not exists has_health_support boolean;
