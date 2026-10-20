-- ★フォローされたことをベルに出す（2026-10-20 / 柴さんの要望）
--
-- ow_notifications に type = 'follow' を足す。
--   ・誰がフォローしたか（actor_user_id）だけを持つ。投稿・会話・提案にはぶら下がらない
--   ・押すと /u/[actor] を開く（アプリ側）
--
-- ⚠️ 制約2本の張り替えだけ。行は1行も変えない。
-- ⚠️ 既存の値はすべて残す（type_check は 11 値 → 12 値、target_check は分岐を1つ足すだけ）。
-- ⚠️ 同じ列を触った直近の migration は 20261020090000_post_comment_replies_and_likes.sql。
--    その定義（本番の pg_get_constraintdef で確認済み）に 'follow' を足した形にしてある。
-- ⚠️ アプリ側: GET /api/jobseeker/notifications の survives() に case "follow" を同じコミットで足す
--    （足さないと既定の「投稿が生きているか」に落ちて、フォロー通知が丸ごと静かに消える）。
--
-- 戻し方: 末尾のコメントを参照。

begin;

alter table public.ow_notifications drop constraint ow_notifications_type_check;
alter table public.ow_notifications add constraint ow_notifications_type_check check (
  type = any (array[
    'like', 'comment', 'reply', 'comment_like', 'message', 'proposal', 'introduction',
    'message_request', 'message_request_accepted', 'company_approach', 'meeting_canceled',
    'follow'
  ])
);

alter table public.ow_notifications drop constraint ow_notifications_target_check;
alter table public.ow_notifications add constraint ow_notifications_target_check check (
  (type = any (array['like', 'comment']) and post_id is not null and actor_user_id is not null)
  or (type = any (array['reply', 'comment_like']) and post_id is not null and comment_id is not null and actor_user_id is not null)
  or (type = any (array['message', 'message_request', 'message_request_accepted']) and conversation_id is not null and actor_user_id is not null)
  or (type = 'proposal' and proposal_id is not null and actor_company_id is not null)
  or (type = 'introduction' and conversation_id is not null and proposal_id is not null and actor_company_id is not null)
  or (type = 'company_approach' and approach_id is not null and actor_company_id is not null)
  or (type = 'meeting_canceled' and conversation_id is not null and actor_company_id is not null)
  or (type = 'follow' and actor_user_id is not null)
);

commit;

-- 戻し方（'follow' の行が残っていると張り直しで落ちるので、先に消す）:
--   begin;
--   delete from public.ow_notifications where type = 'follow';
--   alter table public.ow_notifications drop constraint ow_notifications_type_check;
--   alter table public.ow_notifications drop constraint ow_notifications_target_check;
--   -- 20261020090000_post_comment_replies_and_likes.sql の2本をそのまま張り直す
--   commit;
