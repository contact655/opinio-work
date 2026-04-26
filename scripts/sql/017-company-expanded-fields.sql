-- 採用情報
alter table ow_companies
  add column if not exists annual_hire_count text,
  add column if not exists mid_career_ratio integer,
  add column if not exists avg_tenure text;

-- 選考情報
alter table ow_companies
  add column if not exists avg_selection_weeks integer,
  add column if not exists selection_count integer,
  add column if not exists selection_flow text[];

-- 評価・報酬
alter table ow_companies
  add column if not exists has_stock_option boolean default false,
  add column if not exists has_incentive boolean default false,
  add column if not exists incentive_detail text,
  add column if not exists bonus_times integer,
  add column if not exists salary_raise_frequency text,
  add column if not exists evaluation_system text;

-- 組織・カルチャー
alter table ow_companies
  add column if not exists female_manager_ratio integer,
  add column if not exists maternity_leave_female integer,
  add column if not exists maternity_leave_male integer,
  add column if not exists top_down_ratio integer,
  add column if not exists official_language text default '日本語';
