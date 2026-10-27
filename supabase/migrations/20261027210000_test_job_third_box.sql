-- ★検証用: 【テスト】株式会社Third Box に検証用の求人を1件作る（2026-10-27 / 柴さんの指示。応募が企業に届くかの確認）
--   公開は柴さんが運営の管理画面（/admin/jobs）から行う。ここでは公開しない（DB のトリガーが published での作成を止める）。
--   ⚠️ status は 'pending_review'（再開の依頼）。運営画面の「公開に戻す」が押せるのはこの状態か「運営が停止」だけで、
--      'draft' だと運営画面に公開のボタンが無い。どちらも公開されていない状態。
--   ⚠️ 会社が is_test なので求人も is_test（DB のトリガー）。一般の利用者には出ない。
-- 作業前ダンプ: .dumps/20261027-2349-ow_jobs-ow_job_applications-ow_conversations-ow_conversation_participants-ow_conversation_messages-ow_notifications-ow_posts-ow_activities-ow_job_roles.sql
--   （ow_jobs 23 / ow_job_applications 2 / ow_conversations 11 / ow_conversation_messages 17 / ow_notifications 22 / ow_posts 172 / ow_activities 237）
-- 戻し方: delete from ow_jobs where id = 'a9d3c1e7-4b2f-4d6a-9e8c-1f3b5d7a9c20';
do $$
begin
  if (select count(*) from ow_jobs) <> 23 then raise exception '想定外: ow_jobs の件数'; end if;
  insert into ow_jobs (id, company_id, title, status, description, employment_type, is_test)
  values ('a9d3c1e7-4b2f-4d6a-9e8c-1f3b5d7a9c20', '81cae8d8-38bf-4497-8fa1-1fbb2741239d',
          '【検証】応募が届くかの確認', 'pending_review', '検証用の求人です。実在しません。', '正社員', true);
  if not exists (select 1 from ow_jobs where id = 'a9d3c1e7-4b2f-4d6a-9e8c-1f3b5d7a9c20' and is_test and status = 'pending_review') then
    raise exception '作成できていない';
  end if;
end $$;
