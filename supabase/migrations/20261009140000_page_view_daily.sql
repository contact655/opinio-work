-- ════════════════════════════════════════════════════════════════════════
-- 企業ページ・求人詳細の閲覧数を「日ごとの件数」で持つ（2026-10-09 / 段階D）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★方針（柴さんの指示）
--   ・閲覧者の ID は保存しない。ページ（企業ページ・求人詳細）ごと・日ごとの件数だけを残す
--   ・同じ人・同じページを1日1回に数えるのは、ブラウザ側の印（cookie。個人を特定しない）で行う
--   ・検証用・運営・その企業の有効な担当者の閲覧は、書く前に除く（POST /api/views）
--   ・日ごとの集計なので、古い行を消す処理は持たない
--
-- ★権限は ow_transitions と同じ形
--   RLS 有効・ポリシー0本・anon / authenticated に GRANT 無し。読むのも書くのも service_role だけ。
--   ⚠️ 増やすのは increment_page_view() だけ（行ごとの UPDATE をアプリに書かせない）。
--
-- ⚠️ view_date は日本時間の日付（呼び出し側が渡す）。
-- ⚠️ target_id は企業ページなら ow_companies.id、求人詳細なら ow_jobs.id（FK は張らない。
--    種類で参照先が変わるため）。company_id は両方とも「その企業」で、企業の削除で消える。
-- ════════════════════════════════════════════════════════════════════════

begin;

create table public.ow_page_view_daily (
  view_date   date        not null,
  page_type   text        not null check (page_type in ('company', 'job')),
  target_id   uuid        not null,
  company_id  uuid        not null references public.ow_companies(id) on delete cascade,
  views       integer     not null default 0 check (views >= 0),
  updated_at  timestamptz not null default now(),
  primary key (view_date, page_type, target_id)
);

create index ow_page_view_daily_company_date on public.ow_page_view_daily (company_id, view_date);

comment on table public.ow_page_view_daily is
  '企業ページ・求人詳細の日ごとの閲覧数（2026-10-09）。閲覧者の ID は持たない。書くのは POST /api/views → increment_page_view() だけ。読むのは /biz/analytics（admin クライアント）。';

alter table public.ow_page_view_daily enable row level security;
revoke all on public.ow_page_view_daily from public, anon, authenticated;
grant select, insert, update on public.ow_page_view_daily to service_role;

-- 1件増やす。同じ日・同じページの行が無ければ作る。
-- ⚠️ SECURITY INVOKER（呼ぶのは service_role だけ）。
create or replace function public.increment_page_view(
  p_view_date date,
  p_page_type text,
  p_target_id uuid,
  p_company_id uuid
) returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.ow_page_view_daily (view_date, page_type, target_id, company_id, views)
  values (p_view_date, p_page_type, p_target_id, p_company_id, 1)
  on conflict (view_date, page_type, target_id)
  do update set views = public.ow_page_view_daily.views + 1, updated_at = now();
$$;

revoke execute on function public.increment_page_view(date, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.increment_page_view(date, text, uuid, uuid) to service_role;

do $$
begin
  if has_table_privilege('anon', 'public.ow_page_view_daily', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_page_view_daily', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_page_view_daily', 'INSERT') then
    raise exception '検算失敗: クライアントのロールに権限が残っている';
  end if;
  if has_function_privilege('anon', 'public.increment_page_view(date, text, uuid, uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.increment_page_view(date, text, uuid, uuid)', 'EXECUTE') then
    raise exception '検算失敗: クライアントのロールが増やせる';
  end if;
  if not has_function_privilege('service_role', 'public.increment_page_view(date, text, uuid, uuid)', 'EXECUTE') then
    raise exception '検算失敗（陽性対照）: service_role が増やせない';
  end if;
  raise notice '検算OK: 閲覧数の表はサーバーからだけ読み書きできる';
end $$;

commit;
