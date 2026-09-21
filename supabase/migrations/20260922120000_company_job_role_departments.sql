-- ★自社職種と部門の紐付け（2026-09-22 / 柴さんの指示）
--
-- ・任意の多対多。1つの職種が複数の部門にいてよい（例: インサイドセールスが営業部にも事業開発部にもいる）
-- ・使い道: /biz/organization の職種タブで「所属する部門」を付ける ／ 求人フォームで部門を選ぶと
--   その部門の職種を先に並べる（他の職種も選べるまま）
--
-- ⚠️★読み書きはサーバーの admin クライアントだけ（ow_proposals と同じ形）。
--    RLS は有効・ポリシー0本・anon / authenticated に GRANT しない。
--    ⚠️ 新しい表は既定で anon / authenticated に権限が付くので、明示的に revoke する。
--    ⚠️ 同じ会社の部門・職種どうしかの確認は API（PUT /api/biz/job-roles/[id]/departments）で行う。
--
-- ⚠️ 追加だけの migration。既存の表・行には触れない。

create table public.ow_company_job_role_departments (
  company_id    uuid not null references public.ow_companies(id) on delete cascade,
  job_role_id   uuid not null references public.ow_company_job_roles(id) on delete cascade,
  department_id uuid not null references public.ow_company_departments(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (job_role_id, department_id)
);

create index ow_company_job_role_departments_company_idx on public.ow_company_job_role_departments (company_id);
create index ow_company_job_role_departments_department_idx on public.ow_company_job_role_departments (department_id);

alter table public.ow_company_job_role_departments enable row level security;
revoke all on public.ow_company_job_role_departments from anon, authenticated;

comment on table public.ow_company_job_role_departments is
  '自社職種と部門の紐付け（任意の多対多）。読み書きは admin クライアントのみ。2026-09-22';

do $$
begin
  if has_table_privilege('anon', 'public.ow_company_job_role_departments', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_company_job_role_departments', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_company_job_role_departments', 'INSERT') then
    raise exception 'ow_company_job_role_departments: anon / authenticated に権限が残っている';
  end if;
end $$;
