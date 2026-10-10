-- ════════════════════════════════════════════════════════════════════════
-- 求人の「報酬・給与：要相談」と、職種マスタ「マーケティング責任者（マネージャー）」（2026-10-10 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★足すだけ（古いコードは新しい列・行を知らないだけで壊れない）。
--
-- ① ow_jobs.salary_negotiable … 企業が「要相談」を選んだ。
--    ⚠️ 「給与非公開」（金額が空）とは区別する。要相談のときは金額を持たない（CHECK）。
-- ② ow_roles … 「マーケティング」の下に「マーケティング責任者（マネージャー）」。
--    ⚠️ display_order は既存の子（1〜7・その他 17）の後ろの 8。途中に差し込まない。
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.ow_jobs add column if not exists salary_negotiable boolean not null default false;
alter table public.ow_jobs drop constraint if exists ow_jobs_salary_negotiable_check;
alter table public.ow_jobs add constraint ow_jobs_salary_negotiable_check
  check (not salary_negotiable or (salary_min is null and salary_max is null));
comment on column public.ow_jobs.salary_negotiable is
  '報酬・給与が「要相談」（2026-10-10）。true のとき金額（salary_min / salary_max）は持たない。⚠ 金額が空で false なら「給与非公開」。混ぜない';

insert into public.ow_roles (name, slug, level, parent_id, is_active, is_it_saas, display_order)
select 'マーケティング責任者（マネージャー）', 'marketing-manager', 2, '38429140-f784-44c0-8eec-407495044272', true, true, 8
 where not exists (select 1 from public.ow_roles where slug = 'marketing-manager');

do $$
begin
  if not exists (select 1 from public.ow_roles where slug = 'marketing-manager' and parent_id = '38429140-f784-44c0-8eec-407495044272') then
    raise exception '検算失敗: 職種が入っていない';
  end if;
  if not has_column_privilege('authenticated', 'public.ow_jobs', 'salary_negotiable', 'SELECT') then
    raise exception '検算失敗: authenticated が salary_negotiable を読めない';
  end if;
  raise notice '検算OK';
end $$;

commit;

-- ★戻すとき:
--   alter table ow_jobs drop constraint ow_jobs_salary_negotiable_check; alter table ow_jobs drop column salary_negotiable;
--   delete from ow_roles where slug = 'marketing-manager';（使われていなければ）
