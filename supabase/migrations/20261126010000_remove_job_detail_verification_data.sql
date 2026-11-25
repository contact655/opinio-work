-- ════════════════════════════════════════════════════════════════════════
-- 求人ページの動作確認（PR #75 / 2026-11-26）で作ったテストデータを消す（柴さんの了承）
--   プレビュー環境で【テスト】株式会社Third Box（81cae8d8…・is_test）にテスト求人を1件作り、
--   検証用アカウント contact+27（相川 隆二・is_test）から 話を聞いてみたい／応募する／保存／
--   メッセージを送る（宛先 hshiba・is_test）を試した。そのとき出来た行を id を指定して消す。
--   読み取り用の接続では消せなかったので migration で当てる。
--
-- 作業前ダンプ: .dumps/20261126-0108-ow_jobs-ow_job_roles-ow_posts-ow_activities-ow_bookmarks-
--               ow_casual_meetings-ow_job_applications-ow_conversations-ow_conversation_messages-
--               ow_conversation_participants-ow_notifications.sql
-- 戻し方: 戻す必要は無い（検証の行）。必要ならダンプから該当 id の行を入れ直す。
-- ⚠️ 1行でも想定と数が違えば全体を取り消す。
-- ════════════════════════════════════════════════════════════════════════
begin;
do $$
declare n int;
begin
  delete from public.ow_notifications where id = '4daf9aaf-a6f9-4e9c-9f84-317342cbe58b';
  get diagnostics n = row_count; if n <> 1 then raise exception 'notifications %', n; end if;

  delete from public.ow_conversation_messages where id = '903d3bf9-d3fb-4beb-84e5-43a920c52912';
  get diagnostics n = row_count; if n <> 1 then raise exception 'messages %', n; end if;

  delete from public.ow_conversation_participants where id in ('89fd61e7-d894-47ae-8f44-f9a1b41af286','47efe4b8-434d-47ce-8ebe-01659ccc2dfb');
  get diagnostics n = row_count; if n <> 2 then raise exception 'participants %', n; end if;

  delete from public.ow_conversations where id in ('6cb3df6d-8e9e-4741-b250-35084ce9947a','69053160-4671-4609-b992-688cbcda1a22');
  get diagnostics n = row_count; if n <> 2 then raise exception 'conversations %', n; end if;

  delete from public.ow_job_applications where id = 'cc6415e0-0924-4f2f-adf1-54b6df11f2b3';
  get diagnostics n = row_count; if n <> 1 then raise exception 'applications %', n; end if;

  delete from public.ow_casual_meetings where id = '025f5c3d-f7ff-49ca-b714-0a15fcfa7c8e';
  get diagnostics n = row_count; if n <> 1 then raise exception 'meetings %', n; end if;

  delete from public.ow_bookmarks where id = '81a33dea-ef99-430b-a5a4-f2a1c5b1d81e';
  get diagnostics n = row_count; if n <> 1 then raise exception 'bookmarks %', n; end if;

  delete from public.ow_posts where id = 'd21fae13-c4ed-41aa-9831-913dbe973ef5';
  get diagnostics n = row_count; if n <> 1 then raise exception 'posts %', n; end if;

  delete from public.ow_activities where id in (
    '77c4cdc6-3909-4d28-b368-f698064aec6a','cb0b8358-7140-475c-baeb-b42b7c178bec','88dbafb4-63db-4002-9bcf-7a582cbd40ef',
    '79d8e4da-b9a3-4908-a7f4-3d92c89fd38c','171dfa69-817e-48d0-bf33-cfa962d2e4c1','82c66c8a-bd3a-4c72-8497-7e0df93a7e3e',
    'dfb75e59-44eb-4b86-9e60-c87f9cce05ae','ab82ecdb-fd55-4de0-8099-261655176386','830691fd-846f-49ba-80bc-a201ddebaf83',
    '679d3142-4126-407d-a17d-4c3a5bae1c6d','bba08371-8ba2-4a27-a58f-d1d07f4f503e','0bbe7ad3-c648-45da-98b3-0d13a954bf0d',
    'eabf360b-db62-401b-88ad-e21fc3e66ba5','aa66eb86-a2b6-48aa-b1f3-1ea4e25ab093');
  get diagnostics n = row_count; if n <> 14 then raise exception 'activities %', n; end if;

  delete from public.ow_job_roles where job_id = '562ba006-cd0c-4d6f-a16e-048c7b5dd5dd';
  get diagnostics n = row_count; if n <> 1 then raise exception 'job_roles %', n; end if;

  delete from public.ow_jobs where id = '562ba006-cd0c-4d6f-a16e-048c7b5dd5dd' and company_id = '81cae8d8-38bf-4497-8fa1-1fbb2741239d' and is_test;
  get diagnostics n = row_count; if n <> 1 then raise exception 'jobs %', n; end if;
end $$;
commit;
