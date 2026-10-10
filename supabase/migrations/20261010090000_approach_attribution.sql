-- ════════════════════════════════════════════════════════════════════════
-- 声かけの振り返りのための記録（2026-10-10 / 声かけまわり 段6）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★足す列
--   job_id               … 関連する求人を添えたか（任意。その企業の公開中の求人だけ。求人を消したら null）
--   template_id          … 本文のテンプレート（2026-10-10 時点でテンプレートの機能は無い。列だけ先に持つ。外部キーは機能を作る日に張る）
--   attribution_recorded … この行で上の2列を記録しているか。**この migration より前の行は false**（集計では「記録なし」）
--     ⚠️ 既存行に UPDATE をかけないよう、既定値 false で足してから既定値を true に変える（既存行だけが false になる）。
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.ow_company_approaches
  add column if not exists job_id uuid references public.ow_jobs(id) on delete set null,
  add column if not exists template_id uuid,
  add column if not exists attribution_recorded boolean not null default false;
alter table public.ow_company_approaches alter column attribution_recorded set default true;

comment on column public.ow_company_approaches.job_id is '声かけに添えた関連する求人（2026-10-10 / 段6）。任意。';
comment on column public.ow_company_approaches.template_id is '本文のテンプレート（2026-10-10 / 段6）。テンプレートの機能はまだ無い。列だけ先に持つ';
comment on column public.ow_company_approaches.attribution_recorded is 'job_id / template_id を記録している行か（2026-10-10 より前は false＝集計で「記録なし」）';

do $$
declare n_old int; n_true int;
begin
  select count(*) filter (where not attribution_recorded), count(*) filter (where attribution_recorded) into n_old, n_true from public.ow_company_approaches;
  if n_true > 0 then raise exception '検算失敗: 既存の行が記録ありになっている (%)', n_true; end if;
  raise notice '検算OK: 既存の声かけ % 件は「記録なし」、これから送るものは記録あり', n_old;
end $$;

commit;
