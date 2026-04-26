-- 018: Company AI Sync tables
-- Run this in Supabase Dashboard SQL Editor

-- 1. company_sources: 取得元ソースの管理
create table if not exists company_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references ow_companies(id) on delete cascade,
  name text not null,
  url text not null,
  last_fetched_at timestamptz,
  created_at timestamptz default now()
);

-- 2. company_sync_logs: 同期差分ログ
create table if not exists company_sync_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references ow_companies(id) on delete cascade,
  status text not null default 'pending',  -- 'pending' | 'applied' | 'skipped'
  field_name text,
  old_value text,
  new_value text,
  ai_summary text,
  source_id uuid references company_sources(id) on delete set null,
  created_at timestamptz default now()
);

-- 3. ai_summary column on ow_companies
alter table ow_companies add column if not exists ai_summary text;

-- 4. RLS policies
alter table company_sources enable row level security;
alter table company_sync_logs enable row level security;

-- Allow authenticated users who own the company
create policy "company_sources_owner" on company_sources
  for all using (
    company_id in (
      select id from ow_companies where user_id = auth.uid()
    )
  );

create policy "company_sync_logs_owner" on company_sync_logs
  for all using (
    company_id in (
      select id from ow_companies where user_id = auth.uid()
    )
  );

-- Service role can do anything
create policy "company_sources_service" on company_sources
  for all using (true) with check (true);

create policy "company_sync_logs_service" on company_sync_logs
  for all using (true) with check (true);
