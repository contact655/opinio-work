-- ★ホームの「おすすめのユーザー」で×を押した記録（2026-11-04 / 柴さんの指示）。
--   押した人（viewer）が、その人（target）を30日間出さないために使う。30日の判定はアプリ側（lib/people/suggest.ts の USER_SUGGEST_DISMISS_DAYS）。
--
-- ⚠️★まだ本番に当てていない。柴さんの了承を得てから supabase/migrations/ へ移して当てる（supabase/pending/README.md）。
--   当てる前でもアプリは動く: 読めないときは「外した人がいない」として続け、×はその場で隠すが保存に失敗した旨を出す。
--
-- 権限: 読み書きは admin クライアント（API）だけ。RLS 有効・ポリシー0本・anon / authenticated に権限なし
--   （ow_transitions・ow_proposals と同じ形）。誰が誰を外したかは本人にも PostgREST から読ませない。
-- 消し方（戻し方）: drop table public.ow_user_suggestion_dismissals;（他の表から参照されていない）
-- 作業前ダンプ: 新しい表なので不要（既存の行を変えない）

begin;

create table public.ow_user_suggestion_dismissals (
  viewer_user_id uuid not null references public.ow_users(id) on delete cascade,
  target_user_id uuid not null references public.ow_users(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (viewer_user_id, target_user_id),
  constraint ow_user_suggestion_dismissals_not_self check (viewer_user_id <> target_user_id)
);

comment on table public.ow_user_suggestion_dismissals is
  'ホームの「おすすめのユーザー」で×を押した記録。押した人にだけ効く（30日間その人を出さない。判定はアプリ側）。読み書きは admin クライアントだけ';

create index ow_user_suggestion_dismissals_target_idx on public.ow_user_suggestion_dismissals (target_user_id);

alter table public.ow_user_suggestion_dismissals enable row level security;
revoke all on public.ow_user_suggestion_dismissals from anon, authenticated;
grant all on public.ow_user_suggestion_dismissals to service_role;

-- 検算: anon / authenticated から読めない・書けない
do $$
begin
  if has_table_privilege('anon', 'public.ow_user_suggestion_dismissals', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_user_suggestion_dismissals', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_user_suggestion_dismissals', 'INSERT') then
    raise exception 'ow_user_suggestion_dismissals に anon / authenticated の権限が残っている';
  end if;
  if exists (select 1 from pg_policy where polrelid = 'public.ow_user_suggestion_dismissals'::regclass) then
    raise exception 'ow_user_suggestion_dismissals にポリシーがある（0本のはず）';
  end if;
end $$;

commit;
