-- 「話を聞いてみたい」の記録をそろえる（2026-10-27 / 話を聞きたい人 フェーズ1a・柴さんの決定）
--
-- 押したらその会社に名前とプロフィールが届く形を正式な仕様にした。企業ページ・合う会社（上段の提案・下段）の
-- どこから押しても、記録は ow_for_you_reactions の1行（利用者×企業）にそろえる。
--
-- ① ow_for_you_reactions に列を足す（既存の列は消さない）
--    interest_source        どこから押したか（for_you / company_page / proposal）
--    interest_note          本人のひとこと（任意・200字まで。提案の candidate_note と同じ上限）
--    consent_version        押すときに見せた確認の文言の版（lib/interest/constants.ts の INTEREST_CONSENT_VERSION）
--    interest_status        delivered（届け済み）／ awaiting_contact（担当者の登録待ち）／ replied（返事あり）／
--                           no_reply（返事なし・14日）／ expired（担当者の登録待ちのまま90日を過ぎた）
--    delivered_at           企業に届いた日時（会話ができた日時）
--    no_reply_notified_at   14日返事が無いことを本人に知らせた日時（二重に知らせない）
--    reask_notified_at      90日を過ぎたので、もう一度押すか本人に聞いた日時
--    rank_at を NULL 可にする（企業ページから押したときは順位が無い。合う会社から押したときは今までどおり入る）
-- ② ow_notifications の種別に3つ足す（interest_delivered / interest_no_reply / interest_reask）。
--    どれも会社（actor_company_id）を持つ。interest_delivered は会話（conversation_id）も持つ。
--
-- 既存の行は書き換えない（2行。どちらも interested_at が空）。作業前の控え:
--   .dumps/20261027-1732-ow_for_you_reactions-ow_notifications-ow_proposals.sql
-- 戻し方: 足した列と CHECK を落とし、rank_at を NOT NULL に戻し、通知の2つの CHECK を元の定義に戻す（下の旧定義）。

begin;

alter table public.ow_for_you_reactions
  add column interest_source text,
  add column interest_note text,
  add column consent_version text,
  add column interest_status text,
  add column delivered_at timestamptz,
  add column no_reply_notified_at timestamptz,
  add column reask_notified_at timestamptz;

alter table public.ow_for_you_reactions alter column rank_at drop not null;
alter table public.ow_for_you_reactions drop constraint ow_for_you_reactions_rank_positive;
alter table public.ow_for_you_reactions add constraint ow_for_you_reactions_rank_positive check (rank_at is null or rank_at >= 1);

alter table public.ow_for_you_reactions
  add constraint ow_for_you_reactions_interest_source_check
    check (interest_source is null or interest_source in ('for_you', 'company_page', 'proposal')),
  add constraint ow_for_you_reactions_interest_status_check
    check (interest_status is null or interest_status in ('delivered', 'awaiting_contact', 'replied', 'no_reply', 'expired')),
  add constraint ow_for_you_reactions_interest_note_length
    check (interest_note is null or char_length(interest_note) <= 200),
  /* 状態は「押した」行にだけ付く */
  add constraint ow_for_you_reactions_status_needs_interest
    check (interest_status is null or interested_at is not null);

comment on column public.ow_for_you_reactions.interest_source is 'どこから「話を聞いてみたい」を押したか（for_you / company_page / proposal）';
comment on column public.ow_for_you_reactions.interest_note is '押すときに本人が書いたひとこと（任意・200字まで）。担当者の登録待ちのあいだは企業にも運営の連絡にも渡さない';
comment on column public.ow_for_you_reactions.consent_version is '押すときに見せた確認の文言の版（lib/interest/constants.ts の INTEREST_CONSENT_VERSION）';
comment on column public.ow_for_you_reactions.interest_status is 'delivered / awaiting_contact / replied / no_reply / expired。判定は lib/interest/server.ts';

create index ow_for_you_reactions_interest_status_idx on public.ow_for_you_reactions (interest_status) where interest_status is not null;

-- ② 通知の種別
alter table public.ow_notifications drop constraint ow_notifications_type_check;
alter table public.ow_notifications add constraint ow_notifications_type_check check (type = any (array[
  'like', 'comment', 'reply', 'comment_like', 'message', 'proposal', 'introduction', 'message_request',
  'message_request_accepted', 'company_approach', 'meeting_canceled', 'follow',
  'interest_delivered', 'interest_no_reply', 'interest_reask'
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
  or (type = 'interest_delivered' and conversation_id is not null and actor_company_id is not null)
  or (type = any (array['interest_no_reply', 'interest_reask']::text[]) and actor_company_id is not null)
);

-- 検算
do $$
declare n int;
begin
  select count(*) into n from public.ow_for_you_reactions where interest_status is not null or interest_source is not null;
  if n <> 0 then raise exception '想定外: 既存の行に値が入っている（% 行）', n; end if;
  select count(*) into n from public.ow_for_you_reactions;
  if n <> 2 then raise exception '想定外: ow_for_you_reactions が % 行（2行のはず）', n; end if;
end $$;

commit;

-- 旧定義（戻すとき）
--   ow_notifications_type_check: type in ('like','comment','reply','comment_like','message','proposal','introduction',
--     'message_request','message_request_accepted','company_approach','meeting_canceled','follow')
--   ow_notifications_target_check: 上の or の最後の2行を除いたもの
