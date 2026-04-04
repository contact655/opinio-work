import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

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

export default async function CompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const company = await getCompany(params.id);
  if (!company) return notFound();

  const photos = company.ow_company_photos || [];
  const members = company.ow_company_members || [];
  const cultureTags = company.ow_company_culture_tags || [];
  const jobs = (company.ow_jobs || []).filter(
    (j: any) => j.status === "active"
  );

  const workStyleTags = cultureTags.filter(
    (t: any) => t.tag_category === "work_style"
  );
  const cultureCatTags = cultureTags.filter(
    (t: any) => t.tag_category === "culture"
  );
  const benefitTags = cultureTags.filter(
    (t: any) => t.tag_category === "benefits"
  );

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        {/* Hero */}
        <div className="relative h-80">
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 h-full">
              {photos.slice(0, 3).map((p: any, i: number) => (
                <div
                  key={i}
                  className="bg-gray-300 bg-cover bg-center"
                  style={{ backgroundImage: `url(${p.photo_url})` }}
                />
              ))}
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-primary to-teal-500 flex items-center justify-center">
              <span className="text-white text-6xl font-bold">
                {company.name[0]}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        {/* Profile Band */}
        <div className="bg-white border-b border-card-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl border-2 border-white shadow-lg overflow-hidden bg-gray-100 flex items-center justify-center -mt-12 relative z-10">
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
                <h1 className="text-xl font-bold">{company.name}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  {company.industry && <span>{company.industry}</span>}
                  {company.location && <span>{company.location}</span>}
                  {company.employee_count && (
                    <span>{company.employee_count}名</span>
                  )}
                </div>
              </div>
              <Link
                href="#jobs"
                className="px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary-dark transition-colors"
              >
                求人を見る
              </Link>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-8">
            {/* Main Column */}
            <div className="flex-1 space-y-8">
              {/* Mission */}
              {(company.mission || company.description) && (
                <section className="bg-white rounded-card p-6 border border-card-border">
                  <h2 className="text-lg font-bold mb-4">企業について</h2>
                  {company.mission && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-500 mb-2">
                        ミッション
                      </h3>
                      <p className="text-lg font-medium">{company.mission}</p>
                    </div>
                  )}
                  {company.description && (
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {company.description}
                    </p>
                  )}
                </section>
              )}

              {/* Members */}
              {members.length > 0 && (
                <section className="bg-white rounded-card p-6 border border-card-border">
                  <h2 className="text-lg font-bold mb-4">メンバー</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {members.map((m: any) => (
                      <div
                        key={m.id}
                        className="text-center p-4 rounded-lg border border-gray-100"
                      >
                        <div className="w-20 h-20 rounded-full bg-gray-200 mx-auto mb-3 overflow-hidden">
                          {m.photo_url ? (
                            <img
                              src={m.photo_url}
                              alt={m.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl font-bold">
                              {m.name?.[0]}
                            </div>
                          )}
                        </div>
                        <p className="font-medium text-sm">{m.name}</p>
                        <p className="text-xs text-gray-500">{m.role}</p>
                        {m.background && (
                          <p className="text-xs text-gray-400 mt-1">
                            前職: {m.background}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Culture */}
              {cultureTags.length > 0 && (
                <section className="bg-white rounded-card p-6 border border-card-border">
                  <h2 className="text-lg font-bold mb-4">カルチャー・働き方</h2>
                  {workStyleTags.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-500 mb-2">
                        働き方
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {workStyleTags.map((t: any) => (
                          <span
                            key={t.id}
                            className="px-3 py-1 bg-primary-light text-primary text-xs rounded-full"
                          >
                            {t.tag_value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {cultureCatTags.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-500 mb-2">
                        組織文化
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {cultureCatTags.map((t: any) => (
                          <span
                            key={t.id}
                            className="px-3 py-1 bg-blue-50 text-blue-600 text-xs rounded-full"
                          >
                            {t.tag_value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {benefitTags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 mb-2">
                        福利厚生
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {benefitTags.map((t: any) => (
                          <span
                            key={t.id}
                            className="px-3 py-1 bg-orange-50 text-orange-600 text-xs rounded-full"
                          >
                            {t.tag_value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Jobs */}
              <section
                id="jobs"
                className="bg-white rounded-card p-6 border border-card-border"
              >
                <h2 className="text-lg font-bold mb-4">
                  求人一覧（{jobs.length}件）
                </h2>
                {jobs.length > 0 ? (
                  <div className="space-y-3">
                    {jobs.map((j: any) => (
                      <Link
                        key={j.id}
                        href={`/jobs/${j.id}`}
                        className="block p-4 rounded-lg border border-gray-100 hover:border-primary/30 hover:bg-primary-light/30 transition-colors"
                      >
                        <h3 className="font-medium mb-1">{j.title}</h3>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                          {j.job_category && (
                            <span className="px-2 py-0.5 bg-gray-100 rounded">
                              {j.job_category}
                            </span>
                          )}
                          {j.salary_min && j.salary_max && (
                            <span>
                              {j.salary_min}〜{j.salary_max}万円
                            </span>
                          )}
                          {j.location && <span>{j.location}</span>}
                          {j.work_style && <span>{j.work_style}</span>}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    現在募集中の求人はありません
                  </p>
                )}
              </section>
            </div>

            {/* Sidebar */}
            <aside className="hidden lg:block w-[300px] flex-shrink-0 space-y-6">
              <div className="bg-white rounded-card p-5 border border-card-border sticky top-24">
                <h3 className="text-sm font-bold mb-3">企業情報</h3>
                <dl className="space-y-2 text-sm">
                  {[
                    { label: "設立", value: company.founded_at },
                    { label: "従業員数", value: company.employee_count },
                    { label: "業界", value: company.industry },
                    { label: "所在地", value: company.location },
                    { label: "フェーズ", value: company.phase },
                  ]
                    .filter((item) => item.value)
                    .map((item) => (
                      <div key={item.label} className="flex justify-between">
                        <dt className="text-gray-400">{item.label}</dt>
                        <dd className="font-medium">{item.value}</dd>
                      </div>
                    ))}
                  {company.url && (
                    <div className="flex justify-between">
                      <dt className="text-gray-400">URL</dt>
                      <dd>
                        <a
                          href={company.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs"
                        >
                          公式サイト →
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-6 pt-4 border-t border-gray-100">
                  <Link
                    href="/auth/signup"
                    className="block w-full py-2.5 bg-primary text-white text-sm font-medium rounded-full text-center hover:bg-primary-dark transition-colors"
                  >
                    無料登録して応募する
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
