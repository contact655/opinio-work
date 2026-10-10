-- ════════════════════════════════════════════════════════════════════════
-- 検証用の企業は、見ている人が検証用（is_test）のときだけ読める（2026-10-11 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- 20261011020000 で検証用の企業を公開側の読み取りから外したが、それだと
-- **検証用の求職者からも**社名が読めず、/mypage/approaches・/mypage/proposals・会話で
-- 検証用の企業の名前が出なくなった（声かけ・提案は is_test 同士でしか作れないので、相手は必ず検証用の企業）。
--
-- ① auth_is_test_user() … **呼んだ本人が検証用か**だけを答える（auth_ow_user_id と同じ作り）。
--    ⚠️ 引数を取らない。他人について答えない。RLS の補助関数なので anon / authenticated に付与する
--       （ポリシーは anon でも評価されるので、anon に無いと 403 になる）。
--    ⚠️ scripts/check-definer-grants.sh の許可リスト（①）に足す。
-- ② ow_companies の公開読み取り … is_test = false **または** 本人が検証用
-- ③ 部門 … 同じ条件
--    ⚠️ 企業ストーリー・ツールは「その会社の行が読めること」を条件にしてあるので、②が効けば自動で揃う。
-- ════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.auth_is_test_user()
returns boolean
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select coalesce((select u.is_test from public.ow_users u where u.auth_id = auth.uid()), false);
$$;
comment on function public.auth_is_test_user() is
  'RLS の補助関数（2026-10-11）。呼んだ本人（auth.uid()）が検証用（ow_users.is_test）かだけを答える。未ログインは false。他人については答えない。';
revoke execute on function public.auth_is_test_user() from public;
grant execute on function public.auth_is_test_user() to anon, authenticated, service_role;

drop policy if exists "ow_companies_published_read" on public.ow_companies;
create policy "ow_companies_published_read" on public.ow_companies
  for select using (is_published = true and (is_test = false or public.auth_is_test_user()));

drop policy if exists "public read published departments" on public.ow_company_departments;
create policy "public read published departments" on public.ow_company_departments
  for select using (exists (
    select 1 from public.ow_companies
     where ow_companies.id = ow_company_departments.company_id
       and ow_companies.is_published = true
       and (ow_companies.is_test = false or public.auth_is_test_user())));

commit;

-- ★戻すとき: 20261011020000 の式に戻し、drop function public.auth_is_test_user();
