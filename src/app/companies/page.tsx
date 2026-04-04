import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import CompanyCarousel from "./CompanyCarousel";

export const dynamic = "force-dynamic";

async function getCompanies(query?: string) {
  const supabase = createClient();
  let q = supabase
    .from("ow_companies")
    .select(
      `*, ow_jobs(id)`
    )
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
  searchParams: { q?: string; sort?: string };
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

          {/* Sort & Count */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-gray-500">
              {companies.length}社の企業が見つかりました
            </p>
            <div className="flex gap-2">
              {[
                { label: "おすすめ順", value: "" },
                { label: "新着順", value: "new" },
                { label: "求人数順", value: "jobs" },
              ].map((s) => (
                <Link
                  key={s.value}
                  href={`/companies?sort=${s.value}${
                    searchParams.q ? `&q=${searchParams.q}` : ""
                  }`}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    (searchParams.sort || "") === s.value
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-600 border-card-border hover:border-gray-300"
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Carousel */}
          {companies.length > 0 ? (
            <CompanyCarousel companies={companies} />
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg mb-2">
                企業が見つかりませんでした
              </p>
              <p className="text-gray-400 text-sm">
                検索条件を変更してお試しください
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
