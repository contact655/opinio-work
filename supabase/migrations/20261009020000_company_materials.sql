-- ============================================================================
-- ★企業資料（依頼② フェーズ1a / 2026-10-09）
--   ow_company_material_documents … 登録された資料1件（ファイル or URL）
--   ow_company_material_items     … 項目1件（手入力。1b で AI の抽出も入る）
-- ============================================================================
-- ★公開範囲は3つ。語彙の唯一の出どころは src/lib/constants/companyMaterials.ts。
--     public       … 誰でも見られる（求職者向けの企業ページ）
--     after_mutual … 提案で双方が「会いたい」と答えた求職者だけ（表示は依頼③）
--     internal     … その企業の担当者とマッチングの処理だけ。求職者には一切見せない
--
-- ★権限は ow_proposals と同じ形（柴さんの決定）:
--     RLS 有効・ポリシー0本・anon / authenticated に GRANT なし。
--     読み書きはサーバーの admin クライアント（service_role）だけ。
--     所属と権限はルート側で getTenantContext により確かめる。
--   ⚠️★**ポリシーを足して authenticated に開けないこと。** 内部のみの項目が
--      PostgREST から読めるようになる（ow_proposals で同じ形の漏れを踏んでいる）。
--
-- ★DB 側で守ること（CHECK）:
--   ① 確定していない項目は internal のみ（公開も合意後開示も、確定が前提）
--   ② 選考に使ってはいけない内容（restricted_flag）は internal のみ
--   ③ 区分・公開範囲・資料の種類は CHECK で値を絞る（UI / API / DB の3つを揃える）
--   ⚠️ 本文を直したら確定を外す処理は**トリガーにしない**。
--      src/lib/companyMaterials/server.ts の更新関数1か所に置いてある。
--
-- ⚠️ ファイルの実体は Storage の非公開バケット `company-documents`
--    （{company_id}/{document_id}/{ファイル名}）。バケットは Storage API で作る
--    （storage.buckets に保護トリガーがあり SQL では作れない）。
-- ============================================================================

begin;

-- ── 資料 ─────────────────────────────────────────────────────────────────────
create table public.ow_company_material_documents (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.ow_companies(id) on delete cascade,
  source_type             text not null,
  title                   text not null,
  storage_path            text,
  source_url              text,
  mime_type               text,
  byte_size               bigint,
  status                  text not null default 'uploaded',
  error_message           text,
  created_by_ow_user_id   uuid references public.ow_users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint ow_company_material_documents_source_type_check
    check (source_type in ('file', 'url')),
  constraint ow_company_material_documents_status_check
    check (status in ('uploaded', 'extracting', 'ready', 'failed')),
  constraint ow_company_material_documents_title_check
    check (char_length(btrim(title)) between 1 and 200),
  -- ファイルなら Storage のパス、URL ならリンク。片方だけを持つ
  constraint ow_company_material_documents_source_check check (
       (source_type = 'file' and storage_path is not null and source_url is null)
    or (source_type = 'url'  and source_url is not null and storage_path is null)
  ),
  -- ⚠️ http / https のみ（javascript: などを入れさせない）
  constraint ow_company_material_documents_url_check
    check (source_url is null or source_url ~* '^https?://[^[:space:]]+$'),
  -- 10MB（10 × 1024 × 1024）。⚠️ 定数 MAX_MATERIAL_FILE_BYTES と揃える
  constraint ow_company_material_documents_size_check
    check (byte_size is null or (byte_size > 0 and byte_size <= 10485760)),
  -- 後段の複合 FK（項目の会社と資料の会社が同じであること）のため
  constraint ow_company_material_documents_id_company_key unique (id, company_id)
);

create index ow_company_material_documents_company_idx
  on public.ow_company_material_documents (company_id, created_at desc);

-- ── 項目 ─────────────────────────────────────────────────────────────────────
create table public.ow_company_material_items (
  id                        uuid primary key default gen_random_uuid(),
  company_id                uuid not null references public.ow_companies(id) on delete cascade,
  document_id               uuid,
  category                  text not null,
  content                   text not null,
  visibility                text not null default 'internal',
  ai_suggested_visibility   text,
  confirmed_at              timestamptz,
  confirmed_by_ow_user_id   uuid references public.ow_users(id) on delete set null,
  restricted_flag           boolean not null default false,
  restricted_reason         text,
  created_by_ow_user_id     uuid references public.ow_users(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- ★資料を消しても、確定済みの項目は残す（document_id だけ外す）。
  --   ⚠️ 複合 FK なので PostgREST の埋め込みは使えない（CLAUDE.md）。2段で引くこと。
  constraint ow_company_material_items_document_fkey
    foreign key (document_id, company_id)
    references public.ow_company_material_documents (id, company_id)
    on delete set null (document_id),

  constraint ow_company_material_items_category_check check (category in (
    'business', 'organization', 'workstyle', 'benefits',
    'selection', 'ideal_candidate', 'team_challenges', 'other'
  )),
  constraint ow_company_material_items_visibility_check
    check (visibility in ('public', 'after_mutual', 'internal')),
  constraint ow_company_material_items_ai_visibility_check
    check (ai_suggested_visibility is null or ai_suggested_visibility in ('public', 'after_mutual', 'internal')),
  constraint ow_company_material_items_content_check
    check (char_length(btrim(content)) between 1 and 2000),
  -- ★① 確定していない項目は internal のみ
  constraint ow_company_material_items_unconfirmed_internal_check
    check (visibility = 'internal' or confirmed_at is not null),
  -- ★② 選考に使ってはいけない内容は internal のみ
  constraint ow_company_material_items_restricted_internal_check
    check (not restricted_flag or visibility = 'internal'),
  -- 印を付けるなら理由を残す
  constraint ow_company_material_items_restricted_reason_check
    check (not restricted_flag or char_length(btrim(coalesce(restricted_reason, ''))) between 1 and 500)
);

create index ow_company_material_items_company_idx
  on public.ow_company_material_items (company_id, visibility);
create index ow_company_material_items_document_idx
  on public.ow_company_material_items (document_id);

-- ── 権限 ─────────────────────────────────────────────────────────────────────
alter table public.ow_company_material_documents enable row level security;
alter table public.ow_company_material_items     enable row level security;

-- ⚠️ postgres が作る表には既定で anon / authenticated の権限は付かないが、明示的に剥がす
revoke all on public.ow_company_material_documents from anon, authenticated;
revoke all on public.ow_company_material_items     from anon, authenticated;
grant all on public.ow_company_material_documents to service_role;
grant all on public.ow_company_material_items     to service_role;

comment on table public.ow_company_material_documents is
  '企業資料（依頼② 2026-10-09）。RLS 有効・ポリシー0本・anon/authenticated に GRANT なし。読み書きは admin クライアントだけ。';
comment on table public.ow_company_material_items is
  '企業資料の項目。公開範囲 public/after_mutual/internal。未確定・restricted は internal のみ（CHECK）。求職者向けは src/lib/companyMaterials/server.ts の公開用関数だけが読む。';

-- 検算
do $$
declare n int;
begin
  select count(*) into n from pg_policy
   where polrelid in ('public.ow_company_material_documents'::regclass, 'public.ow_company_material_items'::regclass);
  if n <> 0 then raise exception '検算失敗: ポリシーが %本ある（0本のはず）', n; end if;

  if has_table_privilege('anon', 'public.ow_company_material_items', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_company_material_items', 'SELECT')
     or has_table_privilege('anon', 'public.ow_company_material_documents', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_company_material_documents', 'SELECT') then
    raise exception '検算失敗: anon / authenticated に SELECT が付いている';
  end if;
end $$;

commit;
