"use client";

import Link from "next/link";
import { useState, useMemo, useEffect, useRef } from "react";

// ─── Types ──────────────────────────────────────────

type Company = any;

type Stat = { value: string; label: string; highlight?: boolean };

// ─── Constants ──────────────────────────────────────

const INDUSTRY_TAGS = [
  "すべて", "SaaS", "CRM", "HR Tech", "FinTech", "クラウド", "AI",
];
const CATEGORY_TAGS = ["すべて", "外資系", "日系", "スタートアップ"];
const ROLE_TAGS = ["すべて", "営業", "CS", "マーケ", "インサイドセールス"];

const SORT_OPTIONS = [
  { value: "jobs", label: "求人数順" },
  { value: "newest", label: "新着順" },
  { value: "employees", label: "社員数順" },
];

const GAISHI_KEYWORDS = [
  "Google", "Amazon", "Microsoft", "Salesforce", "Meta", "Apple",
  "Oracle", "SAP", "IBM", "Cisco", "Adobe",
];

const LOGO_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F97316",
  "#EC4899", "#14B8A6", "#6366F1", "#F43F5E",
];

// ─── Helpers ────────────────────────────────────────

function parseEmployeeCount(s: string | null): number {
  if (!s) return 0;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseFounded(s: string | null): number {
  if (!s) return 0;
  const m = s.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}

function isGaishi(c: Company): boolean {
  return GAISHI_KEYWORDS.some(
    (k) => c.name?.includes(k) || c.name_en?.includes(k)
  );
}

function isStartup(c: Company): boolean {
  const count = parseEmployeeCount(c.employee_count);
  const founded = parseFounded(c.founded_at);
  const currentYear = new Date().getFullYear();
  return (
    (founded > 0 && currentYear - founded <= 5) ||
    (count > 0 && count <= 50) ||
    ["シード", "シリーズA", "シリーズB", "early", "seed"].some(
      (p) => c.phase?.includes(p)
    )
  );
}

function isNew(c: Company): boolean {
  const created = new Date(c.created_at);
  const now = new Date();
  return now.getTime() - created.getTime() < 14 * 24 * 60 * 60 * 1000;
}

function getJobCategories(c: Company): string[] {
  const jobs = c.ow_jobs || [];
  const cats = new Set<string>();
  jobs.forEach((j: any) => {
    if (j.job_category) cats.add(j.job_category);
  });
  return Array.from(cats);
}

function getLogoColor(name: string): string {
  return LOGO_COLORS[name.charCodeAt(0) % LOGO_COLORS.length];
}

// ─── Auto Stats ─────────────────────────────────────

function getAutoStats(c: Company): Stat[] {
  const emp = parseEmployeeCount(c.employee_count);
  const founded = parseFounded(c.founded_at);
  const tags = c.ow_company_culture_tags || [];
  const remoteTag = tags.find(
    (t: any) =>
      t.tag_category === "work_style" &&
      (t.tag_value?.includes("リモート") || t.tag_value?.includes("remote"))
  );
  const currentYear = new Date().getFullYear();
  const isStartupCo =
    (founded > 0 && currentYear - founded <= 5) || (emp > 0 && emp <= 50);
  const isEnterprise = emp >= 500 || c.phase?.includes("上場");
  const isLifestyle = remoteTag != null;

  if (isStartupCo) {
    return [
      {
        value: c.phase || "成長中",
        label: "成長フェーズ",
      },
      {
        value: emp > 0 ? `${emp}名` : "非公開",
        label: "社員数",
      },
      {
        value: founded > 0 ? `${founded}年` : "非公開",
        label: "設立",
      },
    ];
  }

  if (isEnterprise) {
    return [
      {
        value: emp > 0 ? `${emp}名` : "非公開",
        label: "社員数(日本)",
      },
      {
        value: c.phase?.includes("上場") ? "上場" : "非上場",
        label: "上場市場",
      },
      {
        value: founded > 0 ? `${founded}年` : "非公開",
        label: "設立",
      },
    ];
  }

  if (isLifestyle) {
    return [
      {
        value: remoteTag?.tag_value || "リモートOK",
        label: "勤務スタイル",
        highlight: true,
      },
      {
        value: emp > 0 ? `${emp}名` : "非公開",
        label: "社員数",
      },
      {
        value: founded > 0 ? `${founded}年` : "非公開",
        label: "設立",
      },
    ];
  }

  return [
    {
      value: emp > 0 ? `${emp}名` : "非公開",
      label: "社員数(日本)",
    },
    {
      value: c.industry || "非公開",
      label: "業種",
    },
    {
      value: founded > 0 ? `${founded}年` : "非公開",
      label: "設立",
    },
  ];
}

// ─── Company Logo ───────────────────────────────────

function CompanyLogo({
  company,
  size = 44,
  rounded = 12,
}: {
  company: Company;
  size?: number;
  rounded?: number;
}) {
  const [imgError, setImgError] = useState(false);
  let clearbitUrl: string | null = null;
  if (company.url) {
    try {
      clearbitUrl = `https://logo.clearbit.com/${new URL(company.url).hostname}`;
    } catch {}
  }
  const logoUrl = company.logo_url || clearbitUrl;
  const color = getLogoColor(company.name);

  if (imgError || !logoUrl) {
    return (
      <div
        className="flex items-center justify-center text-white font-bold flex-shrink-0"
        style={{
          width: size,
          height: size,
          borderRadius: rounded,
          backgroundColor: color,
          fontSize: size * 0.38,
        }}
      >
        {company.name[0]}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={company.name}
      onError={() => setImgError(true)}
      className="object-cover flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        border: "0.5px solid #e5e7eb",
      }}
    />
  );
}

// ─── Tag Button ─────────────────────────────────────

function TagButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-[12px] px-3 py-1.5 rounded-md transition-all whitespace-nowrap"
      style={
        selected
          ? {
              background: "#E1F5EE",
              border: "0.5px solid #5DCAA5",
              color: "#0F6E56",
              fontWeight: 500,
            }
          : {
              background: "#fff",
              border: "0.5px solid #e5e7eb",
              color: "#6b7280",
            }
      }
    >
      {label}
    </button>
  );
}

// ─── List Card ──────────────────────────────────────

function ListCard({ company }: { company: Company }) {
  const jobCount = company.ow_jobs?.length || 0;
  const tags = company.ow_company_culture_tags || [];
  const topTags = tags.slice(0, 3);
  const stats = getAutoStats(company);
  const desc = company.description || company.mission || "";

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block bg-white rounded-xl p-5 transition-all group"
      style={{ border: "0.5px solid #e5e7eb" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = "#1D9E75")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "#e5e7eb")
      }
    >
      {/* Header row */}
      <div className="flex items-start gap-4">
        <CompanyLogo company={company} size={48} rounded={12} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-[14px] text-gray-800 truncate">
              {company.name}
            </h3>
            {isNew(company) && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: "#E1F5EE", color: "#0F6E56" }}
              >
                NEW
              </span>
            )}
            {jobCount > 0 && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: "#E6F1FB", color: "#185FA5" }}
              >
                採用中
              </span>
            )}
          </div>
          {desc && (
            <p className="text-[12px] text-gray-400 truncate leading-relaxed">
              {desc}
            </p>
          )}
        </div>
        {/* Job button */}
        <div className="flex-shrink-0 self-center">
          {jobCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors"
              style={{
                border: "0.5px solid #1D9E75",
                color: "#1D9E75",
              }}
            >
              求人 {jobCount}件
              <svg
                className="w-3 h-3"
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
            </span>
          ) : (
            <span className="text-[12px] text-gray-300">求人なし</span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-0 mt-3 -mx-1">
        {stats.map((s, i) => (
          <div
            key={i}
            className="flex-1 text-center px-1"
            style={
              i < stats.length - 1
                ? { borderRight: "0.5px solid #f0f0f0" }
                : {}
            }
          >
            <div
              className="text-[13px] font-semibold"
              style={{ color: s.highlight ? "#0F6E56" : "#374151" }}
            >
              {s.value}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tags row */}
      {topTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {topTags.map((t: any, i: number) => (
            <span
              key={i}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "#f5f5f4", color: "#78716c" }}
            >
              {t.tag_value}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

// ─── Grid Card ──────────────────────────────────────

function GridCard({ company }: { company: Company }) {
  const jobCount = company.ow_jobs?.length || 0;
  const tags = company.ow_company_culture_tags || [];
  const topTags = tags.slice(0, 2);
  const stats = getAutoStats(company);
  const color = getLogoColor(company.name);

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block bg-white rounded-xl overflow-hidden transition-all group"
      style={{ border: "0.5px solid #e5e7eb" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = "#1D9E75")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "#e5e7eb")
      }
    >
      {/* Cover */}
      <div
        className="h-[56px] relative"
        style={{ background: `${color}20` }}
      >
        {/* Logo overlapping */}
        <div
          className="absolute -bottom-5 left-4"
          style={{
            border: "2px solid #fff",
            borderRadius: 14,
            background: "#fff",
          }}
        >
          <CompanyLogo company={company} size={44} rounded={12} />
        </div>
      </div>

      {/* Body */}
      <div className="pt-7 px-4 pb-4">
        {/* Name + badges */}
        <div className="flex items-center gap-1.5 mb-1">
          <h3 className="font-semibold text-[13px] text-gray-800 truncate">
            {company.name}
          </h3>
          {isNew(company) && (
            <span
              className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0"
              style={{ background: "#E1F5EE", color: "#0F6E56" }}
            >
              NEW
            </span>
          )}
        </div>

        {/* Industry / category */}
        <div className="flex items-center gap-2 mb-2.5">
          {company.industry && (
            <span className="text-[11px] text-gray-400">{company.industry}</span>
          )}
          {company.phase && (
            <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
              {company.phase}
            </span>
          )}
        </div>

        {/* Tags */}
        {topTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {topTags.map((t: any, i: number) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: "#f5f5f4", color: "#78716c" }}
              >
                {t.tag_value}
              </span>
            ))}
          </div>
        )}

        {/* Stats grid */}
        <div
          className="grid grid-cols-3 gap-0 py-2.5 mb-3"
          style={{
            borderTop: "0.5px solid #f0f0f0",
            borderBottom: "0.5px solid #f0f0f0",
          }}
        >
          {stats.map((s, i) => (
            <div
              key={i}
              className="text-center"
              style={
                i < stats.length - 1
                  ? { borderRight: "0.5px solid #f0f0f0" }
                  : {}
              }
            >
              <div
                className="text-[12px] font-semibold"
                style={{ color: s.highlight ? "#0F6E56" : "#374151" }}
              >
                {s.value}
              </div>
              <div className="text-[9px] text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Job count footer */}
        <div className="flex justify-center">
          {jobCount > 0 ? (
            <span
              className="text-[11px] font-medium px-3 py-1.5 rounded-md w-full text-center"
              style={{
                background: "#E1F5EE",
                color: "#0F6E56",
              }}
            >
              求人 {jobCount}件を見る
            </span>
          ) : (
            <span className="text-[11px] text-gray-300 py-1.5">
              現在求人なし
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── View Toggle Icons ──────────────────────────────

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke={active ? "#1D9E75" : "#9ca3af"}
      strokeWidth="1.5"
    >
      <rect x="1" y="2" width="16" height="3" rx="1" />
      <rect x="1" y="7.5" width="16" height="3" rx="1" />
      <rect x="1" y="13" width="16" height="3" rx="1" />
    </svg>
  );
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke={active ? "#1D9E75" : "#9ca3af"}
      strokeWidth="1.5"
    >
      <rect x="1" y="1" width="7" height="7" rx="1.5" />
      <rect x="10" y="1" width="7" height="7" rx="1.5" />
      <rect x="1" y="10" width="7" height="7" rx="1.5" />
      <rect x="10" y="10" width="7" height="7" rx="1.5" />
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────

export default function CompanyExplorer({
  companies,
}: {
  companies: Company[];
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [industry, setIndustry] = useState("すべて");
  const [category, setCategory] = useState("すべて");
  const [role, setRole] = useState("すべて");
  const [sort, setSort] = useState("jobs");
  const [view, setView] = useState<"list" | "grid">("list");
  const debounceRef = useRef<NodeJS.Timeout>();

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Filter & sort
  const filtered = useMemo(() => {
    return companies
      .filter((c) => {
        // Search
        if (debouncedQuery) {
          const q = debouncedQuery.toLowerCase();
          const text =
            `${c.name} ${c.description || ""} ${c.industry || ""}`.toLowerCase();
          if (!text.includes(q)) return false;
        }

        // Industry
        if (industry !== "すべて") {
          if (!c.industry?.includes(industry)) return false;
        }

        // Category
        if (category !== "すべて") {
          if (category === "外資系" && !isGaishi(c)) return false;
          if (category === "日系" && isGaishi(c)) return false;
          if (category === "スタートアップ" && !isStartup(c)) return false;
        }

        // Role (job category)
        if (role !== "すべて") {
          const cats = getJobCategories(c);
          const hasRole = cats.some((cat) => cat.includes(role));
          if (!hasRole) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sort === "jobs") {
          return (b.ow_jobs?.length || 0) - (a.ow_jobs?.length || 0);
        }
        if (sort === "newest") {
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        if (sort === "employees") {
          return parseEmployeeCount(b.employee_count) - parseEmployeeCount(a.employee_count);
        }
        return 0;
      });
  }, [companies, debouncedQuery, industry, category, role, sort]);

  return (
    <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* ─── Search Bar ─── */}
      <div className="mb-5">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="企業名・業界・キーワードで検索"
            className="w-full pl-12 pr-4 py-3 bg-[#FAFAF9] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:bg-white transition-colors"
            style={{ border: "0.5px solid #e5e7eb" }}
          />
        </div>
      </div>

      {/* ─── Filter Tags ─── */}
      <div className="space-y-3 mb-5">
        {/* Industry */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 font-medium w-10 flex-shrink-0">
            業界
          </span>
          <div className="flex flex-wrap gap-1.5">
            {INDUSTRY_TAGS.map((tag) => (
              <TagButton
                key={tag}
                label={tag}
                selected={industry === tag}
                onClick={() => setIndustry(tag)}
              />
            ))}
          </div>
        </div>

        {/* Category */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 font-medium w-10 flex-shrink-0">
            分類
          </span>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_TAGS.map((tag) => (
              <TagButton
                key={tag}
                label={tag}
                selected={category === tag}
                onClick={() => setCategory(tag)}
              />
            ))}
          </div>
        </div>

        {/* Role */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 font-medium w-10 flex-shrink-0">
            職種
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_TAGS.map((tag) => (
              <TagButton
                key={tag}
                label={tag}
                selected={role === tag}
                onClick={() => setRole(tag)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ─── Toolbar: count + sort + view ─── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-gray-500">
          <span className="font-semibold text-gray-800">{filtered.length}社</span>
          を表示中
        </p>
        <div className="flex items-center gap-3">
          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-[12px] text-gray-500 bg-transparent outline-none cursor-pointer pr-1"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* View toggle */}
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ border: "0.5px solid #e5e7eb" }}
          >
            <button
              onClick={() => setView("list")}
              className="p-1.5 transition-colors"
              style={{
                background: view === "list" ? "#E1F5EE" : "#fff",
              }}
            >
              <ListIcon active={view === "list"} />
            </button>
            <button
              onClick={() => setView("grid")}
              className="p-1.5 transition-colors"
              style={{
                background: view === "grid" ? "#E1F5EE" : "#fff",
                borderLeft: "0.5px solid #e5e7eb",
              }}
            >
              <GridIcon active={view === "grid"} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Results ─── */}
      {filtered.length > 0 ? (
        view === "list" ? (
          <div className="space-y-3">
            {filtered.map((c) => (
              <ListCard key={c.id} company={c} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <GridCard key={c.id} company={c} />
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-400 text-[14px] mb-2">
            該当する企業が見つかりませんでした
          </p>
          <button
            onClick={() => {
              setQuery("");
              setIndustry("すべて");
              setCategory("すべて");
              setRole("すべて");
            }}
            className="text-[13px] font-medium transition-colors"
            style={{ color: "#1D9E75" }}
          >
            フィルターをクリア
          </button>
        </div>
      )}
    </div>
  );
}
