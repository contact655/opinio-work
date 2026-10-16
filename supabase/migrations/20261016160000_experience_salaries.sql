-- ★職歴ごとの年収を別の表に移す（2026-10-16 / 柴さんの判断。フェーズ2）
--
-- なぜ別の表か:
--   ow_experiences は「ログインした人なら他人の行も読める」RLS（ow_experiences_login_only_read）で、
--   年収は**列単位の SELECT の GRANT を剥がしてあるだけ**で守られていた。
--   列を1つ select に足した瞬間に漏れる形なので、**誰にも開いていない表**に移す。
--   読み書きは本人確認つきの API（service role）だけ。
--
-- 何をするか:
--   ① ow_experience_salaries を作る（職歴 id が主キー。RLS 有効・ポリシー0本・anon/authenticated に権限なし）
--   ② 既存の salary_man 3件を移す（id を明示列挙。⚠️ 全件一括にしない）
--   ⚠️ ow_experiences.salary_man / salary_base / salary_bonus / salary_stock は**残す（DROP しない）**。
--      アプリはこれらを読まなくなる。
--
-- 確認したこと（2026-10-16 / 本番）:
--   salary_* に値がある行は3件だけ（いずれも同じ実ユーザー・salary_man のみ・内訳は null・visibility_salary=false）。
--   salary_man を参照する関数の本体0件・ビュー0件。同じ列を触った直近の migration は無い。
--   作業前ダンプ: .dumps/20261016-1533-ow_experiences.sql（114行）
--
-- 戻し方: drop table public.ow_experience_salaries;（ow_experiences の salary_man は残っているので値は失われない）

begin;

create table public.ow_experience_salaries (
  experience_id uuid primary key references public.ow_experiences(id) on delete cascade,
  amount_man    integer not null check (amount_man > 0 and amount_man <= 100000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.ow_experience_salaries is
  '職歴ごとの年収（万円）。本人の編集画面だけに出す。他の利用者・企業・運営の一覧には出さない。'
  ' RLS 有効・ポリシー0本・anon/authenticated に権限なし。読み書きは本人確認つきの API（service role）だけ（2026-10-16）';
comment on column public.ow_experience_salaries.amount_man is '年収（万円）。1〜100000';

alter table public.ow_experience_salaries enable row level security;
revoke all on table public.ow_experience_salaries from public, anon, authenticated;
grant select, insert, update, delete on table public.ow_experience_salaries to service_role;

-- ② 既存の3件を移す。⚠️ 想定と違えば中止
do $$
declare n_src int; n_dst int;
begin
  select count(*) into n_src from public.ow_experiences
   where salary_man is not null or salary_base is not null or salary_bonus is not null or salary_stock is not null;
  if n_src <> 3 then raise exception '年収に値がある職歴が想定（3件）と違う: %', n_src; end if;

  insert into public.ow_experience_salaries (experience_id, amount_man)
  select id, salary_man from public.ow_experiences
   where id in (
     'dddea6da-2d51-4edc-8070-541ab4a4d7d7',
     '7176c7f0-20e7-4047-9129-b8e2e0d1c2b5',
     '5b13403c-c68a-42ac-a774-8ceca2d3d7db'
   ) and salary_man is not null;

  select count(*) into n_dst from public.ow_experience_salaries;
  if n_dst <> 3 then raise exception '移した件数が3件でない: %', n_dst; end if;

  -- 値が一致していることを確かめる
  if exists (
    select 1 from public.ow_experience_salaries s join public.ow_experiences e on e.id = s.experience_id
     where s.amount_man is distinct from e.salary_man
  ) then raise exception '移した値が元の salary_man と一致しない'; end if;

  -- 権限の検算（誰にも開いていないこと）
  if has_table_privilege('anon', 'public.ow_experience_salaries', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_experience_salaries', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_experience_salaries', 'INSERT')
     or has_table_privilege('authenticated', 'public.ow_experience_salaries', 'UPDATE') then
    raise exception 'ow_experience_salaries に anon / authenticated の権限が残っている';
  end if;
end $$;

commit;
