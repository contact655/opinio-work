"use client";

import Link from "next/link";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FavoriteButton from "@/components/FavoriteButton";
import { getCompanyLogoSources } from "@/lib/utils/companyLogo";
import {
  parseEmployeeCount,
  isGaishi,
  isStartup,
  isListed,
  checkIsNew,
  checkIsFeatured,
  getJobCategories,
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
const LOCATION_TAGS = ["すべて", "東京", "大阪・関西", "名古屋", "福岡", "リモート可"];

const SORT_OPTIONS = [
  { value: "jobs", label: "求人数順" },
  { value: "match", label: "マッチ度順" },
  { value: "newest", label: "新着順" },
  { value: "employees", label: "社員数順" },
];

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
  // Build logo source chain: logo_url → Clearbit (website_url) → Clearbit (url) → Google favicon → initial
  const sources = getCompanyLogoSources(company);
  const [srcIndex, setSrcIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const currentSrc = sources[srcIndex] ?? null;
  const showInitial = !currentSrc || (!loaded && srcIndex >= sources.length);

  const initialFallback = (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: '#f3f4f6',
        border: '0.5px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.35,
        color: '#6b7280',
        fontWeight: 500,
        flexShrink: 0,
      }}
    >
      {company.name[0]}
    </div>
  );

  if (showInitial && !currentSrc) return initialFallback;

  return (
    <div
      className="flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        border: "1px solid #e5e7eb",
        background: loaded ? "#fff" : "#f3f4f6",
        padding: loaded ? 6 : 0,
      }}
    >
      {currentSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentSrc}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain", display: loaded ? "block" : "none" }}
          onLoad={(e) => {
            const img = e.target as HTMLImageElement;
            if (img.naturalWidth === 0) {
              setSrcIndex((i) => i + 1);
            } else {
              setLoaded(true);
            }
          }}
          onError={() => { setLoaded(false); setSrcIndex((i) => i + 1); }}
        />
      )}
      {!loaded && (
        <span style={{ fontSize: size * 0.35, fontWeight: 500, color: "#6b7280" }}>
          {company.name[0]}
        </span>
      )}
    </div>
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
      className="transition-all whitespace-nowrap"
      style={
        selected
          ? {
              fontSize: 14,
              fontWeight: 600,
              background: "#059669",
              border: "1.5px solid #059669",
              color: "#fff",
              borderRadius: 999,
              padding: "6px 16px",
            }
          : {
              fontSize: 14,
              fontWeight: 500,
              background: "#fff",
              border: "1.5px solid #d1d5db",
              color: "#1f2937",
              borderRadius: 999,
              padding: "6px 16px",
            }
      }
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = "#059669";
          e.currentTarget.style.color = "#059669";
          e.currentTarget.style.background = "#f0fdf4";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = "#d1d5db";
          e.currentTarget.style.color = "#1f2937";
          e.currentTarget.style.background = "#fff";
        }
      }}
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
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: "#dcfce7", color: "#15803d", border: "1px solid #86efac" }}
        >
          採用中
        </span>
      )}
    </>
  );
}

// ─── Match Score Bar ────────────────────────────────

// ─── 修正1: Description Ellipsis helper ─────────────

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
  const rawDesc = company.tagline || company.description || company.mission || "";
  // 先頭1文（句点 or 30文字で切り捨て）
  const catchphrase = (() => {
    if (!rawDesc) return "";
    const firstSentence = rawDesc.split(/[。\n]/)[0];
    if (firstSentence.length <= 30) return firstSentence;
    return firstSentence.slice(0, 30) + "...";
  })();

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block bg-white transition-all duration-150 group"
      style={{
        padding: "16px 20px",
        borderRadius: 16,
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -1px rgba(0,0,0,0.06)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0,0,0,0.12), 0 4px 6px -2px rgba(0,0,0,0.08)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -1px rgba(0,0,0,0.06)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* ロゴ + カラードット */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CompanyLogo company={company} size={48} rounded={10} />
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: company.cover_color || '#1d6fa5',
            flexShrink: 0,
          }}/>
        </div>

        {/* 本文 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 mb-0.5">
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }} className="truncate">
              {company.name}
            </h3>
            <CompanyBadges company={company} />
          </div>
          {catchphrase && (
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.5 }} className="truncate">
              {catchphrase}
            </p>
          )}
        </div>

        {/* ♡ハート */}
        <FavoriteButton companyId={company.id} initialFavorited={isSaved} />

        {/* ボタン群 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '120px', flexShrink: 0 }}>
          {matchScore != null && matchScore > 0 && (
            <div style={{
              fontSize: '14px', fontWeight: 500, color: '#1D9E75',
              border: '0.5px solid #d1d5db', borderRadius: '8px',
              padding: '9px 0', textAlign: 'center', background: 'white', width: '100%',
            }}>
              マッチ度 {matchScore}%
            </div>
          )}
          <span style={{
            fontSize: '13px', fontWeight: 600, padding: '8px 16px', borderRadius: '8px',
            background: 'transparent', color: '#1a1a1a', border: '1.5px solid #d0d0d0',
            textAlign: 'center', display: 'block', width: '100%',
            transition: 'all 0.15s',
          }}>
            詳細 →
          </span>
          {jobCount > 0 && (
            <span style={{
              fontSize: '14px', padding: '9px 0', borderRadius: '8px',
              background: '#fff', color: '#0f172a', border: '0.5px solid #d1d5db',
              textAlign: 'center', display: 'block', width: '100%',
            }}>
              求人 {jobCount}件 &gt;
            </span>
          )}
        </div>
      </div>

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
  const rawDesc = company.tagline || company.description || company.mission || "";
  const catchphrase = (() => {
    if (!rawDesc) return "";
    const firstSentence = rawDesc.split(/[。\n]/)[0];
    if (firstSentence.length <= 30) return firstSentence;
    return firstSentence.slice(0, 30) + "...";
  })();

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block bg-white overflow-hidden transition-all duration-150 group"
      style={{
        borderRadius: 16,
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -1px rgba(0,0,0,0.06)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0,0,0,0.12), 0 4px 6px -2px rgba(0,0,0,0.08)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -1px rgba(0,0,0,0.06)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div className="relative" style={{ height: 100 }}>
        {company.header_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.header_image_url}
            alt={company.name}
            style={{
              width: "100%", height: 100,
              objectFit: "cover",
              borderRadius: "16px 16px 0 0",
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: 100,
            background: `linear-gradient(135deg, ${company.cover_color || '#1d6fa5'}, ${company.cover_color || '#1d6fa5'}cc)`,
            borderRadius: '16px 16px 0 0',
          }} />
        )}
        <div className="absolute top-2 right-2 z-10">
          <FavoriteButton companyId={company.id} initialFavorited={isSaved} />
        </div>
        <div
          className="absolute -bottom-5 left-4"
          style={{ border: "2px solid #fff", borderRadius: 12, background: "#fff" }}
        >
          <CompanyLogo company={company} size={44} rounded={10} />
        </div>
      </div>

      <div className="pt-7 px-4 pb-4">
        <div className="flex items-center gap-1.5 mb-0.5">
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }} className="truncate">
            {company.name}
          </h3>
          <CompanyBadges company={company} />
        </div>

        {catchphrase && (
          <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px 0", lineHeight: 1.5 }} className="truncate">
            {catchphrase}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {matchScore != null && matchScore > 0 && (
            <div style={{
              fontSize: '14px', fontWeight: 500, color: '#1D9E75',
              border: '0.5px solid #d1d5db', borderRadius: '8px',
              padding: '9px 0', textAlign: 'center', background: 'white', width: '100%',
            }}>
              マッチ度 {matchScore}%
            </div>
          )}
          <span style={{
            fontSize: '13px', fontWeight: 600, padding: '8px 16px', borderRadius: '8px',
            background: 'transparent', color: '#1a1a1a', border: '1.5px solid #d0d0d0',
            textAlign: 'center', display: 'block', width: '100%',
            transition: 'all 0.15s',
          }}>
            詳細 →
          </span>
          {jobCount > 0 && (
            <span style={{
              fontSize: '14px', padding: '9px 0', borderRadius: '8px',
              background: '#fff', color: '#0f172a', border: '0.5px solid #d1d5db',
              textAlign: 'center', display: 'block', width: '100%',
            }}>
              求人 {jobCount}件 &gt;
            </span>
          )}
        </div>
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
      className="block bg-white rounded-xl transition-shadow duration-200 text-center shadow-card hover:shadow-card-hover"
      style={{ padding: "16px 8px 12px" }}
    >
      <div className="flex justify-center mb-2">
        <CompanyLogo company={company} size={44} rounded={11} />
      </div>
      <h3 className="leading-tight line-clamp-2 mb-1" style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
        {company.name}
      </h3>
      {company.industry && (
        <p className="truncate mb-1.5" style={{ fontSize: 12, color: "#6b7280" }}>{company.industry}</p>
      )}
      {jobCount > 0 && (
        <span
          className="inline-block px-2 py-0.5 rounded-full"
          style={{ fontSize: 13, fontWeight: 600, color: "#059669", background: "#f0fdf4" }}
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
          <h2 className="text-[15px] font-bold text-gray-900">{section.title}</h2>
          <span className="text-[12px] text-gray-600">{section.companies.length}社</span>
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
            className="text-[12px] text-gray-600 hover:text-[#1D9E75] transition-colors"
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
  const [locationFilter, setLocationFilter] = useState("すべて");
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
        if (locationFilter !== "すべて") {
          const loc = (c.location || c.headquarters || "").toLowerCase();
          const jobLocations = (c.ow_jobs || []).map((j: any) => (j.location || j.work_style || "").toLowerCase()).join(" ");
          const allText = `${loc} ${jobLocations}`;
          if (locationFilter === "東京") {
            if (!allText.includes("東京")) return false;
          } else if (locationFilter === "大阪・関西") {
            if (!allText.includes("大阪") && !allText.includes("関西")) return false;
          } else if (locationFilter === "名古屋") {
            if (!allText.includes("名古屋")) return false;
          } else if (locationFilter === "福岡") {
            if (!allText.includes("福岡")) return false;
          } else if (locationFilter === "リモート可") {
            const remoteText = `${allText} ${(c.work_style || "").toLowerCase()}`;
            if (!remoteText.includes("リモート") && !remoteText.includes("remote") && !remoteText.includes("フルリモート")) return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === "jobs") return (b.ow_jobs?.length || 0) - (a.ow_jobs?.length || 0);
        if (sort === "match") {
          return (matchScoreMap[b.id] || 0) - (matchScoreMap[a.id] || 0);
        }
        if (sort === "newest")
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sort === "employees") {
          const ae = a.employees_jp || parseEmployeeCount(a.employee_count);
          const be = b.employees_jp || parseEmployeeCount(b.employee_count);
          return be - ae;
        }
        return 0;
      });
  }, [companies, debouncedQuery, industry, category, role, locationFilter, sort, matchScoreMap]);

  return (
    <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* ─── Page Header ─── */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
          企業を探す
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280" }}>
          カルチャー・働き方・年収のリアルを知ってから、応募できます。
        </p>
      </div>

      {/* ─── Search Bar ─── */}
      <div className="mb-5">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-600"
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
            className="w-full pl-12 pr-4 bg-white focus:outline-none transition-colors"
            style={{ height: 48, fontSize: 15, color: "#111827", border: "1.5px solid #e5e7eb", borderRadius: 10 }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#059669"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
          />
        </div>
      </div>

      {/* ─── Filter Tags ─── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        <div className="flex items-center" style={{ gap: 12 }}>
          <span className="flex-shrink-0" style={{ fontSize: 14, fontWeight: 600, color: "#374151", minWidth: 48 }}>業界</span>
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {INDUSTRY_TAGS.map((tag) => (
              <TagButton key={tag} label={tag} selected={industry === tag} onClick={() => setIndustry(tag)} />
            ))}
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 12 }}>
          <span className="flex-shrink-0" style={{ fontSize: 14, fontWeight: 600, color: "#374151", minWidth: 48 }}>分類</span>
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {CATEGORY_TAGS.map((tag) => (
              <TagButton key={tag} label={tag} selected={category === tag} onClick={() => setCategory(tag)} />
            ))}
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 12 }}>
          <span className="flex-shrink-0" style={{ fontSize: 14, fontWeight: 600, color: "#374151", minWidth: 48 }}>職種</span>
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {ROLE_TAGS.map((tag) => (
              <TagButton key={tag} label={tag} selected={role === tag} onClick={() => setRole(tag)} />
            ))}
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 12 }}>
          <span className="flex-shrink-0" style={{ fontSize: 14, fontWeight: 600, color: "#374151", minWidth: 48 }}>勤務地</span>
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {LOCATION_TAGS.map((tag) => (
              <TagButton key={tag} label={tag} selected={locationFilter === tag} onClick={() => setLocationFilter(tag)} />
            ))}
          </div>
        </div>
      </div>

      {/* ─── Toolbar: count + sort + view ─── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[13px] text-gray-500" style={{ margin: 0 }}>
            IT/SaaS厳選 <span className="font-semibold text-gray-900">{filtered.length}社</span>
          </p>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0 0" }}>Opinioが審査・掲載を承認した企業のみ</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-[12px] text-gray-500 bg-transparent outline-none cursor-pointer pr-1"
          >
            {SORT_OPTIONS
              .filter((opt) => opt.value !== "match" || Object.keys(matchScoreMap).length > 0)
              .map((opt) => (
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
          <div className="flex flex-col" style={{ gap: "16px" }}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
          <p className="text-gray-600 text-[14px] mb-2">
            該当する企業が見つかりませんでした
          </p>
          <button
            onClick={() => {
              setQuery("");
              setIndustry("すべて");
              setCategory("すべて");
              setRole("すべて");
              setLocationFilter("すべて");
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
