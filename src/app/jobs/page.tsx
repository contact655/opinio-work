import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

async function getJobs(query?: string, sort?: string) {
  const supabase = createClient();
  let q = supabase
    .from("ow_jobs")
    .select("*, ow_companies(id, name, logo_url, industry)")
    .eq("status", "active");

  if (query) {
    q = q.or(
      `title.ilike.%${query}%,job_category.ilike.%${query}%,location.ilike.%${query}%,description.ilike.%${query}%`
    );
  }

  if (sort === "salary") {
    q = q.order("salary_max", { ascending: false, nullsFirst: false });
  } else {
    q = q.order("created_at", { ascending: false });
  }

  const { data } = await q;
  return data || [];
}

function JobCard({ job }: { job: any }) {
  const company = job.ow_companies;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block bg-white rounded-card-lg border border-card-border overflow-hidden hover:shadow-lg transition-shadow"
    >
      <div className="p-5">
        {/* Company info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-gray-400">
                {company?.name?.[0] || "?"}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">{company?.name || "企業名非公開"}</p>
            {company?.industry && (
              <span className="text-xs text-gray-400">{company.industry}</span>
            )}
          </div>
        </div>

        {/* Job title */}
        <h3 className="font-medium text-lg leading-tight mb-2 line-clamp-2">
          {job.title}
        </h3>

        {/* Description */}
        {job.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-4">
            {job.description}
          </p>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {job.job_category && (
            <span className="px-2.5 py-1 bg-primary-light text-primary text-xs rounded-full">
              {job.job_category}
            </span>
          )}
          {job.work_style && (
            <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs rounded-full">
              {job.work_style === "remote"
                ? "フルリモート"
                : job.work_style === "hybrid"
                ? "ハイブリッド"
                : "オフィス出社"}
            </span>
          )}
          {job.employment_type && (
            <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
              {job.employment_type === "full_time"
                ? "正社員"
                : job.employment_type === "contract"
                ? "契約社員"
                : job.employment_type === "freelance"
                ? "業務委託"
                : job.employment_type}
            </span>
          )}
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-4">
            {/* Salary */}
            {(job.salary_min || job.salary_max) && (
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <svg
                  className="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {job.salary_min || "?"}〜{job.salary_max || "?"}万円
              </span>
            )}

            {/* Location */}
            {job.location && (
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
                {job.location}
              </span>
            )}
          </div>

          <span className="text-sm text-primary font-medium">
            詳細を見る →
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string };
}) {
  const jobs = await getJobs(searchParams.q, searchParams.sort);

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search */}
          <div className="mb-8">
            <form action="/jobs" method="GET">
              <input
                type="text"
                name="q"
                defaultValue={searchParams.q}
                placeholder="職種・勤務地・キーワードで検索　例）フロントエンド リモート 年収600万"
                className="w-full px-6 py-4 bg-white border border-card-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </form>
          </div>

          {/* Sort */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-gray-500">
              {jobs.length}件の求人が見つかりました
            </p>
            <div className="flex gap-2">
              {[
                { label: "新着順", value: "" },
                { label: "年収順", value: "salary" },
              ].map((s) => (
                <Link
                  key={s.value}
                  href={`/jobs?sort=${s.value}${
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
          {jobs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {jobs.map((j: any) => (
                <JobCard key={j.id} job={j} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg mb-2">
                求人が見つかりませんでした
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
