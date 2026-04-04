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

export default function CompanyDashboardPage() {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
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

        if (!result.company) {
          router.push("/company/register");
          return;
        }

        setCompany(result.company);

        // 求人一覧を取得
        const jobsRes = await fetch(`/api/company/jobs?company_id=${result.company.id}`);
        if (jobsRes.ok) {
          const jobsData = await jobsRes.json();
          setJobs(jobsData.jobs || []);
        }
      } catch (err) {
        console.error("[company/dashboard] load error:", err);
        setError("通信エラーが発生しました");
      }
      setLoading(false);
    }
    load();
  }, [router]);

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

  if (!company) return null;

  const totalApplications = jobs.reduce((sum, j) => sum + (j.application_count || 0), 0);

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">{company.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  company.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}>
                  {company.status === "active" ? "公開中" : "審査中"}
                </span>
                {company.industry && (
                  <span className="text-sm text-gray-500">{company.industry}</span>
                )}
                {company.location && (
                  <span className="text-sm text-gray-500">{company.location}</span>
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
              <p className="text-3xl font-bold text-primary">{totalApplications}</p>
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
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
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
                  <div key={job.id} className="p-6 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <h3 className="font-medium">{job.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        応募 {job.application_count || 0}件
                        <span className="mx-2">|</span>
                        {new Date(job.created_at).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        job.status === "published"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {job.status === "published" ? "公開中" : "下書き"}
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
