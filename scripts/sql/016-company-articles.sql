-- 記事テーブル
create table if not exists company_articles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references ow_companies(id) on delete cascade,
  title text not null,
  body text not null,
  thumbnail_url text,
  tag text,
  author_name text,
  author_label text,
  is_published boolean default false,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table company_articles enable row level security;

-- 公開済み記事は誰でも読める
create policy "anyone can read published articles"
  on company_articles for select
  using (is_published = true);

-- 認証ユーザーは書き込める
create policy "authenticated users can manage articles"
  on company_articles for all
  using (auth.uid() is not null);
