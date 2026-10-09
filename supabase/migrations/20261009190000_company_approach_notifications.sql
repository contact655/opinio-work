-- ════════════════════════════════════════════════════════════════════════
-- 企業からの「声かけ」の通知（2026-10-09 / 声かけ 段3）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★やること
--   1. ow_notifications.approach_id（どの声かけか）を足す。声かけを消したら通知も消す（cascade）
--   2. 通知の種類に 'company_approach'（企業から声かけが届いた）を足す
--   3. 宛先の CHECK: 'company_approach' は approach_id と actor_company_id が必須
--
-- ⚠️★**`GET /api/jobseeker/notifications` の survives() とベル（NotificationBell）にも case を足すこと
--    （同じコミット）。** 足し忘れると、その種別が丸ごと静かに消える。
-- ⚠️ 承認された側（企業）への通知は作らない。/biz に通知の面が無いので、/biz/approaches の
--    「やり取り中」と /biz/conversations の会話で分かる形にしてある。
-- ⚠️ 種類の CHECK は「広げるだけ」（既存の値はすべて残す）。張り替え前後で既存行が通ることを検算する。
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.ow_notifications
  add column if not exists approach_id uuid references public.ow_company_approaches(id) on delete cascade;

comment on column public.ow_notifications.approach_id is
  '企業からの声かけ（ow_company_approaches）の通知のとき、どの声かけか（2026-10-09）。';

alter table public.ow_notifications drop constraint if exists ow_notifications_type_check;
alter table public.ow_notifications add constraint ow_notifications_type_check
  check (type = any (array['like','comment','message','proposal','introduction','message_request','message_request_accepted','company_approach']));

alter table public.ow_notifications drop constraint if exists ow_notifications_target_check;
alter table public.ow_notifications add constraint ow_notifications_target_check
  check (
       (type = any (array['like','comment']) and post_id is not null and actor_user_id is not null)
    or (type = any (array['message','message_request','message_request_accepted']) and conversation_id is not null and actor_user_id is not null)
    or (type = 'proposal' and proposal_id is not null and actor_company_id is not null)
    or (type = 'introduction' and conversation_id is not null and proposal_id is not null and actor_company_id is not null)
    or (type = 'company_approach' and approach_id is not null and actor_company_id is not null)
  );

-- ── 検算 ──────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'ow_notifications' and column_name = 'approach_id') then
    raise exception '検算失敗: approach_id が無い';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'ow_notifications_type_check')) !~ 'company_approach' then
    raise exception '検算失敗: 種類の CHECK に company_approach が無い';
  end if;
  raise notice '検算OK: 声かけの通知を足した（既存行は CHECK を通っている）';
end $$;

commit;

-- ★戻すとき（company_approach の通知行を消してから）:
--   delete from public.ow_notifications where type = 'company_approach';
--   alter table public.ow_notifications drop constraint ow_notifications_target_check;
--   alter table public.ow_notifications add constraint ow_notifications_target_check check (
--        (type = any (array['like','comment']) and post_id is not null and actor_user_id is not null)
--     or (type = any (array['message','message_request','message_request_accepted']) and conversation_id is not null and actor_user_id is not null)
--     or (type = 'proposal' and proposal_id is not null and actor_company_id is not null)
--     or (type = 'introduction' and conversation_id is not null and proposal_id is not null and actor_company_id is not null));
--   alter table public.ow_notifications drop constraint ow_notifications_type_check;
--   alter table public.ow_notifications add constraint ow_notifications_type_check
--     check (type = any (array['like','comment','message','proposal','introduction','message_request','message_request_accepted']));
--   alter table public.ow_notifications drop column approach_id;
