-- ════════════════════════════════════════════════════════════════════════
-- 話す人の立場と、話せる量（2026-11-03 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- 決めたこと:
--   ・立場は3つから1つ: recruiter（採用担当）／ referral（紹介制度のある社員）／ personal（個人として）
--     ★recruiter は「所属企業で talk_recruiter が許された担当者」だけが選べる（判定はアプリ。lib/talk/server.ts）。
--       その会社を stance_company_id に持つ。
--   ・話せる量は3つ: none（今は話せない・初期値）／ monthly_one（月1件まで）／ active（積極的に）
--   ・依頼 = つながっていない人への最初の1通（メッセージのお願い）。ow_talk_requests に1件ずつ記録する。
--     14日間返事が無ければ自動で辞退扱い（毎日の cron）。
--   ・誰が誰に依頼したかは当事者2人にしか見せない → どちらの表も anon / authenticated に権限なし・ポリシー0本。
--     読み書きは API（service role）だけ。
--
-- ⚠️ 追加だけ。既存の表・データは変えない。auth_company_can は CREATE OR REPLACE で1行足すだけ（引数は変えない）。
--
-- 戻し方: drop table public.ow_talk_requests; drop table public.ow_talk_settings;
--         auth_company_can は下の when 'talk_recruiter' の行を外して CREATE OR REPLACE し直す。
-- ════════════════════════════════════════════════════════════════════════

begin;

create table public.ow_talk_settings (
  user_id           uuid primary key references public.ow_users(id) on delete cascade,
  stance            text check (stance in ('recruiter', 'referral', 'personal')),
  -- 採用担当のときだけ、どの会社の採用担当か。⚠️ 会社が消えたら設定ごと消す（立場の無い「採用担当」を残さない）
  stance_company_id uuid references public.ow_companies(id) on delete cascade,
  capacity          text not null default 'none' check (capacity in ('none', 'monthly_one', 'active')),
  updated_at        timestamptz not null default now(),
  constraint ow_talk_settings_recruiter_company check ((stance = 'recruiter') = (stance_company_id is not null)),
  -- 話せる設定にするなら立場が要る
  constraint ow_talk_settings_stance_when_open check (capacity = 'none' or stance is not null)
);

comment on table public.ow_talk_settings is
  '話す人の立場と話せる量（2026-11-03）。行が無い＝今は話せない。読み書きは API（service role）だけ。anon / authenticated に GRANT しない・ポリシーを書かない。';

create table public.ow_talk_requests (
  id                uuid primary key default gen_random_uuid(),
  -- 依頼の実体（つながっていない人への最初の1通）。1つの会話に依頼は1件
  conversation_id   uuid not null unique references public.ow_conversations(id) on delete cascade,
  requester_user_id uuid not null references public.ow_users(id) on delete cascade,
  target_user_id    uuid not null references public.ow_users(id) on delete cascade,
  status            text not null default 'pending' check (status in ('pending', 'answered', 'auto_declined')),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  constraint ow_talk_requests_no_self check (requester_user_id <> target_user_id),
  constraint ow_talk_requests_resolved check ((status = 'pending') = (resolved_at is null))
);

-- 月1件の判定（受けた人 × 月）と、14日の自動辞退（pending の古いもの）
create index ow_talk_requests_target_created_idx on public.ow_talk_requests(target_user_id, created_at);
create index ow_talk_requests_pending_idx on public.ow_talk_requests(created_at) where status = 'pending';

comment on table public.ow_talk_requests is
  '話を聞く依頼（2026-11-03）。つながっていない人への最初の1通ごとに1件。14日返事が無ければ auto_declined（cron /api/cron/expire-talk-requests）。当事者2人にしか見せない。読み書きは API（service role）だけ。';

alter table public.ow_talk_settings enable row level security;
alter table public.ow_talk_requests enable row level security;
revoke all on table public.ow_talk_settings from public, anon, authenticated;
revoke all on table public.ow_talk_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.ow_talk_settings to service_role;
grant select, insert, update, delete on table public.ow_talk_requests to service_role;

-- ★採用担当として話せるか（talk_recruiter）を1つ足す。⚠️ lib/auth/roles.ts の "talk.asRecruiter"（管理者・採用担当）と同じ
create or replace function public.auth_company_can(p_company_id uuid, p_action text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- ★呼んだ本人がその会社で何をしてよいかだけを答える。⚠️ 段の意味は冒頭のコメントと lib/auth/roles.ts の DB_LEVEL
  select coalesce((
    select case p_action
             when 'member' then true
             when 'view'   then ca.permission in ('admin', 'recruiter', 'viewer')
             when 'work'   then ca.permission in ('admin', 'recruiter')
             when 'admin'  then ca.permission = 'admin'
             when 'talk_recruiter' then ca.permission in ('admin', 'recruiter')
             else false
           end
      from public.ow_company_admins ca
      join public.ow_users u on u.id = ca.user_id
     where ca.company_id = p_company_id
       and u.auth_id = auth.uid()
       and ca.is_active = true
     limit 1
  ), false);
$function$;

-- ★適用の中で確かめる
do $$
declare t text;
begin
  foreach t in array array['public.ow_talk_settings','public.ow_talk_requests'] loop
    if has_table_privilege('anon', t, 'SELECT')
       or has_table_privilege('authenticated', t, 'SELECT')
       or has_table_privilege('authenticated', t, 'INSERT')
       or has_table_privilege('authenticated', t, 'UPDATE')
       or has_table_privilege('authenticated', t, 'DELETE') then
      raise exception '% にクライアントのロールの権限が残っている', t;
    end if;
    if (select count(*) from pg_policy where polrelid = t::regclass) <> 0 then
      raise exception '% にポリシーがある（0本のはず）', t;
    end if;
    if not has_table_privilege('service_role', t, 'INSERT') then
      raise exception '% に service_role が書けない', t;
    end if;
  end loop;
  -- ★関数は引数を変えていないので、既存の権限（ACL）はそのまま残る。足した行が効いているかだけ見る
  if position('talk_recruiter' in pg_get_functiondef('public.auth_company_can(uuid,text)'::regprocedure)) = 0 then
    raise exception 'auth_company_can に talk_recruiter が入っていない';
  end if;
end $$;

commit;
