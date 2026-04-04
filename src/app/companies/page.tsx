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

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const companies = await getCompanies(searchParams.q);

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search */}
          <div className="mb-8">
            <form action="/companies" method="GET">
              <input
                type="text"
                name="q"
                defaultValue={searchParams.q}
                placeholder="企業名・業界・雰囲気で検索　例）フルリモート 外資系 急成長"
                className="w-full px-6 py-4 bg-white border border-card-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </form>
          </div>

          <CompanySections companies={companies} />
        </div>
      </main>
      <Footer />
    </>
  );
}
