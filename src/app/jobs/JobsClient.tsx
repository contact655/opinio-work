"use client";

import Link from "next/link";
import { useState, useMemo } from "react";

// ─── Types ──────────────────────────────────────────

type Job = any;
type ViewMode = "list" | "grid";

// ─── Filter chips ───────────────────────────────────

const CATEGORY_CHIPS = ["すべて", "エンジニア", "営業", "カスタマーサクセス", "PdM", "マーケ"];
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
  if (filter === "エンジニア") return cat.includes("エンジニア");
  if (filter === "営業") return cat.includes("営業") || cat.includes("セールス");
  if (filter === "カスタマーサクセス") return cat.includes("カスタマー") || cat.includes("CS");
  if (filter === "PdM") return cat.includes("PdM") || cat.includes("プロダクト");
  if (filter === "マーケ") return cat.includes("マーケ");
  return cat === filter;
}

// Generate deterministic match score per job
function getMatchScore(jobId: string): number {
  let hash = 0;
  for (let i = 0; i < jobId.length; i++) {
    hash = ((hash << 5) - hash + jobId.charCodeAt(i)) | 0;
  }
  return 65 + Math.abs(hash % 30); // 65-94
}

const MATCH_REASONS = [
  "スキルセットが合致",
  "希望の勤務スタイル",
  "年収条件にマッチ",
  "業界経験を活かせる",
  "キャリアパスに合致",
  "カルチャーフィット",
  "成長環境が魅力的",
];

function getMatchReason(jobId: string): string {
  let hash = 0;
  for (let i = 0; i < jobId.length; i++) {
    hash = ((hash << 5) - hash + jobId.charCodeAt(i)) | 0;
  }
  return MATCH_REASONS[Math.abs(hash) % MATCH_REASONS.length];
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

  const filtered = useMemo(() => {
    let result = jobs;

    // Text search
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

    // Filters
    result = result.filter((j: Job) => matchesCategoryFilter(j, categoryFilter));
    result = result.filter((j: Job) => matchesStyleFilter(j, styleFilter));
    result = result.filter((j: Job) => matchesSalaryFilter(j, salaryFilter));

    // Sort
    if (sortBy === "salary") {
      result = [...result].sort(
        (a, b) => (b.salary_max || 0) - (a.salary_max || 0)
      );
    } else if (sortBy === "newest") {
      result = [...result].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else {
      // match score sort (default)
      result = [...result].sort(
        (a, b) => getMatchScore(b.id) - getMatchScore(a.id)
      );
    }

    return result;
  }, [jobs, query, categoryFilter, styleFilter, salaryFilter, sortBy]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="職種・勤務地・キーワードで検索"
          className="w-full px-6 py-3.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
        />
      </form>

      {/* Filter chips */}
      <div className="space-y-3 mb-6">
        {/* 職種 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-10 flex-shrink-0">職種</span>
          {CATEGORY_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setCategoryFilter(chip)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                categoryFilter === chip
                  ? "bg-[#1D9E75] text-white border-[#1D9E75]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* 勤務形態 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-10 flex-shrink-0">勤務</span>
          {STYLE_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setStyleFilter(chip)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                styleFilter === chip
                  ? "bg-[#1D9E75] text-white border-[#1D9E75]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* 年収 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-10 flex-shrink-0">年収</span>
          {SALARY_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setSalaryFilter(chip)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                salaryFilter === chip
                  ? "bg-[#1D9E75] text-white border-[#1D9E75]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar: count + sort + view toggle */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">
          {filtered.length}件の求人
        </p>
        <div className="flex items-center gap-3">
          {/* Sort */}
          <div className="flex gap-1.5">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSortBy(s.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  sortBy === s.value
                    ? "bg-[#1D9E75] text-white border-[#1D9E75]"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 ${viewMode === "list" ? "bg-gray-100" : "bg-white hover:bg-gray-50"}`}
              title="リスト表示"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke={viewMode === "list" ? "#1D9E75" : "#9ca3af"} strokeWidth={1.5}>
                <line x1="1" y1="3" x2="15" y2="3" />
                <line x1="1" y1="8" x2="15" y2="8" />
                <line x1="1" y1="13" x2="15" y2="13" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 ${viewMode === "grid" ? "bg-gray-100" : "bg-white hover:bg-gray-50"}`}
              title="グリッド表示"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke={viewMode === "grid" ? "#1D9E75" : "#9ca3af"} strokeWidth={1.5}>
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Jobs */}
      {filtered.length > 0 ? (
        viewMode === "list" ? (
          <div className="space-y-3">
            {filtered.map((j: Job) => (
              <JobCardList key={j.id} job={j} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((j: Job) => (
              <JobCardGrid key={j.id} job={j} />
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg mb-2">求人が見つかりませんでした</p>
          <p className="text-gray-400 text-sm">フィルターを変更してお試しください</p>
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
  const matchReason = getMatchReason(job.id);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-[#5DCAA5] transition-colors"
    >
      {/* Logo */}
      <div className="w-11 h-11 rounded-lg border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50">
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
              {job.salary_min || "?"}〜{job.salary_max || "?"}万
            </span>
          )}
          {job.location && (
            <span className="text-[10px] text-gray-400">{job.location}</span>
          )}
        </div>
      </div>

      {/* Match score */}
      <div className="flex-shrink-0 text-right w-[90px]">
        <div className="flex items-center gap-1.5 justify-end mb-1">
          <div
            className="rounded-full"
            style={{
              width: 72,
              height: 5,
              background: "#e5e7eb",
            }}
          >
            <div
              className="rounded-full h-full"
              style={{
                width: `${matchScore}%`,
                background: "#1D9E75",
              }}
            />
          </div>
          <span className="text-xs font-medium" style={{ color: "#1D9E75" }}>
            {matchScore}%
          </span>
        </div>
        <p className="text-[10px] text-gray-400 truncate">{matchReason}</p>
      </div>
    </Link>
  );
}

// ─── Grid Card ──────────────────────────────────────

function JobCardGrid({ job }: { job: Job }) {
  const company = job.ow_companies;
  const logoUrl = getLogoUrl(company);
  const matchScore = getMatchScore(job.id);
  const matchReason = getMatchReason(job.id);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-[#5DCAA5] transition-colors p-5"
    >
      {/* Company info */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50">
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
      </div>

      {/* Title */}
      <h3 className="font-medium text-[15px] leading-tight mb-2 line-clamp-2">
        {job.title}
      </h3>

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
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="rounded-full flex-1"
          style={{ height: 5, background: "#e5e7eb" }}
        >
          <div
            className="rounded-full h-full"
            style={{ width: `${matchScore}%`, background: "#1D9E75" }}
          />
        </div>
        <span className="text-xs font-medium" style={{ color: "#1D9E75" }}>
          {matchScore}%
        </span>
      </div>
      <p className="text-[10px] text-gray-400 truncate mb-3">{matchReason}</p>

      {/* Bottom row */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <div className="flex items-center gap-3">
          {(job.salary_min || job.salary_max) && (
            <span className="text-xs text-gray-600">
              {job.salary_min || "?"}〜{job.salary_max || "?"}万円
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
