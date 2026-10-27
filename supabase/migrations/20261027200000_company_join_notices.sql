-- ★担当者がいない会社には名前を届けない。「この会社がOPINIOに参加したら知らせる」にする（2026-10-27 / 柴さんの決定）
--
-- ① ow_company_join_notices を作る（「知らせてほしい」の記録）。企業には何も渡さない。
--    担当者が登録されたら本人に知らせる（notified_at）。名前が届くのは本人が改めて「話を聞いてみたい」を押したときだけ。
--    ⚠️ ow_for_you_reactions には入れない。あちらは reaction（話を聞いてみたい／あとで／興味なし）が必須で、
--       interested_at は企業との会話を開く理由（openReason.ts）になる。混ぜると「知らせてほしい」が会話を開けてしまう。
--    権限: RLS 有効・ポリシー0本・anon / authenticated に GRANT なし（読み書きはサーバーの admin クライアントだけ）
-- ② ow_for_you_reactions.interest_status から担当者の登録待ち（awaiting_contact）と期限切れ（expired）を外す（0行を確認してから）。
--    使わなくなった列（reask_notified_at など）は残す（消さない）
-- ③ 通知の種別: interest_delivered / interest_reask を外し、interest_company_joined を足す（外す2種は 0行を確認してから）
--
-- 作業前ダンプ: .dumps/20261027-1836-ow_for_you_reactions-ow_notifications.sql（ow_for_you_reactions 2行 / ow_notifications 22行）
-- 戻し方: ow_company_join_notices を drop し、①②③の CHECK を 20261027180000 の定義に戻す

begin;

do $$
declare n int;
begin
  select count(*) into n from public.ow_for_you_reactions where interest_status in ('awaiting_contact', 'expired');
  if n <> 0 then raise exception '想定外: 登録待ち・期限切れの行が % 行', n; end if;
  select count(*) into n from public.ow_notifications where type in ('interest_delivered', 'interest_reask');
  if n <> 0 then raise exception '想定外: 外す種別の通知が % 行', n; end if;
end $$;

-- ①
create table public.ow_company_join_notices (
  user_id uuid not null references public.ow_users(id) on delete cascade,
  company_id uuid not null references public.ow_companies(id) on delete cascade,
  source text not null check (source in ('company_page', 'for_you')),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  ops_notified_at timestamptz,
  primary key (user_id, company_id)
);
comment on table public.ow_company_join_notices is '担当者がいない会社で「この会社がOPINIOに参加したら知らせる」を押した記録（2026-10-27）。企業には何も渡さない。担当者が登録されたら本人に知らせる（notified_at）。読み書きは lib/interest/server.ts だけ';
comment on column public.ow_company_join_notices.notified_at is '担当者の登録を本人に知らせた日時（ベルの interest_company_joined）。名前は届けていない';
comment on column public.ow_company_join_notices.ops_notified_at is '運営にメールで知らせた日時（初めて押したときだけ）';
create index ow_company_join_notices_pending_idx on public.ow_company_join_notices (company_id) where notified_at is null;

alter table public.ow_company_join_notices enable row level security;
revoke all on public.ow_company_join_notices from anon, authenticated;
grant all on public.ow_company_join_notices to service_role;

-- ②
alter table public.ow_for_you_reactions drop constraint ow_for_you_reactions_interest_status_check;
alter table public.ow_for_you_reactions add constraint ow_for_you_reactions_interest_status_check
  check (interest_status is null or interest_status in ('delivered', 'replied', 'no_reply'));
comment on column public.ow_for_you_reactions.interest_status is 'delivered / replied / no_reply。判定は lib/interest/server.ts。担当者の登録待ち・期限切れは 2026-10-27 にやめた（担当者がいない会社は ow_company_join_notices）';
comment on column public.ow_for_you_reactions.reask_notified_at is '【未使用】2026-10-27 に「90日を過ぎたらもう一度押すか聞く」をやめた。列は残す';

-- ③
alter table public.ow_notifications drop constraint ow_notifications_type_check;
alter table public.ow_notifications add constraint ow_notifications_type_check check (type = any (array[
  'like', 'comment', 'reply', 'comment_like', 'message', 'proposal', 'introduction', 'message_request',
  'message_request_accepted', 'company_approach', 'meeting_canceled', 'follow',
  'interest_no_reply', 'interest_company_joined'
]::text[]));

alter table public.ow_notifications drop constraint ow_notifications_target_check;
alter table public.ow_notifications add constraint ow_notifications_target_check check (
     (type = any (array['like', 'comment']::text[]) and post_id is not null and actor_user_id is not null)
  or (type = any (array['reply', 'comment_like']::text[]) and post_id is not null and comment_id is not null and actor_user_id is not null)
  or (type = any (array['message', 'message_request', 'message_request_accepted']::text[]) and conversation_id is not null and actor_user_id is not null)
  or (type = 'proposal' and proposal_id is not null and actor_company_id is not null)
  or (type = 'introduction' and conversation_id is not null and proposal_id is not null and actor_company_id is not null)
  or (type = 'company_approach' and approach_id is not null and actor_company_id is not null)
  or (type = 'meeting_canceled' and conversation_id is not null and actor_company_id is not null)
  or (type = 'follow' and actor_user_id is not null)
  or (type = any (array['interest_no_reply', 'interest_company_joined']::text[]) and actor_company_id is not null)
);

-- 検算
do $$
begin
  if has_table_privilege('authenticated', 'public.ow_company_join_notices', 'SELECT')
     or has_table_privilege('anon', 'public.ow_company_join_notices', 'SELECT') then
    raise exception 'ow_company_join_notices が anon / authenticated から読める';
  end if;
  if (select count(*) from public.ow_for_you_reactions) <> 2 then raise exception 'reactions の件数が変わった'; end if;
  if (select count(*) from public.ow_notifications) <> 22 then raise exception 'notifications の件数が変わった'; end if;
end $$;

commit;
