-- ════════════════════════════════════════════════════════════════════════
-- 保存した条件: お知らせの頻度・チームで共有・担当者ごとの「前回見た日時」（2026-10-10 / 候補者探し 段3）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★足すだけ（古いコードは新しい列を知らないだけで壊れない）。
--
-- ★新着の数え方（柴さんの決めごと）: その条件に合う人のうち、
--   ・前回見た日時より後に**新しく登録した**人（ow_users.created_at）
--   ・前回見た日時より後に**本人がプロフィールの中身を編集した**人（ow_users.profile_edited_at）
--   の2つだけ。⚠️ 転職意欲・声かけの受け取り・ブロック解除などで「見えるようになった」人は数えない
--   （いつ転職を考え始めたか・いつ声かけを受け取り始めたかが企業に伝わるため）。
--
-- ★前回見た日時の初期値: 保存した時点（作った人）／共有された条件を他の担当者が初めて開いた時点。
--   保存した瞬間に、いま居る全員が新着に数えられないようにするため。
--
-- ★書き込みは API（service_role）だけ。どちらの表もクライアントのロールには新しい権限を配らない。
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.ow_saved_candidate_searches
  add column if not exists notify_frequency text not null default 'none',
  add column if not exists is_shared boolean not null default false,
  add column if not exists last_notified_at timestamptz;

alter table public.ow_saved_candidate_searches drop constraint if exists saved_search_notify_frequency_check;
alter table public.ow_saved_candidate_searches add constraint saved_search_notify_frequency_check
  check (notify_frequency in ('daily', 'weekly', 'none'));

comment on column public.ow_saved_candidate_searches.notify_frequency is
  '新着のお知らせ（2026-10-10）: daily（毎朝8時）/ weekly（毎週月曜8時）/ none（受け取らない）。送るのは作った人だけ。作った人がその企業の有効な担当者でなくなったら送らない';
comment on column public.ow_saved_candidate_searches.is_shared is
  'チームで共有（2026-10-10）。true なら同じ企業の担当者が「見る・この条件で探す」をできる。編集は作った人だけ、削除は作った人と企業の管理者';
comment on column public.ow_saved_candidate_searches.last_notified_at is
  '最後にお知らせのメールを送った日時（2026-10-10）。同じ人を次のメールで重ねて数えないために使う';

create table if not exists public.ow_saved_search_views (
  search_id uuid not null references public.ow_saved_candidate_searches(id) on delete cascade,
  viewer_user_id uuid not null references public.ow_users(id) on delete cascade,
  last_viewed_at timestamptz not null default now(),
  primary key (search_id, viewer_user_id)
);
comment on table public.ow_saved_search_views is
  '保存した条件ごと・担当者ごとの「前回見た日時」（2026-10-10）。その条件で一覧を開いたときに更新する。⚠ viewer_user_id は ow_users.id 空間。書き込みは API だけ';

alter table public.ow_saved_search_views enable row level security;
revoke all on public.ow_saved_search_views from anon, authenticated;

do $$
begin
  if has_table_privilege('authenticated', 'public.ow_saved_search_views', 'SELECT')
     or has_table_privilege('anon', 'public.ow_saved_search_views', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_saved_candidate_searches', 'INSERT')
     or has_table_privilege('authenticated', 'public.ow_saved_candidate_searches', 'UPDATE') then
    raise exception '検算失敗: クライアントのロールに書き込み・読み取りが開いている';
  end if;
  raise notice '検算OK: お知らせの頻度・共有・前回見た日時を足した';
end $$;

commit;

-- ★戻すとき:
--   drop table public.ow_saved_search_views;
--   alter table public.ow_saved_candidate_searches drop column notify_frequency, drop column is_shared, drop column last_notified_at;
