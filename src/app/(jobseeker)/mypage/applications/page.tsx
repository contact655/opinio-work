"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";

type Application = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  ow_jobs: {
    id: string;
    title: string;
    job_category: string | null;
    salary_min: number | null;
    salary_max: number | null;
    location: string | null;
    ow_companies: {
      id: string;
      name: string;
      logo_url: string | null;
      ow_company_office_photos: { image_url: string; caption: string | null }[];
    };
  };
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  applied: { label: "応募済み", color: "text-blue-600", bgColor: "bg-blue-100" },
  doc_review: { label: "書類選考中", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  interview1: { label: "1次面接", color: "text-purple-600", bgColor: "bg-purple-100" },
  interview_final: { label: "最終面接", color: "text-indigo-600", bgColor: "bg-indigo-100" },
  offered: { label: "内定", color: "text-primary", bgColor: "bg-primary-light" },
  accepted: { label: "内定承諾", color: "text-green-700", bgColor: "bg-green-100" },
  rejected: { label: "不合格", color: "text-gray-500", bgColor: "bg-gray-100" },
};

const PROCESS_STEPS = ["応募", "書類選考", "1次面接", "最終面接", "内定"];

const STATUS_TO_STEP: Record<string, number> = {
  applied: 0,
  doc_review: 1,
  interview1: 2,
  interview_final: 3,
  offered: 4,
  accepted: 4,
  rejected: -1,
};

const FILTER_TABS = [
  { key: "all", label: "すべて" },
  { key: "doc_review", label: "書類選考中" },
  { key: "interview", label: "面接中" },
  { key: "offered", label: "内定" },
];

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: owUser } = await supabase
      .from("ow_users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!owUser) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("ow_job_applications")
      .select(
        `*,
        ow_jobs(id, title, job_category, salary_min, salary_max, location,
          ow_companies(id, name, logo_url,
            ow_company_office_photos(image_url, caption)
          )
        )`
      )
      .eq("user_id", owUser.id)
      .order("created_at", { ascending: false });

    setApplications((data as Application[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = applications.filter((a) => {
    if (activeFilter === "doc_review") return a.status === "doc_review";
    if (activeFilter === "interview")
      return ["interview1", "interview_final"].includes(a.status);
    if (activeFilter === "offered")
      return ["offered", "accepted"].includes(a.status);
    return true;
  });

  // Summary counts
  const counts = {
    doc_review: applications.filter((a) => a.status === "doc_review").length,
    interview: applications.filter((a) =>
      ["interview1", "interview_final"].includes(a.status)
    ).length,
    offered: applications.filter((a) =>
      ["offered", "accepted"].includes(a.status)
    ).length,
    total: applications.length,
  };

  if (loading) {
    return (
      <MypageLayout activeKey="applications">
        <h1 style={{
          fontFamily: '"Noto Serif JP", serif', fontSize: 22, fontWeight: 700,
          color: "var(--ink)", marginBottom: 24,
        }}>応募管理</h1>
        {/* Skeleton summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map((i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 12 }} />
          ))}
        </div>
        {/* Skeleton application cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1,2,3].map((i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 140, borderRadius: 16 }} />
          ))}
        </div>
      </MypageLayout>
    );
  }

  return (
    <MypageLayout activeKey="applications">
      <div>
      <h1 style={{
        fontFamily: '"Noto Serif JP", serif', fontSize: 22, fontWeight: 700,
        color: "var(--ink)", marginBottom: 24,
      }}>応募管理</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                {
                  label: "書類選考中",
                  count: counts.doc_review,
                  color: "text-yellow-600",
                },
                {
                  label: "面接中",
                  count: counts.interview,
                  color: "text-purple-600",
                },
                {
                  label: "内定",
                  count: counts.offered,
                  color: "text-primary",
                },
                {
                  label: "応募済み",
                  count: counts.total,
                  color: "text-gray-600",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="bg-white rounded-card p-4 border border-card-border text-center"
                >
                  <p className={`text-2xl font-bold ${card.color}`}>
                    {card.count}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{card.label}</p>
                </div>
              ))}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6" role="tablist" aria-label="応募ステータスで絞り込み">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeFilter === tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-4 py-2 text-sm rounded-full border transition-colors ${
                    activeFilter === tab.key
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-600 border-card-border hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Application List */}
            {filtered.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "64px 24px",
                background: "#fff", borderRadius: 16, border: "1px solid var(--line)",
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "var(--royal-50)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="9" y1="13" x2="15" y2="13"/>
                    <line x1="9" y1="17" x2="12" y2="17"/>
                  </svg>
                </div>
                <p style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                  まだ応募がありません
                </p>
                <p style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 24, lineHeight: 1.7 }}>
                  気になる企業にカジュアル面談や求人応募をしてみましょう
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <Link
                    href="/companies"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: "var(--royal)", color: "#fff", textDecoration: "none",
                    }}
                  >
                    企業を探す →
                  </Link>
                  <Link
                    href="/jobs"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      border: "1px solid var(--line)", color: "var(--ink-soft)", textDecoration: "none", background: "#fff",
                    }}
                  >
                    求人を見る
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((app) => {
                  const job = app.ow_jobs;
                  const company = job?.ow_companies;
                  const photos = company?.ow_company_office_photos || [];
                  const statusConf =
                    STATUS_CONFIG[app.status] || STATUS_CONFIG.applied;
                  const currentStep = STATUS_TO_STEP[app.status] ?? 0;

                  return (
                    <div
                      key={app.id}
                      className="bg-white rounded-card border border-card-border overflow-hidden"
                    >
                      <div className="flex">
                        {/* Left photo */}
                        <div className="w-[100px] flex-shrink-0">
                          {photos.length > 0 ? (
                            <div
                              className="w-full h-full bg-gray-200 bg-cover bg-center min-h-[140px]"
                              style={{
                                backgroundImage: `url(${photos[0].image_url})`,
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center min-h-[140px]">
                              <span className="text-2xl font-bold text-gray-500">
                                {company?.name?.[0]}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <Link
                                href={`/jobs/${job?.id}`}
                                className="font-medium hover:text-primary transition-colors"
                              >
                                {job?.title}
                              </Link>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {company?.name}
                              </p>
                            </div>
                            <span
                              className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${statusConf.bgColor} ${statusConf.color}`}
                            >
                              {statusConf.label}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          {app.status !== "rejected" && (
                            <div className="flex items-center gap-1 my-3">
                              {PROCESS_STEPS.map((step, i) => (
                                <div key={step} className="flex items-center flex-1">
                                  <div className="flex flex-col items-center flex-1">
                                    <div
                                      className={`w-full h-1 rounded-full ${
                                        i <= currentStep
                                          ? "bg-primary"
                                          : "bg-gray-200"
                                      }`}
                                    />
                                    <span
                                      className={`text-[10px] mt-1 ${
                                        i <= currentStep
                                          ? "text-primary font-medium"
                                          : "text-gray-600"
                                      }`}
                                    >
                                      {step}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Footer */}
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <span>
                              応募日:{" "}
                              {new Date(app.created_at).toLocaleDateString(
                                "ja-JP"
                              )}
                            </span>
                            {app.status === "offered" && (
                              <span className="text-red-500 font-medium">
                                要返答
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
      )}
      </div>
    </MypageLayout>
  );
}
