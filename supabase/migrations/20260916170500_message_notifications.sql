-- ★メッセージの受信を通知に載せる（2026-09-16）
--
-- ⚠️★**なぜ要るか。** DM は `/u/[id]` の「メッセージ」ボタンから**誰でも送れる**のに、
--    送信経路4本（dm/message・dm/bulk-message・dm/start・biz/conversations/[id]/messages）の
--    **どれも受信者に何も知らせていなかった**（通知0・メール0）。
--    2026-09-15 にヘッダーのメッセージアイコンも外したため、**気づく手段が0**になっていた。
--
-- ⚠️ 実測（2026-09-16 / 本番）: ow_conversations 3件・ow_conversation_messages 0件・
--    ow_notifications 1件。**まだ誰も送っていないうちに塞ぐ。**
--
-- ⚠️★`ow_notifications_target_check` は「種別ごとに何がぶら下がるか」を DB でも保証している。
--    これが無いと post_id も scout_id も conversation_id も無い通知が入り、
--    受け取った人には**押しても何も起きない通知**として現れる（20260810103434 と同じ理由）。
--
-- ⚠️ インデックスは足さない。`ow_notifications` は1行しかなく、
--    CLAUDE.md「20行のテーブルは Seq Scan のほうが速い。足すと書き込みのIOだけ増える」。

begin;

-- ① 会話への参照。⚠️ 会話が消えたら通知も消す（押しても開けない通知を残さない）
alter table public.ow_notifications
  add column if not exists conversation_id uuid
  references public.ow_conversations(id) on delete cascade;

comment on column public.ow_notifications.conversation_id is
  'type = ''message'' のときの会話。押すと /mypage/conversations/[id] を開く。';

-- ② 種別を広げる
alter table public.ow_notifications drop constraint if exists ow_notifications_type_check;
alter table public.ow_notifications add constraint ow_notifications_type_check
  check (type = any (array['like'::text, 'comment'::text, 'scout'::text, 'message'::text]));

-- ③ 種別ごとにぶら下がるものを保証する
--    ⚠️ message は **conversation_id と actor_user_id の両方**を要求する。
--       actor は「送った人」。企業からのメッセージでも担当者は ow_users の行を持つ。
alter table public.ow_notifications drop constraint if exists ow_notifications_target_check;
alter table public.ow_notifications add constraint ow_notifications_target_check
  check (
    ((type = any (array['like'::text, 'comment'::text])) and post_id is not null and actor_user_id is not null)
    or (type = 'scout'::text and scout_id is not null and actor_company_id is not null)
    or (type = 'message'::text and conversation_id is not null and actor_user_id is not null)
  );

-- ④ 事後アサート
do $$
declare n int;
begin
  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='ow_notifications' and column_name='conversation_id';
  if n <> 1 then raise exception '事後: conversation_id が作られていない'; end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid='public.ow_notifications'::regclass
       and conname='ow_notifications_type_check'
       and pg_get_constraintdef(oid) like '%message%'
  ) then raise exception '事後: type_check に message が入っていない'; end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid='public.ow_notifications'::regclass
       and conname='ow_notifications_target_check'
       and pg_get_constraintdef(oid) like '%conversation_id%'
  ) then raise exception '事後: target_check が conversation_id を見ていない'; end if;

  -- ⚠️ 既存行が新しい CHECK を満たすか（満たさなければ ALTER が落ちるが、件数も残す）
  select count(*) into n from public.ow_notifications;
  raise notice '事後: ow_notifications % 行 / 制約2本を張り替えた', n;
end $$;

commit;
