"use client";

import Link from "next/link";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FavoriteButton from "@/components/FavoriteButton";
import {
  parseEmployeeCount,
  isGaishi,
  isStartup,
  isListed,
  checkIsNew,
  checkIsFeatured,
  getJobCategories,
  getAutoStats,
} from "@/lib/utils/companyStats";

// ─── Types ──────────────────────────────────────────

type Company = any;
type ViewMode = "list" | "grid" | "grid5" | "section";

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

const LOGO_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F97316",
  "#EC4899", "#14B8A6", "#6366F1", "#F43F5E",
];

// ─── Helpers ────────────────────────────────────────

function getLogoColor(name: string): string {
  return LOGO_COLORS[name.charCodeAt(0) % LOGO_COLORS.length];
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

// ─── Badge Component ────────────────────────────────

function CompanyBadges({ company }: { company: Company }) {
  const showNew = checkIsNew(company);
  const showFeatured = checkIsFeatured(company);
  const jobCount = company.ow_jobs?.length || 0;

  return (
    <>
      {showNew && (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: "#E6F1FB", color: "#185FA5" }}
        >
          NEW
        </span>
      )}
      {showFeatured && !showNew && (
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: "#FAEEDA", color: "#854F0B" }}
        >
          注目
        </span>
      )}
      {jobCount > 0 && (
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: "#E6F1FB", color: "#185FA5" }}
        >
          採用中
        </span>
      )}
    </>
  );
}

// ─── Match Score Bar ────────────────────────────────

function MatchScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5 mt-2">
      <div className="flex-1 h-1 rounded-full bg-gray-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: "#1D9E75" }}
        />
      </div>
      <span className="text-[10px] font-medium" style={{ color: "#1D9E75" }}>
        {score}%マッチ
      </span>
    </div>
  );
}

// ─── 修正1: Description Ellipsis helper ─────────────

const descStyle: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical" as const,
  overflow: "hidden",
};

// ─── List Card ──────────────────────────────────────

function ListCard({
  company,
  isSaved,
  matchScore,
}: {
  company: Company;
  isSaved: boolean;
  matchScore?: number;
}) {
  const jobCount = company.ow_jobs?.length || 0;
  const tags = company.ow_company_culture_tags || [];
  const topTags = tags.slice(0, 3);
  const stats = getAutoStats(company);
  const desc = company.description || company.mission || "";

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block bg-white rounded-xl transition-all group"
      style={{ border: "0.5px solid #e5e7eb", padding: "16px 18px" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1D9E75")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
    >
      <div className="flex items-start gap-4">
        <CompanyLogo company={company} size={56} rounded={12} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="font-medium text-[16px] text-gray-800 truncate">
              {company.name}
            </h3>
            <CompanyBadges company={company} />
          </div>
          {desc && (
            <p
              className="text-[13px] text-gray-400 leading-relaxed"
              style={descStyle}
            >
              {desc}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 self-center">
          <FavoriteButton companyId={company.id} initialFavorited={isSaved} />
          {jobCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md"
              style={{ border: "0.5px solid #5DCAA5", background: "#E1F5EE", color: "#0F6E56" }}
            >
              求人 {jobCount}件
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          ) : (
            <span className="text-[12px] text-gray-300">求人なし</span>
          )}
        </div>
      </div>

      <div className="flex mt-3" style={{ gap: 24 }}>
        {stats.map((s, i) => (
          <div key={i} className="flex flex-col" style={{ gap: 2 }}>
            <span
              className="text-[15px] font-medium"
              style={{ color: s.highlight ? "#0F6E56" : "#374151" }}
            >
              {s.value}
            </span>
            <span className="text-[11px] text-gray-400">{s.label}</span>
          </div>
        ))}
      </div>

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

      {matchScore != null && matchScore > 0 && <MatchScoreBar score={matchScore} />}
    </Link>
  );
}

// ─── Grid Card ──────────────────────────────────────

function GridCard({
  company,
  isSaved,
  matchScore,
}: {
  company: Company;
  isSaved: boolean;
  matchScore?: number;
}) {
  const jobCount = company.ow_jobs?.length || 0;
  const tags = company.ow_company_culture_tags || [];
  const topTags = tags.slice(0, 2);
  const stats = getAutoStats(company);
  const color = getLogoColor(company.name);
  const desc = company.description || company.mission || "";

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block bg-white rounded-xl overflow-hidden transition-all group"
      style={{ border: "0.5px solid #e5e7eb" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1D9E75")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
    >
      <div className="h-[56px] relative" style={{ background: `${color}20` }}>
        <div className="absolute top-2 right-2 z-10">
          <FavoriteButton companyId={company.id} initialFavorited={isSaved} />
        </div>
        <div
          className="absolute -bottom-5 left-4"
          style={{ border: "2px solid #fff", borderRadius: 14, background: "#fff" }}
        >
          <CompanyLogo company={company} size={44} rounded={12} />
        </div>
      </div>

      <div className="pt-7 px-4 pb-4">
        <div className="flex items-center gap-1.5 mb-1">
          <h3 className="font-semibold text-[13px] text-gray-800 truncate">
            {company.name}
          </h3>
          <CompanyBadges company={company} />
        </div>

        {desc && (
          <p
            className="text-[11px] text-gray-400 leading-relaxed mb-2"
            style={descStyle}
          >
            {desc}
          </p>
        )}

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

        <div
          className="grid grid-cols-3 gap-0 py-2.5 mb-3"
          style={{ borderTop: "0.5px solid #f0f0f0", borderBottom: "0.5px solid #f0f0f0" }}
        >
          {stats.map((s, i) => (
            <div
              key={i}
              className="text-center"
              style={i < stats.length - 1 ? { borderRight: "0.5px solid #f0f0f0" } : {}}
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

        <div className="flex justify-center">
          {jobCount > 0 ? (
            <span
              className="text-[11px] font-medium px-3 py-1.5 rounded-md w-full text-center"
              style={{ background: "#E1F5EE", color: "#0F6E56" }}
            >
              求人 {jobCount}件を見る
            </span>
          ) : (
            <span className="text-[11px] text-gray-300 py-1.5">現在求人なし</span>
          )}
        </div>

        {matchScore != null && matchScore > 0 && <MatchScoreBar score={matchScore} />}
      </div>
    </Link>
  );
}

// ─── Grid5 Card (compact 5-col) ─────────────────────

function Grid5Card({ company }: { company: Company }) {
  const jobCount = company.ow_jobs?.length || 0;

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block bg-white rounded-xl transition-all text-center"
      style={{ border: "0.5px solid #e5e7eb", padding: "16px 8px 12px" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1D9E75")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
    >
      <div className="flex justify-center mb-2">
        <CompanyLogo company={company} size={44} rounded={11} />
      </div>
      <h3 className="font-medium text-[12px] text-gray-800 leading-tight line-clamp-2 mb-1">
        {company.name}
      </h3>
      {company.industry && (
        <p className="text-[10px] text-gray-400 truncate mb-1.5">{company.industry}</p>
      )}
      {jobCount > 0 && (
        <span
          className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: "#E1F5EE", color: "#0F6E56" }}
        >
          求人 {jobCount}件
        </span>
      )}
    </Link>
  );
}

// ─── Section View helpers ───────────────────────────

type SectionDef = {
  id: string;
  title: string;
  filter: string;
  companies: Company[];
};

function buildSections(companies: Company[]): SectionDef[] {
  const sections: SectionDef[] = [
    {
      id: "featured",
      title: "注目の企業",
      filter: "",
      companies: companies.filter((c) => (c.ow_jobs?.length || 0) >= 4),
    },
    {
      id: "gaishi",
      title: "外資系・グローバル",
      filter: "外資系",
      companies: companies.filter(isGaishi),
    },
    {
      id: "listed",
      title: "日系上場企業",
      filter: "上場・大手",
      companies: companies.filter((c) => isListed(c) && !isGaishi(c)),
    },
    {
      id: "startup",
      title: "スタートアップ",
      filter: "スタートアップ",
      companies: companies.filter(isStartup),
    },
  ];
  return sections.filter((s) => s.companies.length > 0);
}

// ─── View Toggle Icons ──────────────────────────────

function ViewIcon({ type, active }: { type: string; active: boolean }) {
  const c = active ? "#1D9E75" : "#9ca3af";
  const w = 1.5;

  if (type === "list") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth={w}>
        <rect x="1" y="2" width="16" height="3" rx="1" />
        <rect x="1" y="7.5" width="16" height="3" rx="1" />
        <rect x="1" y="13" width="16" height="3" rx="1" />
      </svg>
    );
  }
  if (type === "grid") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth={w}>
        <rect x="1" y="1" width="7" height="7" rx="1.5" />
        <rect x="10" y="1" width="7" height="7" rx="1.5" />
        <rect x="1" y="10" width="7" height="7" rx="1.5" />
        <rect x="10" y="10" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (type === "grid5") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth={w}>
        <rect x="0.5" y="1" width="3" height="7" rx="0.8" />
        <rect x="4.5" y="1" width="3" height="7" rx="0.8" />
        <rect x="8.5" y="1" width="3" height="7" rx="0.8" />
        <rect x="12.5" y="1" width="3" height="7" rx="0.8" />
        <rect x="0.5" y="10" width="3" height="7" rx="0.8" />
        <rect x="4.5" y="10" width="3" height="7" rx="0.8" />
        <rect x="8.5" y="10" width="3" height="7" rx="0.8" />
        <rect x="12.5" y="10" width="3" height="7" rx="0.8" />
      </svg>
    );
  }
  // section
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth={w}>
      <rect x="1" y="1" width="16" height="2" rx="0.8" />
      <rect x="1" y="5" width="5" height="5" rx="1" />
      <rect x="7" y="5" width="5" height="5" rx="1" />
      <rect x="13" y="5" width="4" height="5" rx="1" />
      <rect x="1" y="12" width="16" height="2" rx="0.8" />
      <rect x="1" y="15.5" width="5" height="2" rx="0.8" />
      <rect x="7" y="15.5" width="5" height="2" rx="0.8" />
    </svg>
  );
}

// ─── Section Carousel ──────────────────────────────

const CARD_W = 148;
const CARD_GAP = 10;
const CARDS_PER_PAGE = 5;

function SectionCarousel({ section }: { section: SectionDef }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(section.companies.length / CARDS_PER_PAGE));

  const updateState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    const pageWidth = (CARD_W + CARD_GAP) * CARDS_PER_PAGE;
    const page = Math.round(el.scrollLeft / pageWidth);
    setCurrentPage(Math.min(page, totalPages - 1));
  }, [totalPages]);

  useEffect(() => {
    updateState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateState, { passive: true });
    window.addEventListener("resize", updateState);
    return () => {
      el.removeEventListener("scroll", updateState);
      window.removeEventListener("resize", updateState);
    };
  }, [updateState]);

  const slide = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = (CARD_W + CARD_GAP) * CARDS_PER_PAGE;
    el.scrollBy({ left: dir === "left" ? -dist : dist, behavior: "smooth" });
  };

  const jumpToPage = (page: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: (CARD_W + CARD_GAP) * CARDS_PER_PAGE * page, behavior: "smooth" });
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-bold text-gray-800">{section.title}</h2>
          <span className="text-[12px] text-gray-400">{section.companies.length}社</span>
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={() => slide("left")}
              disabled={!canLeft}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{
                border: "0.5px solid #e5e7eb",
                background: canLeft ? "#fff" : "#fafafa",
                cursor: canLeft ? "pointer" : "default",
                opacity: canLeft ? 1 : 0.4,
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke={canLeft ? "#374151" : "#d1d5db"} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => slide("right")}
              disabled={!canRight}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{
                border: "0.5px solid #e5e7eb",
                background: canRight ? "#fff" : "#fafafa",
                cursor: canRight ? "pointer" : "default",
                opacity: canRight ? 1 : 0.4,
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke={canRight ? "#374151" : "#d1d5db"} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        {section.filter && (
          <Link
            href={`/companies/list?category=${encodeURIComponent(section.filter)}`}
            className="text-[12px] text-gray-400 hover:text-[#1D9E75] transition-colors"
          >
            すべて見る →
          </Link>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex overflow-x-auto scroll-smooth no-scrollbar"
        style={{ gap: `${CARD_GAP}px` }}
      >
        {section.companies.map((c) => (
          <div key={c.id} className="flex-shrink-0" style={{ width: CARD_W }}>
            <Grid5Card company={c} />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => jumpToPage(i)}
              className="rounded-full transition-all"
              style={{
                width: currentPage === i ? 16 : 4,
                height: 4,
                background: currentPage === i ? "#1D9E75" : "#d1d5db",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────

export default function CompanyExplorer({
  companies,
  initialView = "list",
  savedCompanyIds = [],
  matchScoreMap = {},
}: {
  companies: Company[];
  initialView?: ViewMode;
  savedCompanyIds?: string[];
  matchScoreMap?: Record<string, number>;
  isLoggedIn?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [industry, setIndustry] = useState("すべて");
  const [category, setCategory] = useState("すべて");
  const [role, setRole] = useState("すべて");
  const [sort, setSort] = useState("jobs");
  const [view, setView] = useState<ViewMode>(initialView);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Convert savedCompanyIds to Set for fast lookup
  const savedSet = useMemo(
    () => new Set(savedCompanyIds),
    [savedCompanyIds]
  );

  // URL param persistence for view mode
  const handleViewChange = (v: ViewMode) => {
    setView(v);
    const params = new URLSearchParams(searchParams.toString());
    if (v === "list") {
      params.delete("view");
    } else {
      params.set("view", v);
    }
    const qs = params.toString();
    router.push(`/companies${qs ? `?${qs}` : ""}`, { scroll: false });
  };

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
        if (debouncedQuery) {
          const q = debouncedQuery.toLowerCase();
          const text = `${c.name} ${c.description || ""} ${c.industry || ""}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
        if (industry !== "すべて") {
          if (!c.industry?.includes(industry)) return false;
        }
        if (category !== "すべて") {
          if (category === "外資系" && !isGaishi(c)) return false;
          if (category === "日系" && isGaishi(c)) return false;
          if (category === "スタートアップ" && !isStartup(c)) return false;
        }
        if (role !== "すべて") {
          const cats = getJobCategories(c);
          if (!cats.some((cat) => cat.includes(role))) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === "jobs") return (b.ow_jobs?.length || 0) - (a.ow_jobs?.length || 0);
        if (sort === "newest")
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sort === "employees") {
          const ae = a.employees_jp || parseEmployeeCount(a.employee_count);
          const be = b.employees_jp || parseEmployeeCount(b.employee_count);
          return be - ae;
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
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 font-medium w-10 flex-shrink-0">業界</span>
          <div className="flex flex-wrap gap-1.5">
            {INDUSTRY_TAGS.map((tag) => (
              <TagButton key={tag} label={tag} selected={industry === tag} onClick={() => setIndustry(tag)} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 font-medium w-10 flex-shrink-0">分類</span>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_TAGS.map((tag) => (
              <TagButton key={tag} label={tag} selected={category === tag} onClick={() => setCategory(tag)} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 font-medium w-10 flex-shrink-0">職種</span>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_TAGS.map((tag) => (
              <TagButton key={tag} label={tag} selected={role === tag} onClick={() => setRole(tag)} />
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
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-[12px] text-gray-500 bg-transparent outline-none cursor-pointer pr-1"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ border: "0.5px solid #e5e7eb" }}
          >
            {(["list", "grid", "grid5", "section"] as const).map((v, i) => (
              <button
                key={v}
                onClick={() => handleViewChange(v)}
                className="p-1.5 transition-colors"
                title={
                  v === "list" ? "リスト" : v === "grid" ? "2列" : v === "grid5" ? "5列" : "セクション"
                }
                style={{
                  background: view === v ? "#E1F5EE" : "#fff",
                  borderLeft: i > 0 ? "0.5px solid #e5e7eb" : undefined,
                }}
              >
                <ViewIcon type={v} active={view === v} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Results ─── */}
      {filtered.length > 0 ? (
        view === "list" ? (
          <div className="flex flex-col" style={{ gap: "10px" }}>
            {filtered.map((c) => (
              <ListCard
                key={c.id}
                company={c}
                isSaved={savedSet.has(c.id)}
                matchScore={matchScoreMap[c.id]}
              />
            ))}
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <GridCard
                key={c.id}
                company={c}
                isSaved={savedSet.has(c.id)}
                matchScore={matchScoreMap[c.id]}
              />
            ))}
          </div>
        ) : view === "grid5" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {filtered.map((c) => (
              <Grid5Card key={c.id} company={c} />
            ))}
          </div>
        ) : (
          <div>
            {buildSections(filtered).map((section) => (
              <SectionCarousel key={section.id} section={section} />
            ))}
            <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
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
