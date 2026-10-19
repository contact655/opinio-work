-- ★フィードのコメントに「返信」と「いいね」を足す（2026-10-20 / 柴さんの要望）
--
-- 何を（すべて追加。既存の行・列は変えない）:
--   1. ow_post_comments.parent_comment_id … どのコメントへの返信か（null ＝ 投稿へのコメント）
--      ・返信は1段だけ（返信への返信は、元のコメントへの返信として同じ段に並べる。LinkedIn と同じ形）
--      ・親と同じ投稿でなければ入らない（トリガーで止める）
--      ・親を消したら返信も消える（ON DELETE CASCADE）
--   2. ow_post_comment_likes … コメント（返信を含む）へのいいね。ow_post_likes と同じ形・同じ RLS
--   3. ow_notifications の type に 'reply'（返信が来た）と 'comment_like'（コメントにいいね）を足す
--      ⚠️ どちらも post_id・comment_id・actor_user_id を必須にする（押した先＝投稿が要る）
--
-- 権限:
--   ・ow_post_comments は authenticated にテーブル単位で SELECT/INSERT/DELETE 済み（列を足せば使える）。anon は無し
--   ・新しい表も anon には配らない。authenticated に SELECT/INSERT/DELETE、RLS で「自分の行だけ」書ける
--
-- 戻し方（逆順に）:
--   alter table ow_notifications drop constraint ow_notifications_type_check / _target_check を前の定義で張り直す
--   drop table public.ow_post_comment_likes;
--   drop trigger trg_guard_comment_parent on public.ow_post_comments; drop function public.guard_comment_parent();
--   alter table public.ow_post_comments drop column parent_comment_id;
--
-- 作業前の状態（2026-10-20 / 本番・読み取りのみ）: ow_post_comments 0行 ／ ow_post_likes 1行

begin;

-- 1. 返信 ---------------------------------------------------------------------
alter table public.ow_post_comments
  add column parent_comment_id uuid null references public.ow_post_comments(id) on delete cascade;
create index ow_post_comments_parent_idx on public.ow_post_comments(parent_comment_id) where parent_comment_id is not null;

comment on column public.ow_post_comments.parent_comment_id is
  'どのコメントへの返信か（2026-10-20）。null ＝ 投稿へのコメント。返信は1段だけ（親は必ず parent_comment_id が null）。親と同じ投稿に限る（trg_guard_comment_parent）';

create or replace function public.guard_comment_parent()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare p record;
begin
  if new.parent_comment_id is null then return new; end if;
  select post_id, parent_comment_id into p from public.ow_post_comments where id = new.parent_comment_id;
  if not found then raise exception '返信先のコメントがありません' using errcode = '23503'; end if;
  if p.post_id <> new.post_id then raise exception '返信先は同じ投稿のコメントに限ります' using errcode = '23514'; end if;
  if p.parent_comment_id is not null then raise exception '返信への返信はできません（元のコメントへ返信してください）' using errcode = '23514'; end if;
  return new;
end $$;

create trigger trg_guard_comment_parent
  before insert or update of parent_comment_id, post_id on public.ow_post_comments
  for each row execute function public.guard_comment_parent();

-- 2. コメントへのいいね ---------------------------------------------------------
create table public.ow_post_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.ow_post_comments(id) on delete cascade,
  user_id uuid not null references public.ow_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);
comment on table public.ow_post_comment_likes is
  'コメント（返信を含む）へのいいね（2026-10-20）。ow_post_likes と同じ形・同じ RLS';

alter table public.ow_post_comment_likes enable row level security;
revoke all on public.ow_post_comment_likes from anon;
grant select, insert, delete on public.ow_post_comment_likes to authenticated;

create policy ow_post_comment_likes_select_authenticated on public.ow_post_comment_likes
  for select to authenticated using (auth.uid() is not null);
create policy post_comment_likes_insert_own on public.ow_post_comment_likes
  for insert to authenticated
  with check (user_id = (select ow_users.id from public.ow_users where ow_users.auth_id = auth.uid() limit 1));
create policy post_comment_likes_delete_own on public.ow_post_comment_likes
  for delete to authenticated
  using (user_id = (select ow_users.id from public.ow_users where ow_users.auth_id = auth.uid() limit 1));

-- 3. 通知の種類 -----------------------------------------------------------------
alter table public.ow_notifications drop constraint ow_notifications_type_check;
alter table public.ow_notifications add constraint ow_notifications_type_check check (type = any (array[
  'like','comment','reply','comment_like','message','proposal','introduction',
  'message_request','message_request_accepted','company_approach','meeting_canceled'
]));

alter table public.ow_notifications drop constraint ow_notifications_target_check;
alter table public.ow_notifications add constraint ow_notifications_target_check check (
     ((type = any (array['like','comment'])) and post_id is not null and actor_user_id is not null)
  or ((type = any (array['reply','comment_like'])) and post_id is not null and comment_id is not null and actor_user_id is not null)
  or ((type = any (array['message','message_request','message_request_accepted'])) and conversation_id is not null and actor_user_id is not null)
  or ((type = 'proposal') and proposal_id is not null and actor_company_id is not null)
  or ((type = 'introduction') and conversation_id is not null and proposal_id is not null and actor_company_id is not null)
  or ((type = 'company_approach') and approach_id is not null and actor_company_id is not null)
  or ((type = 'meeting_canceled') and conversation_id is not null and actor_company_id is not null)
);

-- 検算 --------------------------------------------------------------------------
do $$
begin
  if has_table_privilege('anon', 'public.ow_post_comment_likes', 'SELECT') then
    raise exception 'anon に ow_post_comment_likes の SELECT が付いている';
  end if;
  if not has_column_privilege('authenticated', 'public.ow_post_comments', 'parent_comment_id', 'INSERT') then
    raise exception 'authenticated が parent_comment_id を書けない';
  end if;
end $$;

commit;
