-- 規約同意記録テーブル
create table if not exists ow_terms_agreements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  company_id  uuid references ow_companies(id) on delete set null,
  terms_type  text not null,        -- 'business' | 'user'
  terms_version text not null,      -- '2026-08-01'
  agreed_at   timestamptz not null default now(),
  ip_address  inet,
  user_agent  text
);

-- RLS
alter table ow_terms_agreements enable row level security;

-- 本人は自分の同意記録を読める
create policy "own read" on ow_terms_agreements
  for select using (auth.uid() = user_id);

-- admin は全件読める
create policy "admin read" on ow_terms_agreements
  for select using (
    exists (
      select 1 from ow_user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- 本人のみ INSERT（user_id を自分のUIDに固定）
create policy "own insert" on ow_terms_agreements
  for insert with check (auth.uid() = user_id);
