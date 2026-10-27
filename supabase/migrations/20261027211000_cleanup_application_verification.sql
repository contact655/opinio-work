-- ★「担当者がいる会社で応募が企業に届く」検証で作った行を id で片づける（2026-10-28 / 柴さんの指示）
--   ・応募 b06289aa（contact+25 → 【検証】応募が届くかの確認）
--   ・会話 0d6ad2db と参加者 4231b799（応募で開いた会社との会話。メッセージ0件）
--   ・フィードの投稿 5322f8a4（求人を公開しました。運営画面の公開で作られた）
--   ・求人 a9d3c1e7（検証用。★下書きに戻さず消す ——検証のためだけに作ったもの）
-- 作業前ダンプ: .dumps/20261028-0009-ow_jobs-ow_job_applications-ow_conversations-ow_conversation_participants-ow_posts.sql
do $$
declare n int;
begin
  delete from ow_job_applications where id = 'b06289aa-b093-4fd7-b1c8-dd14e0be337f';
  get diagnostics n = row_count; if n <> 1 then raise exception 'applications: %', n; end if;
  delete from ow_conversation_participants where id = '4231b799-073c-4931-a6db-78fa57b39028';
  get diagnostics n = row_count; if n <> 1 then raise exception 'participants: %', n; end if;
  delete from ow_conversations where id = '0d6ad2db-2b5e-46fd-abdc-d44613d0e060';
  get diagnostics n = row_count; if n <> 1 then raise exception 'conversations: %', n; end if;
  delete from ow_posts where id = '5322f8a4-4f29-4404-8e6a-fff5ad91b571';
  get diagnostics n = row_count; if n <> 1 then raise exception 'posts: %', n; end if;
  delete from ow_jobs where id = 'a9d3c1e7-4b2f-4d6a-9e8c-1f3b5d7a9c20' and is_test;
  get diagnostics n = row_count; if n <> 1 then raise exception 'jobs: %', n; end if;
end $$;
