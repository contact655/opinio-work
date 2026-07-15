import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import MypageClient from "./MypageClient";
import type {
  Bookmark,
  CasualMeeting,
  CasualMeetingStatus,
} from "@/app/mypage/mockMypageData";
import type { CareerEntry } from "@/components/profile/MergedTimeline";
import {
  buildTimelineCareerEntriesFromRaw,
  type RawExperienceRow,
  type CompanyLogoInfo,
} from "@/lib/utils/timeline";

export const metadata = { title: { absolute: "マイページ | OPINIO" }, robots: { index: false, follow: false } };

export default async function MypagePage({
  searchParams,
}: {
  searchParams?: { setup?: string; welcome?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/mypage");
  }

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id, name, avatar_color, avatar_url, cover_color, about_me, birth_date, location, social_links, future_aspirations, profile_setup_at")
    .eq("auth_id", user.id)
    .maybeSingle();

  // Fetch skill tags + educations + certifications + experiences + roles in parallel
  let skillTags: { id: string; label: string; sort_order: number }[] = [];
  let educations: {
    id: string; school: string; school_id: string | null;
    school_master: { id: string; name: string; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null;
    faculty: string | null; degree: string | null;
    enrolled_at: string | null; graduated_at: string | null; is_current: boolean; sort_order: number;
  }[] = [];
  let certifications: { id: string; name: string; sort_order: number }[] = [];
  let timelineCareers: CareerEntry[] = [];
  if (owUser) {
    const [
      { data: tags },
      { data: edus },
      { data: certs },
      { data: expRows },
      { data: allRoles },
    ] = await Promise.all([
      supabase
        .from("ow_user_skill_tags")
        .select("id, label, sort_order")
        .eq("user_id", owUser.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("ow_user_educations")
        .select(`id, school, school_id, faculty, degree, enrolled_at, graduated_at, is_current, sort_order, school_master:ow_schools!school_id(id, name, logo_letter, logo_gradient, logo_url)`)
        .eq("user_id", owUser.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("ow_user_certifications")
        .select("id, name, sort_order")
        .eq("user_id", owUser.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("ow_experiences")
        .select("id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, description, join_reason, employment_type, salary_man, visibility_company, visibility_salary, visibility_reason, visibility_company_profile")
        .eq("user_id", owUser.id)
        .order("is_current", { ascending: false })
        .order("started_at", { ascending: false }),
      supabase
        .from("ow_roles")
        .select("id, name, parent_id"),
    ]);

    skillTags = (tags ?? []).map((t) => ({
      id: t.id as string,
      label: t.label as string,
      sort_order: t.sort_order as number,
    }));
    educations = (edus ?? []).map((e) => ({
      id: e.id as string,
      school: e.school as string,
      school_id: (e.school_id as string | null) ?? null,
      school_master: (e.school_master as unknown as { id: string; name: string; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null) ?? null,
      faculty: (e.faculty as string | null) ?? null,
      degree: (e.degree as string | null) ?? null,
      enrolled_at: (e.enrolled_at as string | null) ?? null,
      graduated_at: (e.graduated_at as string | null) ?? null,
      is_current: e.is_current as boolean,
      sort_order: e.sort_order as number,
    }));
    certifications = (certs ?? []).map((c) => ({
      id: c.id as string,
      name: c.name as string,
      sort_order: c.sort_order as number,
    }));

    // ロール情報 Map（職種名 + 親カテゴリ名）
    const roleByIdRaw = new Map<string, { name: string; parent_id: string | null }>();
    for (const role of (allRoles ?? []) as { id: string; name: string; parent_id: string | null }[]) {
      roleByIdRaw.set(role.id, { name: role.name, parent_id: role.parent_id });
    }
    const roleNameById = new Map(
      Array.from(roleByIdRaw.entries()).map(([id, r]) => [
        id,
        {
          name: r.name,
          parent_name: r.parent_id ? (roleByIdRaw.get(r.parent_id)?.name ?? null) : null,
        },
      ])
    );

    // master 企業の会社名 + ロゴ 3 フィールドを二次取得（A-1: logo_url / logo_letter / logo_gradient 追加）
    const masterCompanyIds = (expRows ?? [])
      .filter((r) => r.company_id)
      .map((r) => r.company_id as string);
    const companyInfoById = new Map<string, CompanyLogoInfo>();
    if (masterCompanyIds.length > 0) {
      const { data: companies } = await supabase
        .from("ow_companies")
        .select("id, name, logo_url, logo_letter, logo_gradient, industry, phase, employee_count")
        .in("id", masterCompanyIds);
      for (const c of companies ?? []) {
        companyInfoById.set(c.id as string, {
          name: c.name as string,
          logoUrl: (c.logo_url as string | null) ?? null,
          logoLetter: (c.logo_letter as string | null) ?? null,
          logoGradient: (c.logo_gradient as string | null) ?? null,
          industry: (c.industry as string | null) ?? null,
          phase: (c.phase as string | null) ?? null,
          employee_count: (c.employee_count as number | null) ?? null,
        });
      }
    }

    timelineCareers = buildTimelineCareerEntriesFromRaw(
      (expRows ?? []) as RawExperienceRow[],
      roleNameById,
      companyInfoById,
      true, // マイページは常にオーナー本人 → 実名表示
    );
  }

  // Fetch bookmarks for company and job
  let companyBookmarks: Bookmark[] = [];
  let jobBookmarks: Bookmark[] = [];
  if (owUser) {
    // Fetch all bookmark rows for this user (company + job)
    const { data: bmarks } = await supabase
      .from("ow_bookmarks")
      .select("id, target_id, target_type")
      .eq("user_id", owUser.id)
      .in("target_type", ["company", "job"])
      .order("created_at", { ascending: false });

    if (bmarks && bmarks.length > 0) {
      const companyBmarks = bmarks.filter((b) => b.target_type === "company");
      const jobBmarks = bmarks.filter((b) => b.target_type === "job");

      // ── Company bookmarks ──
      if (companyBmarks.length > 0) {
        const companyIds = companyBmarks.map((b) => b.target_id as string);
        const { data: companies } = await supabase
          .from("ow_companies")
          .select("id, name, industry, employee_count, phase")
          .in("id", companyIds);
        if (companies) {
          const companyMap = new Map(companies.map((c) => [c.id, c]));
          companyBookmarks = companyBmarks
            .map((b): Bookmark | null => {
              const c = companyMap.get(b.target_id as string);
              if (!c) return null;
              const meta = [c.industry, c.employee_count ? `${c.employee_count}名` : null]
                .filter(Boolean).join(" / ");
              return {
                id: b.id as string, type: "company",
                title: c.name as string, meta,
                badge_label: (c.industry as string) ?? "企業",
                href: `/companies/${c.id}`,
              };
            })
            .filter((b): b is Bookmark => b !== null);
        }
      }

      // ── Job bookmarks ──
      if (jobBmarks.length > 0) {
        const jobIds = jobBmarks.map((b) => b.target_id as string);
        const { data: jobs } = await supabase
          .from("ow_jobs")
          .select("id, title, job_category, company_id")
          .in("id", jobIds);
        if (jobs) {
          // Also fetch company names for context
          const jobCompanyIds = Array.from(new Set(jobs.map((j) => j.company_id as string)));
          const { data: companies } = await supabase
            .from("ow_companies")
            .select("id, name")
            .in("id", jobCompanyIds);
          const companyNameMap = new Map((companies ?? []).map((c) => [c.id as string, c.name as string]));
          const jobMap = new Map(jobs.map((j) => [j.id, j]));
          jobBookmarks = jobBmarks
            .map((b): Bookmark | null => {
              const j = jobMap.get(b.target_id as string);
              if (!j) return null;
              const companyName = companyNameMap.get(j.company_id as string) ?? "";
              return {
                id: b.id as string, type: "job",
                title: j.title as string,
                meta: [companyName, j.job_category as string].filter(Boolean).join(" / "),
                badge_label: (j.job_category as string) ?? "求人",
                href: `/jobs/${j.id}`,
              };
            })
            .filter((b): b is Bookmark => b !== null);
        }
      }
    }
  }

  // Fetch casual meetings with company logo info
  let casualMeetings: CasualMeeting[] = [];
  if (owUser) {
    const { data: meetings } = await supabase
      .from("ow_casual_meetings")
      .select("id, company_id, job_id, status, created_at")
      .eq("user_id", owUser.id)
      .order("created_at", { ascending: false });

    if (meetings && meetings.length > 0) {
      const companyIdSet = new Set(meetings.map((m) => m.company_id as string));
      const companyIds = Array.from(companyIdSet);
      const { data: companies } = await supabase
        .from("ow_companies")
        .select("id, name, logo_gradient, logo_letter")
        .in("id", companyIds);

      const jobIds = meetings
        .filter((m) => m.job_id)
        .map((m) => m.job_id as string);
      const jobMap = new Map<string, string>();
      if (jobIds.length > 0) {
        const { data: jobs } = await supabase
          .from("ow_jobs")
          .select("id, title")
          .in("id", jobIds);
        for (const j of jobs ?? []) {
          jobMap.set(j.id as string, j.title as string);
        }
      }

      const companyMap = new Map((companies ?? []).map((c) => [c.id as string, c]));
      const FALLBACK_GRADIENT = "linear-gradient(135deg, var(--royal), #3B5FD9)";

      casualMeetings = meetings.map((m): CasualMeeting => {
        const c = companyMap.get(m.company_id as string);
        const appliedAt = (m.created_at ? new Date(m.created_at as string) : new Date())
          .toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
          .replace(/\//g, ".");
        return {
          id: m.id as string,
          company_id: m.company_id as string,
          company_name: (c?.name as string) ?? "—",
          company_initial: (c?.logo_letter as string) ?? (c?.name as string)?.charAt(0) ?? "?",
          company_gradient: (c?.logo_gradient as string) ?? FALLBACK_GRADIENT,
          job_title: m.job_id
            ? (jobMap.get(m.job_id as string) ?? "カジュアル面談")
            : "カジュアル面談",
          applied_at: appliedAt,
          status: (m.status as CasualMeetingStatus) ?? "pending",
        };
      });
    }
  }

  // Fetch ow_profiles career preferences (user_id = auth.users.id)
  let hasCareerPreferences = false;
  let showScoutBanner = false;
  if (owUser) {
    const { data: profile } = await supabase
      .from("ow_profiles")
      .select("job_type, desired_work_style, desired_salary_min, transfer_timing, onboarding_completed, scout_enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    hasCareerPreferences = !!(
      profile?.job_type ||
      profile?.desired_work_style ||
      profile?.desired_salary_min ||
      profile?.transfer_timing
    );
    // オンボーディング完了済みだがscout_enabled未設定の場合バナー表示
    showScoutBanner = profile?.onboarding_completed === true && profile?.scout_enabled == null;
  }

  // Fetch notification badge counts
  let conversationsBadge = 0;
  let applicationsBadge = 0;
  if (owUser) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ count: convCount }, { count: appCount }] = await Promise.all([
      supabase
        .from("ow_conversations")
        .select("id", { count: "exact", head: true })
        .or(`candidate_user_id.eq.${owUser.id},company_user_id.eq.${owUser.id}`)
        .gt("updated_at", sevenDaysAgo),
      supabase
        .from("ow_job_applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", owUser.id)
        .neq("status", "pending"),
    ]);
    conversationsBadge = convCount ?? 0;
    applicationsBadge = appCount ?? 0;
  }

  // Fetch ambassador memberships (面談対応者として登録されているか)
  type AmbassadorMembership = { id: string; company_id: string; company_name: string; role_title: string | null; display_consent: boolean };
  let ambassadorMemberships: AmbassadorMembership[] = [];
  if (owUser) {
    const adminSupabase = createAdminClient();
    const { data: memberRows } = await adminSupabase
      .from("ow_company_members")
      .select("id, company_id, role_title, display_consent, ow_companies!company_id(name, brand_name)")
      .eq("user_id", owUser.id);
    type MRow = { id: string; company_id: string; role_title: string | null; display_consent: boolean; ow_companies: { name: string | null; brand_name: string | null } | null };
    ambassadorMemberships = (memberRows ?? []).map((r) => {
      const row = r as unknown as MRow;
      return {
        id: row.id,
        company_id: row.company_id,
        company_name: row.ow_companies?.brand_name ?? row.ow_companies?.name ?? "—",
        role_title: row.role_title,
        display_consent: row.display_consent,
      };
    });
  }

  const showSetupBanner = !owUser?.profile_setup_at;
  const setupJustDone = searchParams?.setup === "done";
  const isNewUser = searchParams?.welcome === "1";

  return <MypageClient owUser={owUser} skillTags={skillTags} educations={educations} certifications={certifications} timelineCareers={timelineCareers} companyBookmarks={companyBookmarks} jobBookmarks={jobBookmarks} casualMeetings={casualMeetings} conversationsBadge={conversationsBadge} applicationsBadge={applicationsBadge} hasCareerPreferences={hasCareerPreferences} showSetupBanner={showSetupBanner} setupJustDone={setupJustDone} isNewUser={isNewUser} ambassadorMemberships={ambassadorMemberships} showScoutBanner={showScoutBanner} />;
}
