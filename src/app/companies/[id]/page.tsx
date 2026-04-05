import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CompanyDetailClient from "./CompanyDetailClient";

export const dynamic = "force-dynamic";

async function getCompany(id: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_companies")
    .select(
      `*,
      ow_company_photos(id, photo_url, is_main, display_order),
      ow_company_members(id, name, role, background, photo_url, display_order),
      ow_company_culture_tags(id, tag_category, tag_value),
      ow_jobs(id, title, job_category, salary_min, salary_max, location, work_style, status)`
    )
    .eq("id", id)
    .single();
  return data;
}

async function getMatchScore(userId: string, companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_match_scores")
    .select("overall_score, culture_score, skill_score, career_score, workstyle_score, match_reasons")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .single();
  return data;
}

async function getReviews(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_company_reviews")
    .select("id, reviewer_name, role, content, rating")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(2);
  return data || [];
}

async function hasProfile(userId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_profiles")
    .select("id")
    .eq("user_id", userId)
    .single();
  return !!data;
}

export default async function CompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const company = await getCompany(params.id);
  if (!company) return notFound();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  // Parallel fetches
  let matchScore = null;
  let profileExists = false;
  let reviews: any[] = [];

  if (user) {
    const [matchResult, profileResult, reviewsResult] = await Promise.all([
      getMatchScore(user.id, params.id).catch(() => null),
      hasProfile(user.id).catch(() => false),
      getReviews(params.id).catch(() => []),
    ]);
    matchScore = matchResult;
    profileExists = profileResult;
    reviews = reviewsResult;
  } else {
    reviews = await getReviews(params.id).catch(() => []);
  }

  // 修正5: 求人の重複除去（IDベース）
  const allJobs = (company.ow_jobs || []).filter(
    (j: any) => j.status === "active"
  );
  const seenJobIds = new Set<string>();
  const jobs = allJobs.filter((j: any) => {
    if (seenJobIds.has(j.id)) return false;
    seenJobIds.add(j.id);
    return true;
  });

  const members = (company.ow_company_members || []).sort(
    (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)
  );
  const cultureTags = company.ow_company_culture_tags || [];

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-white">
        <CompanyDetailClient
          company={company}
          jobs={jobs}
          members={members}
          cultureTags={cultureTags}
          reviews={reviews}
          matchScore={matchScore}
          isLoggedIn={isLoggedIn}
          hasProfile={profileExists}
        />
      </main>
      <Footer />
    </>
  );
}
