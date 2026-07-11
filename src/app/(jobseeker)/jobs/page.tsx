import type { Metadata } from "next";
import { Suspense } from "react";
import { getJobs, getParentRoles, getCompanyReviewSummaries } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeRecommendations, type RecommendedJob } from "@/lib/matching/scoreJob";
import JobsClient from "./JobsClient";

// ログイン状態でパーソナライズするため force-dynamic
// （getJobs は unstable_cache 内部キャッシュで高速）
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "IT/SaaS求人を探す | OPINIO" },
  description:
    "LayerX・SmartHR・HubSpot・Salesforceなど、IT/SaaS業界の最新求人情報。フルリモート・高年収・PdM・エンジニア求人を検索。",
  keywords: ["IT転職", "SaaS求人", "エンジニア転職", "PdM求人", "フルリモート", "高年収", "OPINIO"],
  alternates: { canonical: "/jobs" },
  openGraph: {
    title: "IT/SaaS求人を探す | OPINIO",
    description: "LayerX・SmartHR・HubSpot・Salesforceなど、IT/SaaS業界の最新求人情報。フルリモート・高年収・PdM・エンジニア求人を検索。",
    type: "website",
    url: "/jobs",
    images: [{ url: "/api/og?type=list&title=%E6%B1%82%E4%BA%BA%E3%82%92%E6%8E%A2%E3%81%99&sub=IT%2FSaaS%E6%A5%AD%E7%95%8C%E3%81%AE%E6%9C%80%E6%96%B0%E6%B1%82%E4%BA%BA%E6%83%85%E5%A0%B1", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

async function fetchUserRecommendations(
  jobs: Awaited<ReturnType<typeof getJobs>>["jobs"],
  companies: Awaited<ReturnType<typeof getJobs>>["companies"]
): Promise<RecommendedJob[]> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const adminSupabase = createAdminClient();

    // ow_profiles.user_id = auth.users.id（直接 auth UUID）
    // ow_user_skill_tags.user_id = ow_users.id（ow_users 経由）
    // → 両テーブルで FK が異なるため別々に解決する
    const [{ data: profile }, owUserResult] = await Promise.all([
      adminSupabase
        .from("ow_profiles")
        .select("job_type, desired_work_style, desired_salary_min, desired_salary_max, desired_phase")
        .eq("user_id", user.id)   // Fix 1: auth UUID を直接使う
        .maybeSingle(),
      adminSupabase
        .from("ow_users")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle(),
    ]);

    const owUserId = owUserResult.data?.id;
    const { data: skillRows } = owUserId
      ? await adminSupabase
          .from("ow_user_skill_tags")
          .select("label")
          .eq("user_id", owUserId)
      : { data: [] };

    if (!profile) return [];

    const scoringProfile = {
      job_type: profile.job_type ?? null,
      desired_work_style: profile.desired_work_style ?? null,
      desired_salary_min: profile.desired_salary_min ? Number(profile.desired_salary_min) : null,
      desired_salary_max: profile.desired_salary_max ? Number(profile.desired_salary_max) : null,
      desired_phase: (profile.desired_phase as string[] | null) ?? null,
      skill_labels: (skillRows ?? []).map((r: { label: string }) => r.label).filter(Boolean),
    };

    // company_id → phase マップを構築
    const phaseMap = new Map(
      companies
        .filter((c) => c.phase)
        .map((c) => [c.id, c.phase as string])
    );

    return computeRecommendations(jobs, phaseMap, scoringProfile);
  } catch {
    return [];
  }
}

export default async function JobsPage() {
  const [{ jobs, companies }, parentRoles, reviewSummaries] = await Promise.all([
    getJobs(),
    getParentRoles(),
    getCompanyReviewSummaries(),
  ]);

  const recommendations = await fetchUserRecommendations(jobs, companies);

  return (
    <Suspense
      fallback={
        <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto" }}>
          <div className="skeleton-shimmer" style={{ height: 48, borderRadius: 12, marginBottom: 16 }} />
          <div className="skeleton-shimmer" style={{ height: 44, borderRadius: 8, marginBottom: 20, maxWidth: 500 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 130, borderRadius: 16 }} />
            ))}
          </div>
        </div>
      }
    >
      <JobsClient jobs={jobs} companies={companies} parentRoles={parentRoles} recommendations={recommendations} reviewSummaries={reviewSummaries} />
    </Suspense>
  );
}
