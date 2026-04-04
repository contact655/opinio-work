import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getCompanies(query?: string) {
  const supabase = createClient();
  let q = supabase
    .from("ow_companies")
    .select(
      `*, ow_company_photos(photo_url, is_main, display_order), ow_jobs(id)`
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

function CompanyInitial({ name }: { name: string }) {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      className={`w-full h-full ${color} flex items-center justify-center text-white text-4xl font-bold`}
    >
      {name[0]}
    </div>
  );
}

function CompanyCard({ company }: { company: any }) {
  const photos = company.ow_company_photos || [];
  const jobCount = company.ow_jobs?.length || 0;
  const hasPhotos = photos.length > 0;

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block cursor-pointer bg-white rounded-card-lg border border-card-border overflow-hidden hover:shadow-lg transition-shadow"
    >
      {/* Cover Image */}
      <div className="relative h-48">
        {hasPhotos ? (
          <div className="grid grid-cols-3 h-full">
            {photos.slice(0, 3).map((p: any, i: number) => (
              <div
                key={i}
                className="bg-gray-200 bg-cover bg-center"
                style={{ backgroundImage: `url(${p.photo_url})` }}
              />
            ))}
            {photos.length < 3 &&
              Array.from({ length: 3 - photos.length }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-gray-200" />
              ))}
          </div>
        ) : (
          <CompanyInitial name={company.name} />
        )}

        {/* Industry tag */}
        {company.industry && (
          <span className="absolute top-3 left-3 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
            {company.industry}
          </span>
        )}

        {/* Job count badge */}
        {jobCount > 0 && (
          <span className="absolute bottom-3 right-3 bg-primary text-white text-xs px-3 py-1 rounded-full">
            求人 {jobCount}件
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          {/* Logo */}
          <div className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50">
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-gray-400">
                {company.name[0]}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-lg leading-tight">
              {company.name}
            </h3>
          </div>
        </div>

        {company.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">
            {company.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          {company.location && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {company.location}
            </span>
          )}
          <span className="text-sm text-primary font-medium hover:underline">
            詳細を見る →
          </span>
        </div>
      </div>
    </Link>
  );
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

          {/* Sort */}
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

          {/* Grid */}
          {companies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {companies.map((c: any) => (
                <CompanyCard key={c.id} company={c} />
              ))}
            </div>
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
