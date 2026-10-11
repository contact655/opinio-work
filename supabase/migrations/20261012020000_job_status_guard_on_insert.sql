-- ★企業が求人を「最初から公開中」で作れないようにする（2026-10-12）。
--
-- 見つかった穴: guard_job_status_transition は BEFORE UPDATE だけで、INSERT には効いていなかった。
--   RLS の ow_jobs_company_admin_insert は status を draft / pending_review に絞っているが、
--   古い permissive なポリシー ow_jobs_own_insert（ow_companies.user_id = auth.uid()）が OR で効くため、
--   その会社の user_id に当たる利用者は PostgREST から status = 'published' で直接作れた。
--   実測（2026-10-12）: user_id が入っている会社は1社（検証用の株式会社エージェント）だけ。実害は無い。
--
-- 直し方: INSERT のときも、運営の経路（service_role / auth_is_admin）以外は
--   draft / pending_review / private（と NULL）しか許さない。UPDATE 側の規則と同じ語彙。
-- ⚠️ 既存のトリガー・ポリシーは変えない（締める方向の追加だけ）。

create or replace function public.guard_job_status_on_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'service_role' or public.auth_is_admin() then
    return new;
  end if;
  if new.status is not null and new.status not in ('draft', 'pending_review', 'private') then
    raise exception '求人の公開は運営またはアプリの公開の判定が行います（% では作れません）', new.status
      using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger trg_guard_job_status_on_insert
  before insert on public.ow_jobs
  for each row execute function public.guard_job_status_on_insert();
