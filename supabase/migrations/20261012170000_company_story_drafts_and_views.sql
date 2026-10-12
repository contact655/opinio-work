-- ════════════════════════════════════════════════════════════════════════
-- 企業ストーリー: 公開中の記事の「未公開の変更」と、ストーリーの閲覧数（2026-10-12 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- ① ow_company_post_drafts（新規）
--    公開中のストーリーを編集したとき、「変更を公開する」を押すまでの内容をここに置く。
--    ⚠️★ow_company_posts に列（draft_data）として足さないこと。
--       ow_company_posts は anon にテーブル単位の SELECT があり、公開中の行は
--       `public_read_published_posts` で誰でも読める（2026-10-12 実測）。列を足すと
--       **公開前の書きかけが PostgREST からそのまま読める。**
--    権限は ow_transitions と同じ形: RLS 有効・ポリシー0本・anon / authenticated に GRANT 無し。
--    読み書きは /biz/posts のサーバー（admin クライアント）だけ。会社の担当者かは呼び出し側が確かめる。
--    ⚠️ 下書き（未公開）のストーリーは従来どおり ow_company_posts を直接書く（誰にも見えないため）。
--
-- ② ow_page_view_daily.page_type に 'story' を足す
--    target_id は ow_company_posts.id。数えるのは企業ページのストーリーのカードが画面に出たとき
--    （POST /api/views。判定は lib/views/decide.ts）。
-- ════════════════════════════════════════════════════════════════════════

begin;

create table public.ow_company_post_drafts (
  post_id               uuid primary key references public.ow_company_posts(id) on delete cascade,
  company_id            uuid not null references public.ow_companies(id) on delete cascade,
  title                 text not null default '',
  body                  text not null default '',
  category              text not null default 'culture',
  cover_image_url       text,
  updated_by_ow_user_id uuid references public.ow_users(id) on delete set null,
  updated_at            timestamptz not null default now()
);

comment on table public.ow_company_post_drafts is
  '公開中の企業ストーリーの未公開の変更（2026-10-12）。「変更を公開する」で ow_company_posts に移して消す。⚠️ ow_company_posts は anon が読めるので、書きかけをそちらの列に置かないこと。読み書きは admin クライアントだけ。';

alter table public.ow_company_post_drafts enable row level security;
revoke all on public.ow_company_post_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.ow_company_post_drafts to service_role;

-- ② 閲覧の種類に story を足す
alter table public.ow_page_view_daily drop constraint ow_page_view_daily_page_type_check;
alter table public.ow_page_view_daily
  add constraint ow_page_view_daily_page_type_check check (page_type in ('company', 'job', 'story'));

do $$
begin
  if has_table_privilege('anon', 'public.ow_company_post_drafts', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_company_post_drafts', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_company_post_drafts', 'INSERT') then
    raise exception '検算失敗: クライアントのロールが下書きを読み書きできる';
  end if;
  if not has_table_privilege('service_role', 'public.ow_company_post_drafts', 'SELECT') then
    raise exception '検算失敗（陽性対照）: service_role が読めない';
  end if;
  if (select count(*) from pg_constraint
       where conname = 'ow_page_view_daily_page_type_check'
         and pg_get_constraintdef(oid) like '%story%') <> 1 then
    raise exception '検算失敗: page_type に story が入っていない';
  end if;
  raise notice '検算OK';
end $$;

commit;
