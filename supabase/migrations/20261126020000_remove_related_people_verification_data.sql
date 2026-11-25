-- ════════════════════════════════════════════════════════════════════════
-- 求人ページ「この募集に関わる人」の動作確認（PR #77 / 2026-11-26）で作ったテストデータを消す（柴さんの了承）
--   プレビュー環境で【テスト】株式会社Third Box（81cae8d8…・is_test）にテスト求人を1件作り、
--   hshiba（is_test）をその求人の Hiring Manager に紐づけて表示を確かめた。その行を id を指定して消す。
--   hshiba の「採用中」は画面から元に戻し済み（is_hiring = false・hiring_note = null。作業前と同じ）。
--
-- 作業前ダンプ: .dumps/20261126-0149-ow_jobs-ow_job_roles-ow_job_hiring_managers-ow_posts-ow_activities.sql
-- 戻し方: 戻す必要は無い（検証の行）。必要ならダンプから該当 id の行を入れ直す。
-- ⚠️ 1行でも想定と数が違えば全体を取り消す。
-- ════════════════════════════════════════════════════════════════════════
begin;
do $$
declare n int;
begin
  delete from public.ow_job_hiring_managers
   where job_id = '1620a4b7-b9f7-48b4-994a-bee1da46c73b' and user_id = 'fe7dfe9b-75d4-4a75-a821-fa1a9599a416';
  get diagnostics n = row_count; if n <> 1 then raise exception 'job_hiring_managers %', n; end if;

  delete from public.ow_posts where id = 'a73dc7fb-51f7-477d-ab2b-d2168bcc9790';
  get diagnostics n = row_count; if n <> 1 then raise exception 'posts %', n; end if;

  delete from public.ow_activities where id in (
    '064f5513-3c42-4f28-a0b7-6e843cf76b11','8590eac3-56b3-4687-ae23-6985b4f6ed84','6580773b-578f-4f37-a0c0-e23b5b1c0dac',
    'd858ca66-649d-467a-8909-7ca7972be604','ea3777df-bc08-4ca6-9e3e-15d477c33f49','505a6d72-8e60-4c61-8ddc-9b5f03f85cd0',
    'd8b1fb89-be06-40a4-8a4d-faf28ebc4712','03627312-7822-414b-8882-82f80533d385');
  get diagnostics n = row_count; if n <> 8 then raise exception 'activities %', n; end if;

  delete from public.ow_job_roles where job_id = '1620a4b7-b9f7-48b4-994a-bee1da46c73b';
  get diagnostics n = row_count; if n <> 1 then raise exception 'job_roles %', n; end if;

  delete from public.ow_jobs
   where id = '1620a4b7-b9f7-48b4-994a-bee1da46c73b' and company_id = '81cae8d8-38bf-4497-8fa1-1fbb2741239d' and is_test;
  get diagnostics n = row_count; if n <> 1 then raise exception 'jobs %', n; end if;
end $$;
commit;
