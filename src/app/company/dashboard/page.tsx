"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";

type Company = {
  id: string;
  name: string;
  status: string;
  logo_url: string | null;
  url: string | null;
  industry: string | null;
  location: string | null;
  plan: string | null;
  created_at: string;
};

type Job = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  application_count: number;
};

function getLogoUrl(company: Company): string | null {
  if (company.logo_url) return company.logo_url;
  if (company.url) {
    try {
      return `https://www.google.com/s2/favicons?domain=${new URL(company.url).hostname}&sz=128`;
    } catch {}
  }
  return null;
}

export default function CompanyDashboardPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/company/me");
        const result = await res.json();

        if (res.status === 401) {
          router.push("/auth/login?redirect=/company/dashboard");
          return;
        }

        if (!res.ok) {
          setError(result.error || "データの取得に失敗しました");
          setLoading(false);
          return;
        }

        // Handle both single company (old API) and multiple companies (new API)
        const companyList: Company[] = result.companies
          ? result.companies
          : result.company
          ? [result.company]
          : [];

        if (companyList.length === 0) {
          router.push("/company/register");
          return;
        }

        setCompanies(companyList);

        // Auto-select if only 1 company
        if (companyList.length === 1) {
          setSelectedCompany(companyList[0]);
          await loadJobs(companyList[0].id);
        }
      } catch (err) {
        console.error("[company/dashboard] load error:", err);
        setError("通信エラーが発生しました");
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function loadJobs(companyId: string) {
    const jobsRes = await fetch(`/api/company/jobs?company_id=${companyId}`);
    if (jobsRes.ok) {
      const jobsData = await jobsRes.json();
      setJobs(jobsData.jobs || []);
    }
  }

  async function selectCompany(company: Company) {
    setSelectedCompany(company);
    setJobs([]);
    await loadJobs(company.id);
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen bg-background flex items-center justify-center">
          <p className="text-gray-400">読み込み中...</p>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Link href="/company/register" className="text-primary hover:underline">
              企業登録はこちら
            </Link>
          </div>
        </main>
      </>
    );
  }

  // ── 企業選択画面（複数企業の場合） ──
  if (companies.length > 1 && !selectedCompany) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen bg-background">
          <div className="max-w-md mx-auto px-4 py-16">
            <h1 className="text-lg font-bold mb-2">管理する企業を選択</h1>
            <p className="text-sm text-gray-500 mb-6">
              複数の企業が登録されています。管理する企業を選んでください。
            </p>
            <div className="space-y-3">
              {companies.map((c) => {
                const logo = getLogoUrl(c);
                return (
                  <button
                    key={c.id}
                    onClick={() => selectCompany(c)}
                    className="w-full flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-[#1D9E75] transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-gray-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {logo ? (
                        <img
                          src={logo}
                          alt=""
                          className="w-full h-full object-contain p-1"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-gray-400 text-xs font-bold">
                          {c.name[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{c.name}</div>
                      <div className="text-xs text-gray-400">
                        {c.industry || "業種未設定"}
                      </div>
                    </div>
                    <span className="text-[#1D9E75] text-sm flex-shrink-0">
                      管理する →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </main>
      </>
    );
  }

  const company = selectedCompany!;
  const totalApplications = jobs.reduce(
    (sum, j) => sum + (j.application_count || 0),
    0
  );

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Back to company select (if multiple) */}
          {companies.length > 1 && (
            <button
              onClick={() => setSelectedCompany(null)}
              className="text-sm text-gray-500 hover:text-primary mb-4 flex items-center gap-1 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              企業一覧に戻る
            </button>
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">{company.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span
                  className={`px-2 py-0.5 text-xs rounded-full ${
                    company.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {company.status === "active" ? "公開中" : "審査中"}
                </span>
                {company.industry && (
                  <span className="text-sm text-gray-500">
                    {company.industry}
                  </span>
                )}
                {company.location && (
                  <span className="text-sm text-gray-500">
                    {company.location}
                  </span>
                )}
              </div>
            </div>
            <Link
              href="/company/edit"
              className="px-4 py-2 border border-gray-300 text-sm rounded-full hover:bg-gray-50 transition-colors"
            >
              企業情報を編集
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-card-lg border border-card-border p-6 text-center">
              <p className="text-3xl font-bold text-primary">{jobs.length}</p>
              <p className="text-sm text-gray-500 mt-1">掲載中の求人</p>
            </div>
            <div className="bg-white rounded-card-lg border border-card-border p-6 text-center">
              <p className="text-3xl font-bold text-primary">
                {totalApplications}
              </p>
              <p className="text-sm text-gray-500 mt-1">応募者数</p>
            </div>
            <div className="bg-white rounded-card-lg border border-card-border p-6 text-center">
              <p className="text-3xl font-bold text-gray-400">
                {company.plan === "standard" ? "Standard" : "Free"}
              </p>
              <p className="text-sm text-gray-500 mt-1">プラン</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-8">
            <Link
              href="/company/jobs/new"
              className="px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary-dark transition-colors"
            >
              + 新しい求人を作成
            </Link>
            <Link
              href="/company/edit"
              className="px-6 py-2.5 border border-primary text-primary text-sm font-medium rounded-full hover:bg-primary-light transition-colors"
            >
              企業プロフィールを編集
            </Link>
          </div>

          {/* Job List */}
          <div className="bg-white rounded-card-lg border border-card-border">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold">求人一覧</h2>
            </div>
            {jobs.length === 0 ? (
              <div className="p-12 text-center">
                <svg
                  className="w-12 h-12 text-gray-300 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
                <p className="text-gray-400 mb-4">まだ求人がありません</p>
                <Link
                  href="/company/jobs/new"
                  className="px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary-dark"
                >
                  最初の求人を作成する
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-6 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div>
                      <h3 className="font-medium">{job.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        応募 {job.application_count || 0}件
                        <span className="mx-2">|</span>
                        {new Date(job.created_at).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          job.status === "active" || job.status === "published"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {job.status === "active" || job.status === "published"
                          ? "公開中"
                          : "下書き"}
                      </span>
                      <Link
                        href={`/company/jobs/${job.id}/edit`}
                        className="text-sm text-primary hover:underline"
                      >
                        編集
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
