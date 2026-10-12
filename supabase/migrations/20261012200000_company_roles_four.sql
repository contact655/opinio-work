-- ════════════════════════════════════════════════════════════════════════
-- 企業の担当者の役割を4つにする（2026-10-12 / 柴さんの指示・段階B1）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★役割（ow_company_admins.permission）
--   admin       管理者     … すべて
--   recruiter   採用担当   … 候補者・メッセージ・紹介・選考・求人・企業ページの本文・ストーリー・社員・資料・分析
--   interviewer 面接官     … 自分が担当の応募だけ（プロフィール・選考の流れを見て、メモを書く）
--   viewer      閲覧のみ   … 候補者・選考・求人・分析を見るだけ
--   いまの member は recruiter に移す（member がしていたことは全部 recruiter でもできる）。
--   ⚠️ member は 2026-10-12 時点で 本番 1行（検証用の会社 Third Box の contact+40）だけ。実在の会社は 0人。
--
-- ★DB の判定は auth_company_can(company_id, action) の1つだけにする（auth_is_company_admin /
--   auth_is_company_member は消す）。アプリ側の can(role, action)（lib/auth/roles.ts）と同じ考え方で、
--   DB では次の4段に畳んでいる:
--     'member' … 有効な担当者なら誰でも（役割を問わない。会社の行・担当者の一覧・部門など）
--     'view'   … admin / recruiter / viewer（候補者・選考の中身を読む）
--     'work'   … admin / recruiter（書き込み・メッセージ）
--     'admin'  … admin
--   ⚠️ 面接官は 'member' だけ。担当の応募は ow_application_interviewers を通して読む（ポリシーに書いてある）。
--
-- ★応募ごとの面接担当（ow_application_interviewers）を新設。1つの応募に何人でも付けられる。
--   付け外しはサーバー（採用担当以上）だけ。担当者は同じ会社の担当者なら読める。
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ① 役割の値
alter table public.ow_company_admins drop constraint ow_company_admins_permission_check;
update public.ow_company_admins set permission = 'recruiter' where permission = 'member';
alter table public.ow_company_admins
  add constraint ow_company_admins_permission_check check (permission in ('admin', 'recruiter', 'interviewer', 'viewer'));
alter table public.ow_company_admins alter column permission set default 'recruiter';

-- ⚠️ いまデプロイされているコードは招待・役割の変更で 'member' を書く。新しいコードが出るまでのあいだ
--    それを弾かないよう、書き込みの前に recruiter へ読み替える（CHECK より前に走る）。
--    新しいコードは 'member' を書かない。**後で外してよい**（外すときは src に 'member' を書く箇所が0件か数えること）。
create or replace function public.normalize_company_admin_permission()
returns trigger language plpgsql as $$
begin
  if new.permission = 'member' then new.permission := 'recruiter'; end if;
  return new;
end $$;
create trigger trg_normalize_company_admin_permission
  before insert or update of permission on public.ow_company_admins
  for each row execute function public.normalize_company_admin_permission();

-- ② 判定の関数（1つだけ）
create or replace function public.auth_company_can(p_company_id uuid, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- ★呼んだ本人がその会社で何をしてよいかだけを答える。⚠️ 段の意味は冒頭のコメントと lib/auth/roles.ts の DB_LEVEL
  select coalesce((
    select case p_action
             when 'member' then true
             when 'view'   then ca.permission in ('admin', 'recruiter', 'viewer')
             when 'work'   then ca.permission in ('admin', 'recruiter')
             when 'admin'  then ca.permission = 'admin'
             else false
           end
      from public.ow_company_admins ca
      join public.ow_users u on u.id = ca.user_id
     where ca.company_id = p_company_id
       and u.auth_id = auth.uid()
       and ca.is_active = true
     limit 1
  ), false);
$$;
comment on function public.auth_company_can(uuid, text) is
  '企業の担当者の権限（2026-10-12）。member / view / work / admin。呼んだ本人のことしか答えない（RLS の補助関数）。アプリ側は lib/auth/roles.ts の can()。';
revoke execute on function public.auth_company_can(uuid, text) from public;
grant execute on function public.auth_company_can(uuid, text) to anon, authenticated, service_role;

-- ③ 応募ごとの面接担当
create table public.ow_application_interviewers (
  application_id uuid not null references public.ow_job_applications(id) on delete cascade,
  user_id        uuid not null references public.ow_users(id) on delete cascade,
  company_id     uuid not null references public.ow_companies(id) on delete cascade,
  assigned_by    uuid references public.ow_users(id) on delete set null,
  created_at     timestamptz not null default now(),
  primary key (application_id, user_id)
);
create index ow_application_interviewers_user on public.ow_application_interviewers (user_id, company_id);
comment on table public.ow_application_interviewers is
  '応募ごとの面接担当（2026-10-12）。付け外しはサーバー（採用担当以上）だけ。面接官はここに載った応募だけを見られる。';
alter table public.ow_application_interviewers enable row level security;
revoke all on public.ow_application_interviewers from public, anon, authenticated;
-- ⚠️ 読みだけ配る。ow_job_applications のポリシーがこの表を引くため（引けないとポリシーの評価ごと 403 になる）
grant select on public.ow_application_interviewers to authenticated;
grant select, insert, delete on public.ow_application_interviewers to service_role;
create policy "company members read interviewers" on public.ow_application_interviewers
  for select to authenticated using (auth_company_can(company_id, 'member'));

-- ④ ポリシーの置き換え（70本。生成元: 本番の pg_policy をそのまま読み、判定だけを置き換えた）
drop policy "ow_activities_company_insert" on public.ow_activities;
create policy "ow_activities_company_insert" on public.ow_activities as permissive for insert to public
  with check (auth_company_can(company_id, 'member'));

drop policy "ow_activities_company_read" on public.ow_activities;
create policy "ow_activities_company_read" on public.ow_activities as permissive for select to public
  using (auth_company_can(company_id, 'member'));

drop policy "agent_agencies_delete" on public.ow_agent_agencies;
create policy "agent_agencies_delete" on public.ow_agent_agencies as permissive for delete to public
  using (auth_company_can(company_id, 'work'));

drop policy "agent_agencies_insert" on public.ow_agent_agencies;
create policy "agent_agencies_insert" on public.ow_agent_agencies as permissive for insert to public
  with check (auth_company_can(company_id, 'work'));

drop policy "agent_agencies_select" on public.ow_agent_agencies;
create policy "agent_agencies_select" on public.ow_agent_agencies as permissive for select to public
  using (auth_company_can(company_id, 'view'));

drop policy "agent_agencies_update" on public.ow_agent_agencies;
create policy "agent_agencies_update" on public.ow_agent_agencies as permissive for update to public
  using (auth_company_can(company_id, 'work'))
  with check (auth_company_can(company_id, 'work'));

drop policy "agent_contacts_company_member" on public.ow_agent_contacts;
create policy "agent_contacts_company_member" on public.ow_agent_contacts as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM ow_agent_agencies a
  WHERE ((a.id = ow_agent_contacts.agency_id) AND auth_company_can(a.company_id, 'work')))))
  with check ((EXISTS ( SELECT 1
   FROM ow_agent_agencies a
  WHERE ((a.id = ow_agent_contacts.agency_id) AND auth_company_can(a.company_id, 'work')))));

drop policy "agent_jobs_company_member" on public.ow_agent_jobs;
create policy "agent_jobs_company_member" on public.ow_agent_jobs as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM (ow_agent_agencies a
     JOIN ow_jobs j ON ((j.id = ow_agent_jobs.job_id)))
  WHERE ((a.id = ow_agent_jobs.agency_id) AND auth_company_can(a.company_id, 'work')))))
  with check ((EXISTS ( SELECT 1
   FROM ow_agent_agencies a
  WHERE ((a.id = ow_agent_jobs.agency_id) AND auth_company_can(a.company_id, 'work')))));

drop policy "ow_candidate_notes_company_member" on public.ow_candidate_notes;
create policy "ow_candidate_notes_company_member" on public.ow_candidate_notes as permissive for all to public
  using (auth_company_can(company_id, 'work'))
  with check (auth_company_can(company_id, 'work'));

drop policy "ow_candidate_stars_delete" on public.ow_candidate_stars;
create policy "ow_candidate_stars_delete" on public.ow_candidate_stars as permissive for delete to authenticated
  using (auth_company_can(company_id, 'work'));

drop policy "ow_candidate_stars_insert" on public.ow_candidate_stars;
create policy "ow_candidate_stars_insert" on public.ow_candidate_stars as permissive for insert to authenticated
  with check ((auth_company_can(company_id, 'work') AND (starred_by = auth_ow_user_id())));

drop policy "ow_candidate_stars_select" on public.ow_candidate_stars;
create policy "ow_candidate_stars_select" on public.ow_candidate_stars as permissive for select to authenticated
  using (auth_company_can(company_id, 'view'));

drop policy "ow_candidate_tracking_company_member" on public.ow_candidate_tracking;
create policy "ow_candidate_tracking_company_member" on public.ow_candidate_tracking as permissive for all to public
  using (auth_company_can(company_id, 'work'))
  with check (auth_company_can(company_id, 'work'));

drop policy "ow_casual_meetings_company_read" on public.ow_casual_meetings;
create policy "ow_casual_meetings_company_read" on public.ow_casual_meetings as permissive for select to public
  using (auth_company_can(company_id, 'view'));

drop policy "ow_casual_meetings_company_update" on public.ow_casual_meetings;
create policy "ow_casual_meetings_company_update" on public.ow_casual_meetings as permissive for update to public
  using (auth_company_can(company_id, 'work'));

drop policy "ow_companies_company_admin_update" on public.ow_companies;
create policy "ow_companies_company_admin_update" on public.ow_companies as permissive for update to public
  using (auth_company_can(id, 'work'))
  with check (auth_company_can(id, 'work'));

drop policy "ow_companies_member_select" on public.ow_companies;
create policy "ow_companies_member_select" on public.ow_companies as permissive for select to public
  using (auth_company_can(id, 'member'));

drop policy "ow_company_admins_admin_manage" on public.ow_company_admins;
create policy "ow_company_admins_admin_manage" on public.ow_company_admins as permissive for all to public
  using (auth_company_can(company_id, 'admin'))
  with check (auth_company_can(company_id, 'admin'));

drop policy "ow_company_admins_member_read" on public.ow_company_admins;
create policy "ow_company_admins_member_read" on public.ow_company_admins as permissive for select to public
  using (auth_company_can(company_id, 'member'));

drop policy "company_business_domains_auth_read" on public.ow_company_business_domains;
create policy "company_business_domains_auth_read" on public.ow_company_business_domains as permissive for select to authenticated
  using (((EXISTS ( SELECT 1
   FROM ow_companies c
  WHERE ((c.id = ow_company_business_domains.company_id) AND (c.is_published = true) AND (c.is_test = false)))) OR auth_company_can(company_id, 'member') OR auth_is_admin()));

drop policy "company_business_domains_write_delete" on public.ow_company_business_domains;
create policy "company_business_domains_write_delete" on public.ow_company_business_domains as permissive for delete to authenticated
  using ((auth_company_can(company_id, 'admin') OR auth_is_admin()));

drop policy "company_business_domains_write_insert" on public.ow_company_business_domains;
create policy "company_business_domains_write_insert" on public.ow_company_business_domains as permissive for insert to authenticated
  with check ((auth_company_can(company_id, 'admin') OR auth_is_admin()));

drop policy "company_business_domains_write_update" on public.ow_company_business_domains;
create policy "company_business_domains_write_update" on public.ow_company_business_domains as permissive for update to authenticated
  using ((auth_company_can(company_id, 'admin') OR auth_is_admin()))
  with check ((auth_company_can(company_id, 'admin') OR auth_is_admin()));

drop policy "company admins manage departments" on public.ow_company_departments;
create policy "company admins manage departments" on public.ow_company_departments as permissive for all to public
  using (auth_company_can(company_id, 'admin'));

drop policy "company members read departments" on public.ow_company_departments;
create policy "company members read departments" on public.ow_company_departments as permissive for select to public
  using (auth_company_can(company_id, 'member'));

drop policy "company_external_links_company_manage" on public.ow_company_external_links;
create policy "company_external_links_company_manage" on public.ow_company_external_links as permissive for all to public
  using (auth_company_can(company_id, 'admin'))
  with check (auth_company_can(company_id, 'admin'));

drop policy "ow_company_genres_company_admin_delete" on public.ow_company_genres;
create policy "ow_company_genres_company_admin_delete" on public.ow_company_genres as permissive for delete to public
  using (auth_company_can(company_id, 'admin'));

drop policy "ow_company_genres_company_admin_insert" on public.ow_company_genres;
create policy "ow_company_genres_company_admin_insert" on public.ow_company_genres as permissive for insert to public
  with check (auth_company_can(company_id, 'admin'));

drop policy "company admins manage job roles" on public.ow_company_job_roles;
create policy "company admins manage job roles" on public.ow_company_job_roles as permissive for all to public
  using (auth_company_can(company_id, 'admin'))
  with check (auth_company_can(company_id, 'admin'));

drop policy "company members read job roles" on public.ow_company_job_roles;
create policy "company members read job roles" on public.ow_company_job_roles as permissive for select to public
  using (auth_company_can(company_id, 'member'));

drop policy "Company admins can update requests to their company" on public.ow_company_join_requests;
create policy "Company admins can update requests to their company" on public.ow_company_join_requests as permissive for update to public
  using (((request_type = 'join_existing'::text) AND (target_company_id IS NOT NULL) AND auth_company_can(target_company_id, 'admin')));

drop policy "Company admins can view requests to their company" on public.ow_company_join_requests;
create policy "Company admins can view requests to their company" on public.ow_company_join_requests as permissive for select to public
  using (((request_type = 'join_existing'::text) AND (target_company_id IS NOT NULL) AND auth_company_can(target_company_id, 'admin')));

drop policy "company_admin_invite_member" on public.ow_company_members;
create policy "company_admin_invite_member" on public.ow_company_members as permissive for insert to authenticated
  with check ((auth_company_can(company_id, 'work') AND (display_consent = false)));

drop policy "company_admin_update_member" on public.ow_company_members;
create policy "company_admin_update_member" on public.ow_company_members as permissive for update to authenticated
  using (auth_company_can(company_id, 'work'));

drop policy "company_member_read_members" on public.ow_company_members;
create policy "company_member_read_members" on public.ow_company_members as permissive for select to authenticated
  using (auth_company_can(company_id, 'member'));

drop policy "member_delete" on public.ow_company_members;
create policy "member_delete" on public.ow_company_members as permissive for delete to authenticated
  using (((user_id = auth_ow_user_id()) OR auth_company_can(company_id, 'work')));

drop policy "ow_company_office_photos_admin_manage" on public.ow_company_office_photos;
create policy "ow_company_office_photos_admin_manage" on public.ow_company_office_photos as permissive for all to public
  using (auth_company_can(company_id, 'work'))
  with check (auth_company_can(company_id, 'work'));

drop policy "company members read plan" on public.ow_company_plans;
create policy "company members read plan" on public.ow_company_plans as permissive for select to public
  using ((auth_company_can(company_id, 'member') OR auth_is_admin()));

drop policy "company_member_all" on public.ow_company_posts;
create policy "company_member_all" on public.ow_company_posts as permissive for all to public
  using (auth_company_can(company_id, 'work'))
  with check (auth_company_can(company_id, 'work'));

drop policy "company admins manage segments" on public.ow_company_segments;
create policy "company admins manage segments" on public.ow_company_segments as permissive for all to public
  using (auth_company_can(company_id, 'admin'));

drop policy "company_target_industries_auth_read" on public.ow_company_target_industries;
create policy "company_target_industries_auth_read" on public.ow_company_target_industries as permissive for select to authenticated
  using (((EXISTS ( SELECT 1
   FROM ow_companies c
  WHERE ((c.id = ow_company_target_industries.company_id) AND (c.is_published = true) AND (c.is_test = false)))) OR auth_company_can(company_id, 'member') OR auth_is_admin()));

drop policy "company admins manage tools" on public.ow_company_tools;
create policy "company admins manage tools" on public.ow_company_tools as permissive for all to public
  using (auth_company_can(company_id, 'admin'));

drop policy "company admins can view own contact logs" on public.ow_contact_logs;
create policy "company admins can view own contact logs" on public.ow_contact_logs as permissive for select to public
  using (auth_company_can(company_id, 'view'));

drop policy "ow_conversation_messages_select" on public.ow_conversation_messages;
create policy "ow_conversation_messages_select" on public.ow_conversation_messages as permissive for select to public
  using (((EXISTS ( SELECT 1
   FROM (ow_conversation_participants p
     JOIN ow_conversations c ON ((c.id = p.conversation_id)))
  WHERE ((p.conversation_id = ow_conversation_messages.conversation_id) AND (p.user_id = auth_ow_user_id())
    AND ((p.role <> 'company_admin'::text) OR auth_company_can(c.company_id, 'work'))))) OR (EXISTS ( SELECT 1 FROM ow_user_roles r WHERE ((r.user_id = auth.uid()) AND (r.role = 'admin'::text))))));

drop policy "ow_conversation_participants_insert" on public.ow_conversation_participants;
create policy "ow_conversation_participants_insert" on public.ow_conversation_participants as permissive for insert to public
  with check (((EXISTS ( SELECT 1 FROM ow_conversations c
  WHERE ((c.id = ow_conversation_participants.conversation_id) AND (c.company_id IS NOT NULL) AND auth_company_can(c.company_id, 'work')))) OR (EXISTS ( SELECT 1 FROM ow_user_roles r WHERE ((r.user_id = auth.uid()) AND (r.role = 'admin'::text))))));

drop policy "ow_conversation_participants_select" on public.ow_conversation_participants;
create policy "ow_conversation_participants_select" on public.ow_conversation_participants as permissive for select to public
  using (((user_id = auth_ow_user_id()) OR (EXISTS ( SELECT 1 FROM ow_conversations c
  WHERE ((c.id = ow_conversation_participants.conversation_id) AND (c.company_id IS NOT NULL) AND auth_company_can(c.company_id, 'work')))) OR (EXISTS ( SELECT 1 FROM ow_user_roles r WHERE ((r.user_id = auth.uid()) AND (r.role = 'admin'::text))))));

drop policy "ow_conversations_select" on public.ow_conversations;
create policy "ow_conversations_select" on public.ow_conversations as permissive for select to public
  using (((candidate_user_id = auth_ow_user_id())
  OR ((partner_user_id = auth_ow_user_id()) AND ((kind <> 'direct_message'::text) OR (request_status = 'accepted'::text)))
  OR ((company_id IS NOT NULL) AND auth_company_can(company_id, 'work'))
  OR (EXISTS ( SELECT 1 FROM ow_user_roles r WHERE ((r.user_id = auth.uid()) AND (r.role = 'admin'::text))))));

drop policy "ow_conversations_update" on public.ow_conversations;
create policy "ow_conversations_update" on public.ow_conversations as permissive for update to public
  using (((candidate_user_id = auth_ow_user_id()) OR ((partner_user_id = auth_ow_user_id()) AND ((kind <> 'direct_message'::text) OR (request_status = 'accepted'::text))) OR ((company_id IS NOT NULL) AND auth_company_can(company_id, 'work')) OR auth_is_admin()))
  with check (((candidate_user_id = auth_ow_user_id()) OR ((partner_user_id = auth_ow_user_id()) AND ((kind <> 'direct_message'::text) OR (request_status = 'accepted'::text))) OR ((company_id IS NOT NULL) AND auth_company_can(company_id, 'work')) OR auth_is_admin()));

drop policy "company admins read invoice" on public.ow_invoices;
create policy "company admins read invoice" on public.ow_invoices as permissive for select to public
  using (auth_company_can(company_id, 'admin'));

drop policy "company_admins_read_applications" on public.ow_job_applications;
create policy "company_admins_read_applications" on public.ow_job_applications as permissive for select to public
  using ((EXISTS ( SELECT 1 FROM ow_jobs j WHERE ((j.id = ow_job_applications.job_id)
   AND (auth_company_can(j.company_id, 'view')
        OR (auth_company_can(j.company_id, 'member') AND EXISTS ( SELECT 1 FROM ow_application_interviewers ai
             WHERE ((ai.application_id = ow_job_applications.id) AND (ai.user_id = auth_ow_user_id())))))))));

drop policy "company_admins_update_applications" on public.ow_job_applications;
create policy "company_admins_update_applications" on public.ow_job_applications as permissive for update to public
  using ((EXISTS ( SELECT 1 FROM ow_jobs j WHERE ((j.id = ow_job_applications.job_id) AND auth_company_can(j.company_id, 'work')))))
  with check ((EXISTS ( SELECT 1 FROM ow_jobs j WHERE ((j.id = ow_job_applications.job_id) AND auth_company_can(j.company_id, 'work')))));

drop policy "ow_job_assignees_member_manage" on public.ow_job_assignees;
create policy "ow_job_assignees_member_manage" on public.ow_job_assignees as permissive for all to public
  using ((EXISTS ( SELECT 1 FROM ow_jobs j WHERE ((j.id = ow_job_assignees.job_id) AND auth_company_can(j.company_id, 'work')))));

drop policy "ow_job_assignees_select_company_member" on public.ow_job_assignees;
create policy "ow_job_assignees_select_company_member" on public.ow_job_assignees as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM ow_jobs j
  WHERE ((j.id = ow_job_assignees.job_id) AND auth_company_can(j.company_id, 'member')))));

drop policy "ow_job_internal_notes_delete" on public.ow_job_internal_notes;
create policy "ow_job_internal_notes_delete" on public.ow_job_internal_notes as permissive for delete to authenticated
  using (auth_company_can(company_id, 'work'));

drop policy "ow_job_internal_notes_insert" on public.ow_job_internal_notes;
create policy "ow_job_internal_notes_insert" on public.ow_job_internal_notes as permissive for insert to authenticated
  with check ((auth_company_can(company_id, 'work') AND (EXISTS ( SELECT 1
   FROM ow_jobs j
  WHERE ((j.id = ow_job_internal_notes.job_id) AND (j.company_id = ow_job_internal_notes.company_id))))));

drop policy "ow_job_internal_notes_select" on public.ow_job_internal_notes;
create policy "ow_job_internal_notes_select" on public.ow_job_internal_notes as permissive for select to authenticated
  using (auth_company_can(company_id, 'view'));

drop policy "ow_job_internal_notes_update" on public.ow_job_internal_notes;
create policy "ow_job_internal_notes_update" on public.ow_job_internal_notes as permissive for update to authenticated
  using (auth_company_can(company_id, 'work'))
  with check ((auth_company_can(company_id, 'work') AND (EXISTS ( SELECT 1
   FROM ow_jobs j
  WHERE ((j.id = ow_job_internal_notes.job_id) AND (j.company_id = ow_job_internal_notes.company_id))))));

drop policy "ow_job_roles_company_admin_delete" on public.ow_job_roles;
create policy "ow_job_roles_company_admin_delete" on public.ow_job_roles as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM ow_jobs j
  WHERE ((j.id = ow_job_roles.job_id) AND auth_company_can(j.company_id, 'work')))));

drop policy "ow_job_roles_company_admin_insert" on public.ow_job_roles;
create policy "ow_job_roles_company_admin_insert" on public.ow_job_roles as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM ow_jobs j
  WHERE ((j.id = ow_job_roles.job_id) AND auth_company_can(j.company_id, 'work')))));

drop policy "ow_jobs_company_admin_delete" on public.ow_jobs;
create policy "ow_jobs_company_admin_delete" on public.ow_jobs as permissive for delete to public
  using (auth_company_can(company_id, 'work'));

drop policy "ow_jobs_company_admin_insert" on public.ow_jobs;
create policy "ow_jobs_company_admin_insert" on public.ow_jobs as permissive for insert to public
  with check ((auth_company_can(company_id, 'work') AND ((status IS NULL) OR (status = ANY (ARRAY['draft'::text, 'pending_review'::text])))));

drop policy "ow_jobs_company_admin_update" on public.ow_jobs;
create policy "ow_jobs_company_admin_update" on public.ow_jobs as permissive for update to public
  using (auth_company_can(company_id, 'work'))
  with check (auth_company_can(company_id, 'work'));

drop policy "ow_jobs_company_member_select" on public.ow_jobs;
create policy "ow_jobs_company_member_select" on public.ow_jobs as permissive for select to public
  using (auth_company_can(company_id, 'member'));

drop policy "ow_matches_company_read" on public.ow_matches;
create policy "ow_matches_company_read" on public.ow_matches as permissive for select to public
  using (auth_company_can(company_id, 'view'));

drop policy "ow_matches_company_update" on public.ow_matches;
create policy "ow_matches_company_update" on public.ow_matches as permissive for update to public
  using (auth_company_can(company_id, 'work'));

drop policy "ow_meetings_party_select" on public.ow_meetings;
create policy "ow_meetings_party_select" on public.ow_meetings as permissive for select to public
  using ((auth_company_can(company_id, 'view') OR (candidate_user_id = auth_ow_user_id())));

drop policy "pipeline_stages_delete" on public.ow_pipeline_stages;
create policy "pipeline_stages_delete" on public.ow_pipeline_stages as permissive for delete to public
  using ((auth_company_can(company_id, 'work') AND (is_hired = false) AND (is_rejected = false)));

drop policy "pipeline_stages_insert" on public.ow_pipeline_stages;
create policy "pipeline_stages_insert" on public.ow_pipeline_stages as permissive for insert to public
  with check (auth_company_can(company_id, 'work'));

drop policy "pipeline_stages_select" on public.ow_pipeline_stages;
create policy "pipeline_stages_select" on public.ow_pipeline_stages as permissive for select to public
  using (auth_company_can(company_id, 'member'));

drop policy "pipeline_stages_update" on public.ow_pipeline_stages;
create policy "pipeline_stages_update" on public.ow_pipeline_stages as permissive for update to public
  using (auth_company_can(company_id, 'work'))
  with check (auth_company_can(company_id, 'work'));

-- ⑤ Storage の書き込み: ロゴは管理者、事務所の写真・採用担当の写真は採用担当以上
create or replace function public.ow_uploads_can_write(object_name text)
returns boolean
language sql
stable
as $function$
  SELECT
    (
      (storage.foldername(object_name))[1] = 'users'
      AND (storage.foldername(object_name))[2] IN ('avatars','covers')
      AND (storage.foldername(object_name))[3] IN (
        SELECT u.id::text FROM public.ow_users u WHERE u.auth_id = auth.uid()
      )
    )
    OR (
      (storage.foldername(object_name))[1] = 'posts'
      AND (storage.foldername(object_name))[2] IN (
        SELECT u.id::text FROM public.ow_users u WHERE u.auth_id = auth.uid()
      )
    )
    OR (
      auth.uid() IS NOT NULL
      AND (storage.foldername(object_name))[1] = auth.uid()::text
      AND (storage.foldername(object_name))[2] = 'experience-stories'
    )
    -- ④ 企業の画像: companies/{logos|office-photos|recruiter-avatars}/{company_id}/…
    --    ⚠️ uuid へのキャストをしない（キャスト失敗は例外になり、書き込みが 500 になる）
    --    ★ロゴ（会社の基本情報）は管理者、写真は採用担当以上（2026-10-12）
    OR (
      (storage.foldername(object_name))[1] = 'companies'
      AND (storage.foldername(object_name))[2] IN ('logos','office-photos','recruiter-avatars')
      AND (
        public.auth_is_admin()
        OR EXISTS (
          SELECT 1 FROM public.ow_companies c
           WHERE c.id::text = (storage.foldername(object_name))[3]
             AND public.auth_company_can(c.id, CASE WHEN (storage.foldername(object_name))[2] = 'logos' THEN 'admin' ELSE 'work' END)
        )
      )
    );
$function$;

-- ⑥ 古い判定の関数を消す（⚠️ CASCADE を付けない。残っている参照があればここで失敗させる）
drop function public.auth_is_company_admin(uuid);
drop function public.auth_is_company_member(uuid);

-- 検算
do $$
declare n int;
begin
  if exists (select 1 from public.ow_company_admins where permission not in ('admin','recruiter','interviewer','viewer')) then
    raise exception '検算失敗: 4つ以外の役割が残っている';
  end if;
  select count(*) into n from pg_policy p join pg_class c on c.oid = p.polrelid
   where c.relnamespace = 'public'::regnamespace
     and coalesce(pg_get_expr(p.polqual, p.polrelid), '') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ '(auth_is_company_admin|auth_is_company_member)';
  if n <> 0 then raise exception '検算失敗: 古い関数を使うポリシーが % 本', n; end if;
  select count(*) into n from pg_policy p join pg_class c on c.oid = p.polrelid
   where c.relnamespace = 'public'::regnamespace
     and coalesce(pg_get_expr(p.polqual, p.polrelid), '') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ 'auth_company_can';
  if n < 71 then raise exception '検算失敗（陽性対照）: 新しい関数を使うポリシーが % 本しかない', n; end if;
  -- 実在の会社の担当者の役割は変わっていないこと（全員 admin のまま）
  if exists (select 1 from public.ow_company_admins a join public.ow_companies c on c.id = a.company_id
              where c.is_test is not true and a.permission <> 'admin') then
    raise exception '検算失敗: 実在の会社に admin 以外の担当者がいる（想定外）';
  end if;
  if has_table_privilege('anon', 'public.ow_application_interviewers', 'SELECT')
     or has_table_privilege('authenticated', 'public.ow_application_interviewers', 'INSERT') then
    raise exception '検算失敗: 面接担当の表に余計な権限がある';
  end if;
  raise notice '検算OK（新しい関数を使うポリシー % 本）', n;
end $$;

commit;
