import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import CompanyExplorer from "./CompanyExplorer";

export const dynamic = "force-dynamic";

async function getCompanies() {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_companies")
    .select(
      `*, ow_jobs(id, title, job_category), ow_company_culture_tags(tag_category, tag_value)`
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });
  return data || [];
}

async function getSavedCompanyIds(userId: string): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_saved_companies")
    .select("company_id")
    .eq("user_id", userId);
  return (data || []).map((d: any) => d.company_id);
}

async function getMatchScores(userId: string): Promise<Record<string, number>> {
  const supabase = createClient();
  try {
    const { data } = await supabase
      .from("ow_match_scores")
      .select("company_id, overall_score")
      .eq("user_id", userId);
    const map: Record<string, number> = {};
    for (const m of data || []) {
      map[m.company_id] = m.overall_score;
    }
    return map;
  } catch {
    return {};
  }
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const supabase = createClient();
  const companies = await getCompanies();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const validViews = ["list", "grid", "grid5", "section"];
  const initialView = validViews.includes(searchParams.view || "")
    ? (searchParams.view as "list" | "grid" | "grid5" | "section")
    : "list";

  let savedIds: string[] = [];
  let matchMap: Record<string, number> = {};
  if (user) {
    const [s, m] = await Promise.all([
      getSavedCompanyIds(user.id),
      getMatchScores(user.id),
    ]);
    savedIds = s;
    matchMap = m;
  }

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-white">
        <CompanyExplorer
          companies={companies}
          initialView={initialView}
          savedCompanyIds={savedIds}
          matchScoreMap={matchMap}
          isLoggedIn={!!user}
        />
      </main>
      <Footer />
    </>
  );
}
