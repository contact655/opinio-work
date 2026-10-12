-- ════════════════════════════════════════════════════════════════════════
-- 企業の担当者まわり: DB のルールを API の範囲に揃える（2026-10-12 / 柴さんの指示・段階A）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★何が食い違っていたか
--   API は「その企業の有効な担当者（admin でも member でも）」に使わせているのに、
--   DB のルールは「管理者（permission = 'admin'）だけ」になっていた箇所がある。
--   API はサーバー用のキー（RLS を通らない）か、セッションのクライアントで読むため、
--   ・サーバー用のキーの経路 … DB のルールが効いておらず、ルールの記述だけが古い
--   ・セッションの経路      … member には「0件」に化けて、使えないのに気づけない
--   のどちらかになっていた。正は「いま API で使わせている範囲」（柴さんの指示）。
--
-- ★揃えたもの（すべて 管理者だけ → 有効な担当者）
--   ow_candidate_notes       … 読み書き（API: /api/biz/candidates/[userId]/notes。担当者なら誰でも）
--   ow_candidate_tracking    … 読み書き（同 tracking）
--   ow_meetings              … 読み（/biz/meetings・選考の流れ。担当者なら誰でも）
--   ow_conversations         … 更新（メッセージ送信時の last_message_at。担当者なら誰でも送れる）
--   ow_company_plans         … 読み（getCompanyContext がセッションで引く。member は「プラン不明」に倒れていた）
--   ow_jobs                  … 読み（/biz/jobs・/biz/meetings がセッションで引く。書き込みは管理者のまま）
--   ow_company_departments   … 読み（/biz/jobs の部門の絞り込み。書き込みは管理者のまま）
--   ow_company_job_roles     … 読み（書き込みは管理者のまま）
--   ow_company_business_domains / ow_company_target_industries … 読み（書き込みは変えない）
--   ow_company_members       … 読み（/biz/employees は担当者なら誰でも開ける）
--
-- ★auth_is_active_company_admin を消した
--   名前は「管理者」だが中身は「有効な担当者か」だけで、auth_is_company_member と本文が同じだった。
--   中身を名前に合わせる（管理者だけにする）と、星・企業ストーリー・求人の社内メモが member から
--   使えなくなる（いま API で使えている範囲が減る）ので、**名前を中身に合わせて** auth_is_company_member に
--   寄せ、同じものが2つある状態をなくした。使っていたのは3表のポリシーだけ（関数・ビュー・アプリ 0件。2026-10-12 実測）。
--
-- ⚠️ 実在の会社のいまの担当者は全員 admin（member 0人。2026-10-12 実測）。admin は「有効な担当者」に含まれるので、
--    この変更で実在の会社の誰かができることは増えも減りもしない。
-- ⚠️ 書き込みを管理者だけにしている表（求人・部門・職種・会社情報・写真・社員の招待など）は変えていない。
-- ════════════════════════════════════════════════════════════════════════

begin;

-- 候補者メモ・追跡
drop policy "ow_candidate_notes_company_admin" on public.ow_candidate_notes;
create policy "ow_candidate_notes_company_member" on public.ow_candidate_notes
  for all using (auth_is_company_member(company_id)) with check (auth_is_company_member(company_id));

drop policy "ow_candidate_tracking_company_admin" on public.ow_candidate_tracking;
create policy "ow_candidate_tracking_company_member" on public.ow_candidate_tracking
  for all using (auth_is_company_member(company_id)) with check (auth_is_company_member(company_id));

-- 面談
drop policy "ow_meetings_party_select" on public.ow_meetings;
create policy "ow_meetings_party_select" on public.ow_meetings
  for select using (auth_is_company_member(company_id) or candidate_user_id = auth_ow_user_id());

-- 会話の更新（企業の担当者の枝だけ）
drop policy "ow_conversations_update" on public.ow_conversations;
create policy "ow_conversations_update" on public.ow_conversations
  for update
  using ((candidate_user_id = auth_ow_user_id())
      or ((partner_user_id = auth_ow_user_id()) and ((kind <> 'direct_message') or (request_status = 'accepted')))
      or ((company_id is not null) and auth_is_company_member(company_id))
      or auth_is_admin())
  with check ((candidate_user_id = auth_ow_user_id())
      or ((partner_user_id = auth_ow_user_id()) and ((kind <> 'direct_message') or (request_status = 'accepted')))
      or ((company_id is not null) and auth_is_company_member(company_id))
      or auth_is_admin());

-- 契約プラン（読み）
drop policy "company admins read plan" on public.ow_company_plans;
create policy "company members read plan" on public.ow_company_plans
  for select using (auth_is_company_member(company_id) or auth_is_admin());

-- 求人（読み）。書き込みの3本は管理者のまま
drop policy "ow_jobs_company_admin_select" on public.ow_jobs;
create policy "ow_jobs_company_member_select" on public.ow_jobs
  for select using (auth_is_company_member(company_id));

-- 部門・職種（読み）。管理（書き込み）は管理者のまま
create policy "company members read departments" on public.ow_company_departments
  for select using (auth_is_company_member(company_id));
create policy "company members read job roles" on public.ow_company_job_roles
  for select using (auth_is_company_member(company_id));

-- 事業領域・顧客の業界（読み）
drop policy "company_business_domains_auth_read" on public.ow_company_business_domains;
create policy "company_business_domains_auth_read" on public.ow_company_business_domains
  for select to authenticated using (
    (exists (select 1 from public.ow_companies c
              where c.id = ow_company_business_domains.company_id and c.is_published = true and c.is_test = false))
    or auth_is_company_member(company_id) or auth_is_admin());

drop policy "company_target_industries_auth_read" on public.ow_company_target_industries;
create policy "company_target_industries_auth_read" on public.ow_company_target_industries
  for select to authenticated using (
    (exists (select 1 from public.ow_companies c
              where c.id = ow_company_target_industries.company_id and c.is_published = true and c.is_test = false))
    or auth_is_company_member(company_id) or auth_is_admin());

-- 社員・OB/OG（読み）。招待・更新・削除は管理者のまま
drop policy "company_admin_read_members" on public.ow_company_members;
create policy "company_member_read_members" on public.ow_company_members
  for select to authenticated using (auth_is_company_member(company_id));

-- auth_is_active_company_admin → auth_is_company_member（中身が同じ。名前を中身に合わせて1つにする）
drop policy "ow_candidate_stars_select" on public.ow_candidate_stars;
drop policy "ow_candidate_stars_insert" on public.ow_candidate_stars;
drop policy "ow_candidate_stars_delete" on public.ow_candidate_stars;
create policy "ow_candidate_stars_select" on public.ow_candidate_stars
  for select to authenticated using (auth_is_company_member(company_id));
create policy "ow_candidate_stars_insert" on public.ow_candidate_stars
  for insert to authenticated with check (auth_is_company_member(company_id) and starred_by = auth_ow_user_id());
create policy "ow_candidate_stars_delete" on public.ow_candidate_stars
  for delete to authenticated using (auth_is_company_member(company_id));

drop policy "company_admin_all" on public.ow_company_posts;
create policy "company_member_all" on public.ow_company_posts
  for all using (auth_is_company_member(company_id)) with check (auth_is_company_member(company_id));

drop policy "ow_job_internal_notes_select" on public.ow_job_internal_notes;
drop policy "ow_job_internal_notes_insert" on public.ow_job_internal_notes;
drop policy "ow_job_internal_notes_update" on public.ow_job_internal_notes;
drop policy "ow_job_internal_notes_delete" on public.ow_job_internal_notes;
create policy "ow_job_internal_notes_select" on public.ow_job_internal_notes
  for select to authenticated using (auth_is_company_member(company_id));
create policy "ow_job_internal_notes_insert" on public.ow_job_internal_notes
  for insert to authenticated with check (auth_is_company_member(company_id)
    and exists (select 1 from public.ow_jobs j where j.id = ow_job_internal_notes.job_id and j.company_id = ow_job_internal_notes.company_id));
create policy "ow_job_internal_notes_update" on public.ow_job_internal_notes
  for update to authenticated using (auth_is_company_member(company_id))
  with check (auth_is_company_member(company_id)
    and exists (select 1 from public.ow_jobs j where j.id = ow_job_internal_notes.job_id and j.company_id = ow_job_internal_notes.company_id));
create policy "ow_job_internal_notes_delete" on public.ow_job_internal_notes
  for delete to authenticated using (auth_is_company_member(company_id));

-- ⚠️ CASCADE を付けない。上で使っていたポリシーを全部置き換えてあるので、残っていればここで失敗する
drop function public.auth_is_active_company_admin(uuid);

-- 検算
do $$
declare n int;
begin
  select count(*) into n from pg_policy p join pg_class c on c.oid = p.polrelid
   where c.relnamespace = 'public'::regnamespace
     and c.relname in ('ow_candidate_notes','ow_candidate_tracking','ow_meetings','ow_conversations','ow_company_plans',
                       'ow_company_business_domains','ow_company_target_industries','ow_company_members')
     and p.polcmd in ('r','*')
     and coalesce(pg_get_expr(p.polqual, p.polrelid), '') ~ 'auth_is_company_admin';
  if n <> 0 then raise exception '検算失敗: 読みのポリシーに auth_is_company_admin が % 本残っている', n; end if;

  -- 書き込みを管理者だけにしている表は変えていないこと（陽性対照）
  select count(*) into n from pg_policy p
   where p.polrelid = 'public.ow_jobs'::regclass and p.polcmd in ('a','w','d')
     and coalesce(pg_get_expr(p.polqual, p.polrelid), '') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ 'auth_is_company_admin';
  if n <> 3 then raise exception '検算失敗: 求人の書き込み（管理者だけ）が 3本でない: %', n; end if;

  if to_regprocedure('public.auth_is_active_company_admin(uuid)') is not null then
    raise exception '検算失敗: auth_is_active_company_admin が残っている';
  end if;
  raise notice '検算OK';
end $$;

commit;
