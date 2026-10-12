-- ★求人に2項目を足す（2026-10-12 / 柴さんの指示。「合うところ」を増やすため）。
--   required_experience_years … この職種の経験年数（0 = 不問 / 1・3・5・10 年以上）
--   position_level            … ポジションのレベル（職歴の役職ランク ow_experiences.rank と同じ語彙）
-- ⚠️ どちらも任意（公開に必要な17項目には入れない）。既存の行は NULL のまま（推測で埋めない）。
-- ⚠️ 許容値は src/lib/constants/jobFit.ts（年数）と careerOptions.ts の RANKS（レベル）。
--    値を足す日は UI / API / この CHECK を同じコミットで広げる（3層の規約）。
-- ⚠️ ow_jobs の SELECT / UPDATE はテーブル単位の GRANT なので、列単位の grant は要らない。
--
-- ★あわせて検証用企業 Third Box（is_test）の自社職種3件に標準の職種を付け直す。
--   実在の企業の行には触らない（id を明示列挙し、企業が is_test であることを確かめてから書く）。

alter table public.ow_jobs
  add column required_experience_years smallint,
  add column position_level text;

alter table public.ow_jobs
  add constraint ow_jobs_required_experience_years_check
    check (required_experience_years is null or required_experience_years in (0, 1, 3, 5, 10)),
  add constraint ow_jobs_position_level_check
    check (position_level is null or position_level in (
      'none','chief','leader','manager','senior_manager','general_manager',
      'division_head','corporate_officer','executive','ceo'
    ));

comment on column public.ow_jobs.required_experience_years is
  'この職種（代表の職種）の経験年数。0=不問 / 1・3・5・10=N年以上。NULL=未入力。2026-10-12';
comment on column public.ow_jobs.position_level is
  'ポジションのレベル。ow_experiences.rank と同じ語彙（RANKS）。NULL=未入力。2026-10-12';

do $$
declare
  v_is_test boolean;
  v_n int;
begin
  select is_test into v_is_test from public.ow_companies where id = '81cae8d8-38bf-4497-8fa1-1fbb2741239d';
  if v_is_test is distinct from true then
    raise exception 'Third Box が is_test ではない。中止';
  end if;

  update public.ow_company_job_roles set standard_role_id = 'd1724303-7ca2-4cbe-a16b-f15d5a2476b8'  -- インサイドセールス
   where id = '3ebfa864-6886-499b-ad73-e1cfaba9e63a' and company_id = '81cae8d8-38bf-4497-8fa1-1fbb2741239d';
  get diagnostics v_n = row_count; if v_n <> 1 then raise exception 'インサイドセールス: % 行', v_n; end if;

  update public.ow_company_job_roles set standard_role_id = '669c6a08-997a-4a3f-b588-762acffacbc4'  -- プロダクトマネージャー
   where id = '5843029e-8c99-4e2f-8cf8-af5bc12ea932' and company_id = '81cae8d8-38bf-4497-8fa1-1fbb2741239d';
  get diagnostics v_n = row_count; if v_n <> 1 then raise exception 'PDM: % 行', v_n; end if;

  update public.ow_company_job_roles set standard_role_id = '133c74c0-e432-4c52-8235-7ad9bc7d96b8'  -- フィールドセールス
   where id = 'ab2520f3-8de4-42d0-8e27-58b2580bcfe0' and company_id = '81cae8d8-38bf-4497-8fa1-1fbb2741239d';
  get diagnostics v_n = row_count; if v_n <> 1 then raise exception 'フィールドセールス: % 行', v_n; end if;
end $$;
