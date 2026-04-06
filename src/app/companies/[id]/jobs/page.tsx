import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getCompanyWithJobs(id: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_companies")
    .select(
      `id, name, logo_url, industry, location, employee_count,
      ow_jobs(id, title, job_category, employment_type, description, salary_min, salary_max, location, work_style, status)`
    )
    .eq("id", id)
    .single();
  return data;
}

export default async function CompanyJobsPage({
  params,
}: {
  params: { id: string };
}) {
  const company = await getCompanyWithJobs(params.id);
  if (!company) return notFound();

  const jobs = (company.ow_jobs || []).filter(
    (j: any) => j.status === "active"
  );

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        {/* Company Header */}
        <div className="bg-white border-b border-card-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50">
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={company.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-gray-400">
                    {company.name[0]}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <Link
                  href={`/companies/${company.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  ← 企業詳細に戻る
                </Link>
                <h1 className="text-xl font-bold mt-0.5">{company.name}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  {company.industry && <span>{company.industry}</span>}
                  {company.location && <span>{company.location}</span>}
                  {company.employee_count && (
                    <span>{/^\d+$/.test(company.employee_count) ? `${company.employee_count}名` : String(company.employee_count).includes("名") ? company.employee_count : `${company.employee_count}名`}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Job List */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h2 className="text-lg font-bold mb-6">
            {company.name}の求人一覧（{jobs.length}件）
          </h2>

          {jobs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {jobs.map((job: any) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block bg-white rounded-card-lg border border-card-border overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="p-5">
                    {/* Job title */}
                    <h3 className="font-medium text-lg leading-tight mb-2">
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
                          {job.work_style}
                        </span>
                      )}
                      {job.employment_type && (
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {job.employment_type}
                        </span>
                      )}
                    </div>

                    {/* Bottom row */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-4">
                        {job.salary_min && job.salary_max && (
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
                            {job.salary_min}〜{job.salary_max}万円
                          </span>
                        )}
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
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg mb-2">
                現在募集中の求人はありません
              </p>
              <Link
                href={`/companies/${company.id}`}
                className="text-primary hover:underline text-sm"
              >
                企業詳細に戻る
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
