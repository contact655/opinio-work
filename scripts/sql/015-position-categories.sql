-- ポジションカテゴリテーブル
create table if not exists company_position_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references ow_companies(id) on delete cascade,
  name text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- RLS
alter table company_position_categories enable row level security;

-- 誰でも読める
create policy "anyone can read categories"
  on company_position_categories for select using (true);

-- 企業管理者のみ書き込める（認証ユーザーなら誰でもinsert/update/delete可に簡略化）
create policy "authenticated users can manage categories"
  on company_position_categories for all
  using (auth.uid() is not null);

-- work_histories にカテゴリ列を追加
alter table work_histories
  add column if not exists position_category_id uuid references company_position_categories(id);
