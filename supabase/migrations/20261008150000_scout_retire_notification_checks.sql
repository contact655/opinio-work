-- ============================================================================
-- ★スカウト廃止 ①：通知と連絡ログの制約から 'scout' を外す（2026-10-08 作成 / **未適用**）
-- ============================================================================
-- ⚠️★**supabase/pending/ に置いてある。適用日が決まるまで supabase/migrations/ へ移さない。**
--    移すときに採番を振り直すこと（`YYYYMMDDHHMMSS_scout_retire_notification_checks.sql`）。
-- ⚠️★**この順で当てる: ① → ② → ③ → ④。** ②は①が `scout_id` の FK を外していることを前提にする。
-- ⚠️ 当てる前に `./scripts/dump-tables.sh ow_notifications ow_contact_logs` で保全を取ること。
--
-- 背景: スカウトは 2026-10-08 に廃止した（提案に一本化）。送信 API は 410 を返し、
--       アプリは `type='scout'` の通知を作らず、`scout_id` も select していない。
-- 実測（2026-10-08）: `type='scout'` の通知 0行 ／ `ow_contact_logs` は表ごと 0行。
--
-- 張り替えるもの:
--   ・ow_notifications_type_check   … 'scout' を外す
--   ・ow_notifications_target_check … scout の枝を外す
--   ・ow_notifications.scout_id      … FK・索引ごと列を落とす
--   ・ow_contact_logs_action_type_check … 'scout_view' を外す
-- ⚠️ CHECK の張り替えは「狭める」向きだけ。対象行が0件であることを中で確かめ、
--    1件でもあれば中止する（黙って壊さない）。
-- ============================================================================

begin;

do $$
declare n int;
begin
  select count(*) into n from public.ow_notifications where type = 'scout' or scout_id is not null;
  if n <> 0 then raise exception '中止: scout の通知が % 行ある（0行のはず）', n; end if;
  select count(*) into n from public.ow_contact_logs where action_type = 'scout_view';
  if n <> 0 then raise exception '中止: scout_view の連絡ログが % 行ある（0行のはず）', n; end if;
end $$;

alter table public.ow_notifications drop constraint ow_notifications_target_check;
alter table public.ow_notifications drop constraint ow_notifications_type_check;

alter table public.ow_notifications add constraint ow_notifications_type_check
  check (type = any (array['like','comment','message','proposal','introduction']));

alter table public.ow_notifications add constraint ow_notifications_target_check check (
     (type = any (array['like','comment']) and post_id is not null and actor_user_id is not null)
  or (type = 'message' and conversation_id is not null and actor_user_id is not null)
  or (type = 'proposal' and proposal_id is not null and actor_company_id is not null)
  or (type = 'introduction' and conversation_id is not null and proposal_id is not null and actor_company_id is not null)
);

-- ⚠️ CASCADE を付けない。FK と索引は名指しで落とす（想定外の依存があれば失敗させたい）
alter table public.ow_notifications drop constraint ow_notifications_scout_id_fkey;
drop index if exists public.idx_ow_notifications_scout;
alter table public.ow_notifications drop column scout_id;

alter table public.ow_contact_logs drop constraint ow_contact_logs_action_type_check;
alter table public.ow_contact_logs add constraint ow_contact_logs_action_type_check
  check (action_type = any (array['email_reveal','direct_message','job_apply_view','profile_view']));

-- 検算: 制約の本文に 'scout' が残っていないこと
do $$
declare n int;
begin
  select count(*) into n from pg_constraint
   where conrelid in ('public.ow_notifications'::regclass, 'public.ow_contact_logs'::regclass)
     and pg_get_constraintdef(oid) ~* 'scout';
  if n <> 0 then raise exception '検算失敗: scout を含む制約が % 本残っている', n; end if;
end $$;

commit;
