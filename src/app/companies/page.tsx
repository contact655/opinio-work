import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import CompanySections from "./CompanySections";

export const dynamic = "force-dynamic";

async function getCompanies(query?: string) {
  const supabase = createClient();
  let q = supabase
    .from("ow_companies")
    .select(`*, ow_jobs(id), ow_company_culture_tags(tag_category, tag_value)`)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (query) {
    q = q.or(
      `name.ilike.%${query}%,industry.ilike.%${query}%,description.ilike.%${query}%`
    );
  }

  const { data } = await q;
  return data || [];
}

async function getRecentJobs() {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_jobs")
    .select(`id, title, job_category, salary_min, salary_max, location, work_style, company_id, ow_companies(id, name, logo_url)`)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10);
  return data || [];
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const [companies, recentJobs] = await Promise.all([
    getCompanies(searchParams.q),
    getRecentJobs(),
  ]);

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-white">
        <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search */}
          <div className="mb-8">
            <form action="/companies" method="GET">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  name="q"
                  defaultValue={searchParams.q}
                  placeholder="企業名・業界・キーワードで検索"
                  className="w-full pl-11 pr-6 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent focus:bg-white transition-colors"
                />
              </div>
            </form>
          </div>

          <CompanySections companies={companies} recentJobs={recentJobs} />
        </div>
      </main>
      <Footer />
    </>
  );
}
