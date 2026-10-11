-- ★提案には求人を必ず添える（2026-10-11 / 柴さんの判断）。job_id を NOT NULL にする。
--
-- ⚠️★締める変更なので supabase/pending/ に置いていた。2026-10-11 に柴さんの承認を受けて migrations/ へ移して当てた
--    （適用前にダンプ: .dumps/20261011-1501-ow_proposals.sql ／ job_id が空の行 0件 / 全9件 を確認）。
--    コード（lib/evidence/generate.ts）は先に「求人が無い組み合わせは作らない」にしてあるので、
--    この migration より前でも新しく NULL の行はできない。
-- ⚠️ 2026-10-11 時点の ow_proposals は9件で、すべて job_id あり（実測。検証用の提案を足したあと）。
-- ⚠️ 一意の制約 ow_proposals_unique は UNIQUE NULLS NOT DISTINCT (candidate_user_id, company_id, job_id)。
--    NOT NULL にしても意味は変わらない（NULL の組が無くなるだけ）。

begin;

do $$
declare n int;
begin
  select count(*) into n from public.ow_proposals where job_id is null;
  if n <> 0 then raise exception 'job_id が空の提案が % 件ある。中止', n; end if;
end $$;

-- ⚠️ job_id の FK は ON DELETE SET NULL。NOT NULL にすると、求人を消したときにその提案の削除ごと失敗する。
--    求人は消さず status を変える運用（private / draft）なので、FK を RESTRICT 相当にして
--    「提案が付いた求人は消せない」を明示する。
alter table public.ow_proposals drop constraint ow_proposals_job_id_fkey;
alter table public.ow_proposals add constraint ow_proposals_job_id_fkey
  foreign key (job_id) references public.ow_jobs(id) on delete restrict;

alter table public.ow_proposals alter column job_id set not null;

commit;
