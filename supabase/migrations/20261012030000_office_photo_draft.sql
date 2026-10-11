-- ★企業の写真を「公開する」まで求職者に見せない（2026-10-12 / 柴さんの指示）。
--
-- それまで写真はアップロードした瞬間に求職者側へ出ていた（企業ページの他の項目は下書き→「公開する」）。
-- 写真にも未公開の状態を持たせ、企業の「公開する」（lib/companies/applyDraft.ts）で公開にする。
--
--   is_draft = true  … 企業が追加した直後。求職者には見えない（企業の担当者と運営には見える）
--   is_draft = false … 公開済み
--
-- ⚠️ 既存の写真は 0枚（2026-10-12 実測）。既定値 false なので、既存の行（があれば）は公開のまま。
-- ⚠️★企業（authenticated）が自分で is_draft = false を立てられないよう、トリガーで止める。
--    求人の guard_job_status_on_insert（20261012020000）と同じ形。運営の経路（service_role / auth_is_admin）は素通し。
--    ・INSERT … 企業からは is_draft を必ず true にする（false を送っても true に直す）
--    ・UPDATE … 企業からは is_draft を変えられない（true→false も false→true も）
-- ⚠️ 読み取りの RLS（public_read: USING true）を is_draft = false に絞る。
--    企業の担当者は ow_company_office_photos_admin_manage（auth_is_company_admin）で自社の未公開も読める。

alter table public.ow_company_office_photos
  add column is_draft boolean not null default false;

comment on column public.ow_company_office_photos.is_draft is
  '未公開（企業が追加して、まだ「公開する」を押していない）。求職者には出さない。公開は lib/companies/applyDraft.ts（2026-10-12）';

-- ── 読み取り ──
drop policy ow_company_office_photos_public_read on public.ow_company_office_photos;
create policy ow_company_office_photos_public_read on public.ow_company_office_photos
  for select using (is_draft = false);

-- ── 企業から is_draft を動かせないようにする ──
create or replace function public.guard_office_photo_draft()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'service_role' or public.auth_is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_draft := true;
  elsif new.is_draft is distinct from old.is_draft then
    raise exception '写真の公開は「公開する」から行ってください'
      using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger trg_guard_office_photo_draft
  before insert or update on public.ow_company_office_photos
  for each row execute function public.guard_office_photo_draft();

-- 検算
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ow_company_office_photos' and column_name = 'is_draft'
  ) then
    raise exception 'is_draft が無い';
  end if;
end
$$;
