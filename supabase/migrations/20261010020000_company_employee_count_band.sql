-- ════════════════════════════════════════════════════════════════════════
-- 会社規模の帯（2026-10-10 / 声かけまわり 段1）—— 列を足す
-- ════════════════════════════════════════════════════════════════════════
--
-- ★足すだけ（古いコードのままでも壊れない）。値の投入は 20261010020100（企業ごとに明示列挙）。
--
-- ★列
--   employee_count_band … 8区分のどれか（CHECK）。null = まだ分からない（推測で埋めない）
--   employee_count_as_of … いつ時点の人数か（date・任意）。月までしか分からないものは月初を入れ、
--                          画面は「◯年◯月時点」と月までに揃える
--   ⚠️ 自由記述の employee_count は**消さない**（原文として残す）。画面は帯と時点だけを出す。
--
-- ★権限: ow_companies は UPDATE が列単位の GRANT（CLAUDE.md）。新しい列は生まれた時点で
--   authenticated から書けないので、ここで配る（企業の編集画面 PATCH /api/biz/company が書く）。
--   SELECT はテーブルレベルなので配り直しは要らない。下で検算する。
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.ow_companies
  add column if not exists employee_count_band text,
  add column if not exists employee_count_as_of date;

alter table public.ow_companies drop constraint if exists ow_companies_employee_count_band_check;
alter table public.ow_companies add constraint ow_companies_employee_count_band_check
  check (employee_count_band is null or employee_count_band in
    ('1-10','11-50','51-200','201-500','501-1000','1001-5000','5001-10000','10001+'));

comment on column public.ow_companies.employee_count_band is
  E'従業員数の帯（2026-10-10）。8区分のどれか。null = 分からない（推測で埋めない）。\n画面の表示・/companies の規模の絞り込み・声かけを受け取る範囲はこの列を使う。自由記述の employee_count は原文として残す。';
comment on column public.ow_companies.employee_count_as_of is
  '従業員数がいつ時点か（2026-10-10）。月までしか分からないものは月初。画面は「◯年◯月時点」と月まで出す。';

grant update (employee_count_band, employee_count_as_of) on public.ow_companies to authenticated;

do $$
begin
  if not has_column_privilege('authenticated', 'public.ow_companies', 'employee_count_band', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.ow_companies', 'employee_count_as_of', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.ow_companies', 'employee_count_band', 'SELECT')
     or not has_column_privilege('anon', 'public.ow_companies', 'employee_count_band', 'SELECT') then
    raise exception '検算失敗: 新しい列の権限が想定と違う';
  end if;
  raise notice '検算OK: employee_count_band / employee_count_as_of を足した';
end $$;

commit;

-- ★戻すとき:
--   alter table public.ow_companies drop constraint ow_companies_employee_count_band_check;
--   alter table public.ow_companies drop column employee_count_band, drop column employee_count_as_of;
