-- Migration 112: ow_articles テーブル作成
-- 記事コンテンツ（インタビュー/メンター/CEO/レポート）を格納する。
-- 現在は /articles, /articles/[slug] がこのテーブルを参照する。
-- テーブルが存在しない間は queries.ts の mock フォールバックが自動使用される。

create table if not exists ow_articles (
  -- ── Primary key ──────────────────────────────────────────────────────────────
  id              uuid        primary key default gen_random_uuid(),

  -- ── URL / 識別 ───────────────────────────────────────────────────────────────
  slug            text        not null unique,
  type            text        not null check (type in ('employee', 'mentor', 'ceo', 'report')),

  -- ── 基本情報 ──────────────────────────────────────────────────────────────────
  title           text        not null,
  subtitle        text,
  read_min        int         not null default 5,
  eyecatch_gradient text,

  -- ── 公開管理 ──────────────────────────────────────────────────────────────────
  is_published    boolean     not null default false,
  published_at    timestamptz,

  -- ── 企業リンク（テキストコピー方式、JOIN なし） ────────────────────────────────────
  -- ow_companies.id への外部キーも持てるが、記事は企業削除後も残るためテキストコピーを優先
  company_id          uuid        references ow_companies(id) on delete set null,
  company_slug        text,       -- URL フラグメント用（例: "layerx"）
  company_name_text   text,       -- 記事公開時の会社名スナップショット
  company_initial_text text,      -- ロゴイニシャル
  company_gradient_text text,     -- ロゴグラデーション

  -- ── 取材対象（JSON freeze）────────────────────────────────────────────────────
  -- 単数取材: subject_freeze (ArticleSubject)
  -- 複数取材: subjects_freeze (ArticleSubject[])
  subject_freeze  jsonb,          -- { initial, gradient, name, role_at_interview, current_status, is_mentor, mentor_id? }
  subjects_freeze jsonb,          -- [ ...ArticleSubject ]

  -- ── 本文ブロック（JSON） ──────────────────────────────────────────────────────
  editor_note     text,
  body_blocks     jsonb,          -- string[] (パラグラフ)
  quote           text,
  qa_blocks       jsonb,          -- { q: string; a: string[] }[]
  themes_blocks   jsonb,          -- { icon: string; title: string; desc: string }[]
  chapters        jsonb,          -- { num: string; title: string; body: string[]; list?: {key,value}[] }[]
  editor_outro    text,

  -- ── 関連リンク ────────────────────────────────────────────────────────────────
  related_job_ids         text[]  default '{}',   -- ow_jobs.id (UUID)
  related_article_slugs   text[]  default '{}',   -- ow_articles.slug

  -- ── タイムスタンプ ────────────────────────────────────────────────────────────
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- updated_at 自動更新トリガー
create or replace function update_ow_articles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ow_articles_updated_at on ow_articles;
create trigger trg_ow_articles_updated_at
  before update on ow_articles
  for each row execute function update_ow_articles_updated_at();

-- ── インデックス ─────────────────────────────────────────────────────────────────
create index if not exists idx_ow_articles_slug         on ow_articles (slug);
create index if not exists idx_ow_articles_type         on ow_articles (type);
create index if not exists idx_ow_articles_published_at on ow_articles (published_at desc);
create index if not exists idx_ow_articles_company_id   on ow_articles (company_id);
create index if not exists idx_ow_articles_is_published on ow_articles (is_published);

-- ── RLS ─────────────────────────────────────────────────────────────────────────
alter table ow_articles enable row level security;

-- 公開記事は誰でも閲覧可能（anon/authenticated 共通）
create policy "ow_articles: public read"
  on ow_articles for select
  using (is_published = true);

-- dev 環境（または管理者）は全件閲覧可能
-- 注意: 管理者向け全件アクセスが必要な場合は auth_is_admin() ベースの policy を追加する
-- create policy "ow_articles: admin read all"
--   on ow_articles for select
--   using (auth_is_admin());

-- 管理者のみ INSERT / UPDATE / DELETE 可
create policy "ow_articles: admin write"
  on ow_articles for all
  using (auth_is_admin())
  with check (auth_is_admin());

comment on table ow_articles is '記事コンテンツ（インタビュー/メンター/CEO/レポート）。公開前は is_published = false。';
comment on column ow_articles.subject_freeze   is '単数取材対象のスナップショット（JSON）';
comment on column ow_articles.subjects_freeze  is '複数取材対象のスナップショット配列（JSON）';
comment on column ow_articles.body_blocks      is 'パラグラフ本文の配列（JSON string[]）';
comment on column ow_articles.qa_blocks        is 'Q&Aブロック配列（JSON {q,a[]}[]）';
comment on column ow_articles.themes_blocks    is 'テーマカードブロック配列（JSON {icon,title,desc}[]）';
comment on column ow_articles.chapters         is 'チャプター配列（JSON {num,title,body[],list?}[]）';
