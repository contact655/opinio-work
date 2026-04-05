"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { getMatchReason } from "@/lib/utils/matchReason";
import { formatSalaryRange } from "@/lib/utils/formatSalary";
import FavoriteJobButton from "@/components/FavoriteJobButton";

// ─── Types ──────────────────────────────────────────

type Job = any;
type ViewMode = "list" | "grid";

// ─── Constants ──────────────────────────────────────

const BUSINESS_ROLES = ["営業", "カスタマーサクセス", "マーケ", "インサイドセールス", "PdM", "事業開発", "CS", "セールス"];
const ENGINEER_ROLES = ["エンジニア", "デザイナー", "データサイエンティスト", "SRE", "開発"];

// フィルターチップ（ビジネス職中心）
const CATEGORY_CHIPS = ["すべて", "営業", "カスタマーサクセス", "インサイドセールス", "マーケ", "PdM", "事業開発"];
const STYLE_CHIPS = ["すべて", "フルリモート", "ハイブリッド", "オフィス出社"];
const SALARY_CHIPS = ["すべて", "600万〜", "800万〜", "1000万〜"];

const SORT_OPTIONS = [
  { value: "match", label: "マッチ度順" },
  { value: "newest", label: "新着順" },
  { value: "salary", label: "年収順" },
];

// ─── Helpers ────────────────────────────────────────

function getLogoUrl(company: any): string | null {
  if (!company) return null;
  if (company.logo_url) return company.logo_url;
  if (company.url) {
    try {
      return `https://logo.clearbit.com/${new URL(company.url).hostname}`;
    } catch {}
  }
  return null;
}

function workStyleLabel(ws: string | null): string {
  if (!ws) return "";
  if (ws.includes("フル") && ws.includes("リモート")) return "フルリモート";
  if (ws.includes("リモート")) return "リモート中心";
  if (ws === "remote") return "フルリモート";
  if (ws === "hybrid" || ws.includes("ハイブリッド")) return "ハイブリッド";
  if (ws === "office" || ws.includes("オフィス")) return "オフィス出社";
  return ws;
}

function matchesStyleFilter(job: Job, filter: string): boolean {
  if (filter === "すべて") return true;
  const label = workStyleLabel(job.work_style);
  if (filter === "フルリモート") return label.includes("リモート");
  if (filter === "ハイブリッド") return label === "ハイブリッド";
  if (filter === "オフィス出社") return label === "オフィス出社";
  return true;
}

function matchesSalaryFilter(job: Job, filter: string): boolean {
  if (filter === "すべて") return true;
  const max = job.salary_max || 0;
  if (filter === "600万〜") return max >= 600;
  if (filter === "800万〜") return max >= 800;
  if (filter === "1000万〜") return max >= 1000;
  return true;
}

function matchesCategoryFilter(job: Job, filter: string): boolean {
  if (filter === "すべて") return true;
  const cat = job.job_category || "";
  if (filter === "営業") return cat.includes("営業") || cat.includes("セールス");
  if (filter === "カスタマーサクセス") return cat.includes("カスタマー") || cat.includes("CS");
  if (filter === "インサイドセールス") return cat.includes("インサイド") || cat.includes("IS") || cat.includes("BDR");
  if (filter === "PdM") return cat.includes("PdM") || cat.includes("プロダクト");
  if (filter === "マーケ") return cat.includes("マーケ");
  if (filter === "事業開発") return cat.includes("事業開発") || cat.includes("BizDev");
  return cat === filter;
}

function isBusinessJob(job: Job): boolean {
  const cat = job.job_category || "";
  return BUSINESS_ROLES.some((r) => cat.includes(r));
}

function isEngineerJob(job: Job): boolean {
  const cat = job.job_category || "";
  return ENGINEER_ROLES.some((r) => cat.includes(r));
}

// Generate deterministic match score per job
function getMatchScore(jobId: string): number {
  let hash = 0;
  for (let i = 0; i < jobId.length; i++) {
    hash = ((hash << 5) - hash + jobId.charCodeAt(i)) | 0;
  }
  return 65 + Math.abs(hash % 30); // 65-94
}

function sortJobs(jobs: Job[], sortBy: string): Job[] {
  if (sortBy === "salary") {
    return [...jobs].sort((a, b) => (b.salary_max || 0) - (a.salary_max || 0));
  } else if (sortBy === "newest") {
    return [...jobs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } else {
    return [...jobs].sort((a, b) => getMatchScore(b.id) - getMatchScore(a.id));
  }
}

// ─── Component ──────────────────────────────────────

export default function JobsClient({
  jobs,
  initialParams,
}: {
  jobs: Job[];
  initialParams: Record<string, string | undefined>;
}) {
  const [query, setQuery] = useState(initialParams.q || "");
  const [categoryFilter, setCategoryFilter] = useState(initialParams.category || "すべて");
  const [styleFilter, setStyleFilter] = useState(initialParams.style || "すべて");
  const [salaryFilter, setSalaryFilter] = useState(initialParams.salary || "すべて");
  const [sortBy, setSortBy] = useState(initialParams.sort || "match");
  const [viewMode, setViewMode] = useState<ViewMode>((initialParams.view as ViewMode) || "list");
  const [showEngineer, setShowEngineer] = useState(false);

  // Filter base set
  const baseFiltered = useMemo(() => {
    let result = jobs;
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (j: Job) =>
          j.title?.toLowerCase().includes(q) ||
          j.job_category?.toLowerCase().includes(q) ||
          j.location?.toLowerCase().includes(q) ||
          j.description?.toLowerCase().includes(q) ||
          j.ow_companies?.name?.toLowerCase().includes(q)
      );
    }
    result = result.filter((j: Job) => matchesCategoryFilter(j, categoryFilter));
    result = result.filter((j: Job) => matchesStyleFilter(j, styleFilter));
    result = result.filter((j: Job) => matchesSalaryFilter(j, salaryFilter));
    return result;
  }, [jobs, query, categoryFilter, styleFilter, salaryFilter]);

  // Split business vs engineer
  const businessJobs = useMemo(() => {
    const biz = baseFiltered.filter((j) => isBusinessJob(j));
    return sortJobs(biz, sortBy);
  }, [baseFiltered, sortBy]);

  const engineerJobs = useMemo(() => {
    const eng = baseFiltered.filter((j) => isEngineerJob(j));
    // Also include jobs that are neither business nor engineer
    const other = baseFiltered.filter((j) => !isBusinessJob(j) && !isEngineerJob(j));
    return sortJobs([...eng, ...other], sortBy);
  }, [baseFiltered, sortBy]);

  const totalCount = businessJobs.length + engineerJobs.length;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="職種・勤務地・キーワードで検索"
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
          />
        </div>
      </form>

      {/* Filter chips */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-10 flex-shrink-0">職種</span>
          {CATEGORY_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setCategoryFilter(chip)}
              className="text-[12px] px-3 py-1.5 rounded-full transition-all whitespace-nowrap"
              style={
                categoryFilter === chip
                  ? { background: "#E1F5EE", border: "1px solid #5DCAA5", color: "#0F6E56", fontWeight: 600 }
                  : { background: "#fff", border: "1px solid #e5e7eb", color: "#6b7280" }
              }
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-10 flex-shrink-0">勤務</span>
          {STYLE_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setStyleFilter(chip)}
              className="text-[12px] px-3 py-1.5 rounded-full transition-all whitespace-nowrap"
              style={
                styleFilter === chip
                  ? { background: "#E1F5EE", border: "1px solid #5DCAA5", color: "#0F6E56", fontWeight: 600 }
                  : { background: "#fff", border: "1px solid #e5e7eb", color: "#6b7280" }
              }
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-10 flex-shrink-0">年収</span>
          {SALARY_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setSalaryFilter(chip)}
              className="text-[12px] px-3 py-1.5 rounded-full transition-all whitespace-nowrap"
              style={
                salaryFilter === chip
                  ? { background: "#E1F5EE", border: "1px solid #5DCAA5", color: "#0F6E56", fontWeight: 600 }
                  : { background: "#fff", border: "1px solid #e5e7eb", color: "#6b7280" }
              }
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-800">{totalCount}件</span>の求人
        </p>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSortBy(s.value)}
                className="text-[12px] px-3 py-1.5 rounded-full transition-all"
                style={
                  sortBy === s.value
                    ? { background: "#E1F5EE", border: "1px solid #5DCAA5", color: "#0F6E56", fontWeight: 600 }
                    : { background: "#fff", border: "1px solid #e5e7eb", color: "#6b7280" }
                }
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "0.5px solid #e5e7eb" }}>
            {(["list", "grid"] as const).map((mode, i) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="p-1.5 transition-colors"
                style={{
                  background: viewMode === mode ? "#E1F5EE" : "#fff",
                  borderLeft: i > 0 ? "0.5px solid #e5e7eb" : undefined,
                }}
                title={mode === "list" ? "リスト表示" : "グリッド表示"}
              >
                {mode === "list" ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={viewMode === "list" ? "#1D9E75" : "#9ca3af"} strokeWidth={1.5} strokeLinecap="round">
                    <line x1="1" y1="3" x2="15" y2="3" />
                    <line x1="1" y1="8" x2="15" y2="8" />
                    <line x1="1" y1="13" x2="15" y2="13" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={viewMode === "grid" ? "#1D9E75" : "#9ca3af"} strokeWidth={1.5} strokeLinecap="round">
                    <rect x="1" y="1" width="6" height="6" rx="1" />
                    <rect x="9" y="1" width="6" height="6" rx="1" />
                    <rect x="1" y="9" width="6" height="6" rx="1" />
                    <rect x="9" y="9" width="6" height="6" rx="1" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Results ─── */}
      {totalCount > 0 ? (
        <>
          {/* ビジネス職 */}
          {businessJobs.length > 0 && (
            <div>
              <p className="text-[12px] text-gray-400 mb-3">
                ビジネス職 {businessJobs.length}件
              </p>
              {viewMode === "list" ? (
                <div className="flex flex-col" style={{ gap: 10 }}>
                  {businessJobs.map((j: Job) => (
                    <JobCardList key={j.id} job={j} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {businessJobs.map((j: Job) => (
                    <JobCardGrid key={j.id} job={j} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* エンジニア・その他 */}
          {engineerJobs.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowEngineer((prev) => !prev)}
                className="flex items-center gap-2 text-[13px] text-gray-500 mb-3 hover:text-gray-700 transition-colors"
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                エンジニア・その他 {engineerJobs.length}件
                <svg
                  viewBox="0 0 14 14"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  style={{
                    transform: showEngineer ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                  }}
                >
                  <polyline points="2 4 7 9 12 4" />
                </svg>
              </button>
              {showEngineer && (
                viewMode === "list" ? (
                  <div className="flex flex-col" style={{ gap: 10 }}>
                    {engineerJobs.map((j: Job) => (
                      <JobCardList key={j.id} job={j} />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {engineerJobs.map((j: Job) => (
                      <JobCardGrid key={j.id} job={j} />
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-400 text-[14px] mb-2">求人が見つかりませんでした</p>
          <button
            onClick={() => {
              setQuery("");
              setCategoryFilter("すべて");
              setStyleFilter("すべて");
              setSalaryFilter("すべて");
            }}
            className="text-[13px] font-medium"
            style={{ color: "#1D9E75" }}
          >
            フィルターをクリア
          </button>
        </div>
      )}
    </div>
  );
}

// ─── List Card ──────────────────────────────────────

function JobCardList({ job }: { job: Job }) {
  const company = job.ow_companies;
  const logoUrl = getLogoUrl(company);
  const matchScore = getMatchScore(job.id);
  const matchReasonText = getMatchReason(job, matchScore);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex items-center gap-4 bg-white rounded-xl transition-colors"
      style={{ border: "0.5px solid #e5e7eb", padding: "16px 18px" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#5DCAA5")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
    >
      {/* Logo */}
      <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50" style={{ border: "0.5px solid #e5e7eb" }}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="w-full h-full object-contain p-1"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="text-sm font-bold text-gray-300">
            {company?.name?.[0] || "?"}
          </span>
        )}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-gray-400 mb-0.5">{company?.name || "企業名非公開"}</p>
        <h3 className="text-sm font-medium text-gray-800 truncate">{job.title}</h3>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {job.job_category && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#E1F5EE", color: "#0F6E56" }}>
              {job.job_category}
            </span>
          )}
          {job.work_style && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
              {workStyleLabel(job.work_style)}
            </span>
          )}
          {(job.salary_min || job.salary_max) && (
            <span className="text-[10px] text-gray-500">
              {formatSalaryRange(job.salary_min, job.salary_max)}
            </span>
          )}
          {job.location && (
            <span className="text-[10px] text-gray-400">{job.location}</span>
          )}
        </div>
      </div>

      {/* Match + Favorite */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-right w-[90px]">
          <div className="flex items-center gap-1.5 justify-end mb-1">
            <div className="rounded-full" style={{ width: 72, height: 5, background: "#e5e7eb" }}>
              <div className="rounded-full h-full" style={{ width: `${matchScore}%`, background: "#1D9E75" }} />
            </div>
            <span className="text-xs font-medium" style={{ color: "#1D9E75" }}>
              {matchScore}%
            </span>
          </div>
          <p className="text-[10px] text-gray-400 leading-relaxed" style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}>
            {matchReasonText}
          </p>
        </div>
        <FavoriteJobButton jobId={job.id} initialFavorited={false} />
      </div>
    </Link>
  );
}

// ─── Grid Card ──────────────────────────────────────

function JobCardGrid({ job }: { job: Job }) {
  const company = job.ow_companies;
  const logoUrl = getLogoUrl(company);
  const matchScore = getMatchScore(job.id);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block bg-white rounded-xl overflow-hidden transition-colors p-5"
      style={{ border: "0.5px solid #e5e7eb" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#5DCAA5")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
    >
      {/* Company info */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50" style={{ border: "0.5px solid #e5e7eb" }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="w-full h-full object-contain p-1"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span className="text-sm font-bold text-gray-300">
              {company?.name?.[0] || "?"}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 truncate">{company?.name || "企業名非公開"}</p>
        </div>
        <FavoriteJobButton jobId={job.id} initialFavorited={false} />
      </div>

      {/* Title */}
      <h3 className="font-medium text-[15px] leading-tight mb-2 line-clamp-2">{job.title}</h3>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {job.job_category && (
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#E1F5EE", color: "#0F6E56" }}>
            {job.job_category}
          </span>
        )}
        {job.work_style && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
            {workStyleLabel(job.work_style)}
          </span>
        )}
      </div>

      {/* Match bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="rounded-full flex-1" style={{ height: 5, background: "#e5e7eb" }}>
          <div className="rounded-full h-full" style={{ width: `${matchScore}%`, background: "#1D9E75" }} />
        </div>
        <span className="text-xs font-medium" style={{ color: "#1D9E75" }}>
          {matchScore}%
        </span>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between pt-3" style={{ borderTop: "0.5px solid #f0f0f0" }}>
        <div className="flex items-center gap-3">
          {(job.salary_min || job.salary_max) && (
            <span className="text-xs text-gray-600">
              {formatSalaryRange(job.salary_min, job.salary_max)}
            </span>
          )}
          {job.location && (
            <span className="text-[10px] text-gray-400">{job.location}</span>
          )}
        </div>
        <span className="text-xs font-medium" style={{ color: "#1D9E75" }}>
          詳細 →
        </span>
      </div>
    </Link>
  );
}
