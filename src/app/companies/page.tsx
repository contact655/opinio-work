import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import CompanyExplorer from "./CompanyExplorer";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

// 必要なカラムだけ取得して高速化
const COMPANY_COLUMNS = `
  id, name, industry, description,
  employee_count, phase,
  avg_salary, remote_rate, funding_total, founded_year, founded_at,
  brand_color, url, logo_url, location,
  created_at, avg_overtime, paid_leave_rate, avg_age, status,
  mission,
  ow_jobs(id, title, job_category, status, location, salary_min, salary_max, work_style, created_at),
  ow_company_culture_tags(tag_category, tag_value)
`;

async function getCompanies() {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_companies")
    .select(COMPANY_COLUMNS)
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

/* ─── Loading Skeleton ─── */
function CompaniesLoadingSkeleton() {
  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-white">
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
          {/* Search bar skeleton */}
          <div style={{ height: 44, background: "#f5f5f4", borderRadius: 10, marginBottom: 20 }} className="animate-pulse" />
          {/* Card skeletons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{
                  height: 110,
                  background: "#fafaf8",
                  borderRadius: 13,
                  border: "0.5px solid #e5e7eb",
                }}
              />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

/* ─── Content (streamed via Suspense) ─── */
async function CompaniesContent({ viewParam }: { viewParam?: string }) {
  const supabase = createClient();

  // 全データを並列取得
  const companiesPromise = getCompanies();
  const userPromise = supabase.auth.getUser();

  const [companies, { data: { user } }] = await Promise.all([
    companiesPromise,
    userPromise,
  ]);

  const validViews = ["list", "grid", "grid5", "section"];
  const initialView = validViews.includes(viewParam || "")
    ? (viewParam as "list" | "grid" | "grid5" | "section")
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

export default function CompaniesPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  return (
    <Suspense fallback={<CompaniesLoadingSkeleton />}>
      <CompaniesContent viewParam={searchParams.view} />
    </Suspense>
  );
}
