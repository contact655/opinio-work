import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFollowCounts } from "@/lib/people/followCounts";
import { canUserPost } from "@/lib/feed/canPost";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchJobRoleLabels } from "@/lib/jobs/roleLabel";
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
import { hasCareerPreferences } from "@/lib/profile/completion";
import { formatEmployeeCount } from "@/lib/utils/employeeCount";

export const metadata = { title: { absolute: "マイページ | OPINIO" }, robots: { index: false, follow: false } };

export default async function MypagePage({
  searchParams,
}: {
  /* ⚠️ `setup` は 2026-08-10 に削除した。`?setup=done` を付ける経路が
        どこにも無く（/profile/start が存在しないため）、到達不能だった。 */
  searchParams?: { welcome?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/mypage");
  }

  /* ⚠️ birth_date は 2026-08-06 に authenticated から SELECT 権限を剥がした。
        session クライアントの select に含めると PostgREST がクエリごと 403 にし、
        owUser が null になってダッシュボードが丸ごと空になる（画面は 200 のまま）。
        本人の行だけを扱うので admin で引く。 */
  const { data: owUser } = await createAdminClient()
    .from("ow_users")
    .select("id, name, avatar_color, avatar_url, cover_color, about_me, birth_date, location, social_links, future_aspirations, profile_setup_at")
    .eq("auth_id", user.id)
    .maybeSingle();

  /* フォロー数。0 の項目は FollowCounts 側で落とすのでここでは素通し。
     ⚠️ 単独で await せず、下の Promise.all に相乗りさせる（2026-08-09）。
        owUser.id しか要らないので、学歴・職歴と同時に取れる。 */
  let followCounts: Awaited<ReturnType<typeof getFollowCounts>> = { followers: 0, following: 0 };

  // Fetch educations + experiences + roles in parallel
  let educations: {
    id: string; school: string; school_id: string | null;
    school_master: { id: string; name: string; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null;
    faculty: string | null; degree: string | null;
    enrolled_at: string | null; graduated_at: string | null; is_current: boolean; sort_order: number;
  }[] = [];
  let timelineCareers: CareerEntry[] = [];
  if (owUser) {
    const [
      { data: edus },
      { data: expRows },
      { data: allRoles },
      followCountsResult,
    ] = await Promise.all([
      supabase
        .from("ow_user_educations")
        .select(`id, school, school_id, faculty, degree, enrolled_at, graduated_at, is_current, sort_order, school_master:ow_schools!school_id(id, name, logo_letter, logo_gradient, logo_url)`)
        .eq("user_id", owUser.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("ow_experiences")
        /* ⚠️ salary_man は SELECT しない。2026-08-06 に authenticated から
              年収4列の SELECT 権限を剥奪したので、含めると全体が
              permission denied になり職歴が丸ごと消える。表示にも使っていない。 */
        /* ⚠️ join_reason は SELECT しない。2026-08-06 に authenticated から権限を剥がしたので、
              含めるとクエリごと 403 になり職歴が丸ごと消える（画面は 200 のまま空になる）。
              MergedTimeline は join_reason を描画していないので、表示にも影響しない。 */
        .select("id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, description, employment_type, visibility_company, visibility_salary, visibility_reason, visibility_company_profile")
        .eq("user_id", owUser.id)
        .order("is_current", { ascending: false })
        .order("started_at", { ascending: false }),
      supabase
        .from("ow_roles")
        .select("id, name, parent_id"),
      getFollowCounts(owUser.id),
    ]);

    followCounts = followCountsResult;

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
        .select("id, name, logo_url, logo_letter, logo_gradient, industry, phase, employee_count, is_published")
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
          // ⚠️ 非公開企業には企業ページへのリンクを張らない（本番で404になるため）。
          //    timeline.ts:161 がこれを見て company_id を null に落とす。
          //    /u/[id] は以前から渡していたが、ここが漏れていた（2026-08-05 修正）。
          isPublished: (c.is_published as boolean) ?? false,
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

  // 母校の同窓人数（自分除外・seed除外・private除外）
  const schoolPeerCounts: Record<string, number> = {};
  if (owUser) {
    const schoolIds = educations
      .filter((e) => e.school_id)
      .map((e) => e.school_id as string);
    if (schoolIds.length > 0) {
      const adminForSchools = createAdminClient();
      const { data: peerRows } = await adminForSchools
        .from("ow_user_educations")
        .select("school_id, ow_users!inner(visibility, is_test)")
        .in("school_id", schoolIds)
        .neq("user_id", owUser.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of (peerRows ?? []) as Array<Record<string, any>>) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = row.ow_users as Record<string, any> | null;
        if (!u) continue;
        if (u.visibility === "private") continue;
        if ((u.is_test as boolean | null) === true) continue;
        const sid = row.school_id as string;
        schoolPeerCounts[sid] = (schoolPeerCounts[sid] ?? 0) + 1;
      }
    }
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

      /* ⚠️ 「気になる企業」と「気になる求人」は互いに独立。
            2026-08-09 まで順番に await していたので1往復ぶん無駄だった。
            片方が0件なら、そちら側は問い合わせずに null を返す。 */
      const [bmCompaniesRes, bmJobsRes] = await Promise.all([
        companyBmarks.length > 0
          ? supabase
              .from("ow_companies")
              .select("id, slug, name, industry, employee_count, phase")
              .in("id", companyBmarks.map((b) => b.target_id as string))
          : Promise.resolve({ data: null }),
        jobBmarks.length > 0
          ? supabase
              .from("ow_jobs")
              .select("id, title, job_category, company_id")
              .in("id", jobBmarks.map((b) => b.target_id as string))
          : Promise.resolve({ data: null }),
      ]);

      // ── Company bookmarks ──
      {
        const companies = bmCompaniesRes.data;
        if (companies) {
          const companyMap = new Map(companies.map((c) => [c.id, c]));
          companyBookmarks = companyBmarks
            .map((b): Bookmark | null => {
              const c = companyMap.get(b.target_id as string);
              if (!c) return null;
              const meta = [c.industry, formatEmployeeCount(c.employee_count)]
                .filter(Boolean).join(" / ");
              return {
                id: b.id as string, type: "company",
                title: c.name as string, meta,
                badge_label: (c.industry as string) ?? "企業",
                href: `/companies/${c.slug ?? c.id}`,
              };
            })
            .filter((b): b is Bookmark => b !== null);
        }
      }

      // ── Job bookmarks ──
      {
        const jobs = bmJobsRes.data;
        if (jobs) {
          /* 職種の表示は会社呼称 ?? 標準職種名。
             ⚠️ ow_company_job_roles の RLS は「その会社の管理者だけ」なので、
                ここのユーザーセッションのクライアントでは引けない。admin を使う。
             ⚠️ 会社呼称と会社名はどちらも jobs にぶら下がるだけで互いに参照しない
                ので、まとめて1往復にする（2026-08-09）。 */
          const jobCompanyIds = Array.from(new Set(jobs.map((j) => j.company_id as string)));
          const [roleLabels, { data: companies }] = await Promise.all([
            fetchJobRoleLabels(jobs.map((j) => j.id as string)),
            supabase.from("ow_companies").select("id, name").in("id", jobCompanyIds),
          ]);
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
                meta: [companyName, roleLabels.get(j.id as string)?.label].filter(Boolean).join(" / "),
                badge_label: roleLabels.get(j.id as string)?.label ?? "求人",
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
      const jobIds = meetings
        .filter((m) => m.job_id)
        .map((m) => m.job_id as string);

      /* ⚠️ 企業と求人はどちらも meetings からぶら下がるだけで、互いに参照しない。
            2026-08-09 まで順番に await していたので1往復ぶん無駄だった。 */
      const [{ data: companies }, jobsRes] = await Promise.all([
        supabase
          .from("ow_companies")
          .select("id, name, logo_gradient, logo_letter")
          .in("id", companyIds),
        jobIds.length > 0
          ? supabase.from("ow_jobs").select("id, title").in("id", jobIds)
          : Promise.resolve({ data: null as Array<{ id: string; title: string }> | null }),
      ]);

      const jobMap = new Map<string, string>();
      for (const j of jobsRes.data ?? []) {
        jobMap.set(j.id as string, j.title as string);
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
  // ⚠️ 判定は lib/profile/completion.ts の hasCareerPreferences() に寄せる。
  //    ここに条件を書き足すと /profile/edit と食い違って完成度が15点ずれる（2026-08-07）。
  let hasPrefs = false;
  let showScoutBanner = false;
  if (owUser) {
    const [{ data: profile, error: profileError }, { count: desiredRoleCount, error: drError }] = await Promise.all([
      supabase
        .from("ow_profiles")
        .select("desired_work_styles, desired_salary_min, desired_salary_max, transfer_timing, desired_phase, worry, onboarding_completed, scout_enabled")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("ow_profile_desired_roles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);
    if (profileError) console.error("[mypage] ow_profiles fetch error:", profileError.message);
    if (drError) console.error("[mypage] desired_roles count error:", drError.message);
    hasPrefs = hasCareerPreferences({ ...(profile ?? {}), desiredRoleCount: desiredRoleCount ?? 0 });
    // オンボーディング完了済みだがscout_enabled未設定の場合バナー表示
    showScoutBanner = profile?.onboarding_completed === true && profile?.scout_enabled == null;
  }

  // Fetch notification badge counts
  let conversationsBadge = 0;
  let applicationsBadge = 0;
  let scoutsBadge = 0;
  if (owUser) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ count: convCount }, { count: appCount }, { count: scoutCount }] = await Promise.all([
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
      /* 未返答のスカウト。
         ⚠️ `ow_scouts.candidate_id` は **auth 空間**なので `user.id` で引く。
            `owUser.id`（ow_users 空間）で引くと常に0件になる。
         ⚠️ RLS の候補者ポリシーに依存しないよう admin で引く。条件は candidate_id だけ。 */
      createAdminClient()
        .from("ow_scouts")
        .select("id", { count: "exact", head: true })
        .eq("candidate_id", user.id)
        .eq("status", "sent"),
    ]);
    conversationsBadge = convCount ?? 0;
    applicationsBadge = appCount ?? 0;
    scoutsBadge = scoutCount ?? 0;
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

  const isNewUser = searchParams?.welcome === "1";

  // 投稿できる人か。できないなら「アクティビティ」セクションごと畳む
  //（コンポーザーがセクションの中身そのものなので、消すと空欄になる）
  const canPost = owUser ? await canUserPost(createAdminClient(), owUser.id) : false;

  return <MypageClient canPost={canPost} owUser={owUser} followCounts={followCounts} educations={educations} timelineCareers={timelineCareers} companyBookmarks={companyBookmarks} jobBookmarks={jobBookmarks} casualMeetings={casualMeetings} conversationsBadge={conversationsBadge} applicationsBadge={applicationsBadge} scoutsBadge={scoutsBadge} hasCareerPreferences={hasPrefs} isNewUser={isNewUser} ambassadorMemberships={ambassadorMemberships} showScoutBanner={showScoutBanner} schoolPeerCounts={schoolPeerCounts} />;
}
