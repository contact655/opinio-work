import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

async function getJob(id: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_jobs")
    .select(
      `*,
      ow_companies(id, name, logo_url, location, industry, employee_count, phase,
        ow_company_photos(photo_url, is_main, display_order)
      ),
      ow_job_requirements(id, requirement_type, content, display_order),
      ow_job_matching_tags(id, tag_category, tag_value)`
    )
    .eq("id", id)
    .single();
  return data;
}

function SalaryDisplay({
  min,
  max,
}: {
  min?: number | null;
  max?: number | null;
}) {
  if (!min && !max) return null;
  if (min && max)
    return (
      <span>
        {min}〜{max}万円
      </span>
    );
  if (min) return <span>{min}万円〜</span>;
  return <span>〜{max}万円</span>;
}

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const job = await getJob(params.id);
  if (!job) return notFound();

  const company = job.ow_companies;
  const requirements = job.ow_job_requirements || [];
  const mustReqs = requirements
    .filter((r: any) => r.requirement_type === "must")
    .sort((a: any, b: any) => a.display_order - b.display_order);
  const wantReqs = requirements
    .filter((r: any) => r.requirement_type === "want")
    .sort((a: any, b: any) => a.display_order - b.display_order);
  const selectionProcess = job.selection_process as any[] | null;

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-8">
            {/* Main Column */}
            <div className="flex-1 space-y-6">
              {/* Job Header */}
              <section className="bg-white rounded-card p-6 border border-card-border">
                <div className="flex items-center gap-2 mb-3">
                  {job.job_category && (
                    <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {job.job_category}
                    </span>
                  )}
                  {job.employment_type && (
                    <span className="px-2.5 py-0.5 bg-primary-light text-primary text-xs rounded-full">
                      {job.employment_type}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold mb-4">{job.title}</h1>

                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  {(job.salary_min || job.salary_max) && (
                    <div className="flex items-center gap-1.5">
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
                      <SalaryDisplay min={job.salary_min} max={job.salary_max} />
                    </div>
                  )}
                  {job.location && (
                    <div className="flex items-center gap-1.5">
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
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                      </svg>
                      {job.location}
                    </div>
                  )}
                  {job.work_style && (
                    <div className="flex items-center gap-1.5">
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
                          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                        />
                      </svg>
                      {job.work_style}
                    </div>
                  )}
                </div>
              </section>

              {/* Description */}
              {job.description && (
                <section className="bg-white rounded-card p-6 border border-card-border">
                  <h2 className="text-lg font-bold mb-3">仕事内容</h2>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {job.description}
                  </p>
                </section>
              )}

              {/* Appeal */}
              {job.appeal && (
                <section className="bg-white rounded-card p-6 border border-card-border">
                  <h2 className="text-lg font-bold mb-3">
                    このポジションの魅力
                  </h2>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {job.appeal}
                  </p>
                </section>
              )}

              {/* Requirements */}
              {(mustReqs.length > 0 || wantReqs.length > 0) && (
                <section className="bg-white rounded-card p-6 border border-card-border">
                  <h2 className="text-lg font-bold mb-4">応募要件</h2>
                  {mustReqs.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded">
                          必須
                        </span>
                      </h3>
                      <ul className="space-y-2">
                        {mustReqs.map((r: any) => (
                          <li
                            key={r.id}
                            className="flex items-start gap-2 text-sm text-gray-600"
                          >
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                            {r.content}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {wantReqs.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">
                          歓迎
                        </span>
                      </h3>
                      <ul className="space-y-2">
                        {wantReqs.map((r: any) => (
                          <li
                            key={r.id}
                            className="flex items-start gap-2 text-sm text-gray-600"
                          >
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                            {r.content}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {/* Working Conditions */}
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">勤務条件</h2>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      label: "年収",
                      value:
                        job.salary_min || job.salary_max
                          ? `${job.salary_min || ""}〜${job.salary_max || ""}万円`
                          : null,
                    },
                    { label: "勤務地", value: job.location },
                    { label: "勤務スタイル", value: job.work_style },
                    { label: "雇用形態", value: job.employment_type },
                  ]
                    .filter((item) => item.value)
                    .map((item) => (
                      <div
                        key={item.label}
                        className="p-3 bg-gray-50 rounded-lg"
                      >
                        <p className="text-xs text-gray-400 mb-1">
                          {item.label}
                        </p>
                        <p className="text-sm font-medium">{item.value}</p>
                      </div>
                    ))}
                </div>
              </section>

              {/* Selection Process */}
              {selectionProcess && selectionProcess.length > 0 && (
                <section className="bg-white rounded-card p-6 border border-card-border">
                  <h2 className="text-lg font-bold mb-4">選考フロー</h2>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {selectionProcess.map((step: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg whitespace-nowrap">
                          <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="text-sm">
                            {typeof step === "string" ? step : step.name}
                          </span>
                        </div>
                        {i < selectionProcess.length - 1 && (
                          <svg
                            className="w-4 h-4 text-gray-300 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Sidebar */}
            <aside className="hidden lg:block w-[300px] flex-shrink-0 space-y-6">
              {/* Apply CTA */}
              <div className="bg-white rounded-card p-5 border border-card-border sticky top-24 space-y-3">
                <Link
                  href="/auth/signup"
                  className="block w-full py-3 bg-primary text-white text-sm font-medium rounded-full text-center hover:bg-primary-dark transition-colors"
                >
                  この求人に応募する
                </Link>
                <Link
                  href="/auth/signup"
                  className="block w-full py-3 border border-primary text-primary text-sm font-medium rounded-full text-center hover:bg-primary-light transition-colors"
                >
                  カジュアル面談を申し込む
                </Link>

                {/* Match Reasons (placeholder for logged-in users) */}
                <div className="mt-4 p-4 bg-primary-light rounded-lg">
                  <h3 className="text-sm font-bold text-primary mb-2">
                    おすすめの理由
                  </h3>
                  <p className="text-xs text-gray-500">
                    プロフィールを登録するとマッチ理由が表示されます
                  </p>
                </div>

                {/* Company Card */}
                {company && (
                  <Link
                    href={`/companies/${company.id}`}
                    className="block mt-4 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
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
                      <div>
                        <p className="text-sm font-medium">{company.name}</p>
                        <p className="text-xs text-gray-400">
                          {company.industry}
                        </p>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
