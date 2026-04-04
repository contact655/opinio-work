"use client";

import Link from "next/link";
import { useRef, useState, useEffect, useCallback } from "react";

// ─── カテゴリ分類ロジック ───────────────────────────────

type Company = any;

const GAISHI_KEYWORDS = [
  "Google", "Amazon", "Microsoft", "Salesforce", "Meta", "Apple",
  "Oracle", "SAP", "IBM", "Cisco", "Adobe",
];

function isGaishi(c: Company): boolean {
  return GAISHI_KEYWORDS.some(
    (k) =>
      c.name?.includes(k) ||
      c.name_en?.includes(k) ||
      c.description?.includes("日本法人")
  );
}

function parseEmployeeCount(s: string | null): number {
  if (!s) return 0;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function isStartup(c: Company): boolean {
  const count = parseEmployeeCount(c.employee_count);
  const phases = ["シード", "シリーズA", "シリーズB", "シリーズC", "early", "seed"];
  return (
    (count > 0 && count <= 100) ||
    phases.some((p) => c.phase?.includes(p))
  );
}

function isMiddle(c: Company): boolean {
  const count = parseEmployeeCount(c.employee_count);
  const phases = ["シリーズC", "シリーズD", "middle", "ミドル"];
  return (
    (count > 100 && count <= 1000) ||
    phases.some((p) => c.phase?.includes(p))
  );
}

function isListed(c: Company): boolean {
  const phases = ["上場", "listed", "ユニコーン"];
  return phases.some((p) => c.phase?.includes(p));
}

function isRemote(c: Company): boolean {
  const tags = c.ow_company_culture_tags || [];
  return tags.some(
    (t: any) =>
      t.tag_value?.includes("リモート") || t.tag_value?.includes("remote")
  );
}

type Section = {
  id: string;
  title: string;
  filter: string;
  companies: Company[];
};

function buildSections(companies: Company[]): Section[] {
  const sections: Section[] = [
    {
      id: "featured",
      title: "🏢 注目の企業",
      filter: "すべて",
      companies: companies.slice(0, 12),
    },
    {
      id: "gaishi",
      title: "🌏 外資系・グローバル",
      filter: "外資系",
      companies: companies.filter(isGaishi),
    },
    {
      id: "startup",
      title: "🚀 スタートアップ",
      filter: "スタートアップ",
      companies: companies.filter(isStartup),
    },
    {
      id: "middle",
      title: "📈 成長期・ミドル",
      filter: "ミドル",
      companies: companies.filter(
        (c) => isMiddle(c) && !isGaishi(c)
      ),
    },
    {
      id: "listed",
      title: "🏛️ 上場企業・大手",
      filter: "上場企業",
      companies: companies.filter(
        (c) => isListed(c) && !isGaishi(c)
      ),
    },
    {
      id: "remote",
      title: "🏠 フルリモート対応",
      filter: "フルリモート",
      companies: companies.filter(isRemote),
    },
  ];

  return sections.filter((s) => s.companies.length > 0);
}

// ─── フィルターボタン ────────────────────────────────

const FILTERS = [
  "すべて",
  "外資系",
  "スタートアップ",
  "ミドル",
  "上場企業",
  "フルリモート",
];

// ─── カルーセル ──────────────────────────────────────

const LOGO_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-rose-500",
];

function CompanyCard({ company }: { company: Company }) {
  const jobCount = company.ow_jobs?.length || 0;
  const color =
    LOGO_COLORS[company.name.charCodeAt(0) % LOGO_COLORS.length];

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block bg-white rounded-xl border border-card-border p-4 hover:shadow-lg transition-shadow h-full"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50">
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={`w-full h-full ${color} flex items-center justify-center text-white text-base font-bold`}
            >
              {company.name[0]}
            </div>
          )}
        </div>
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex-1 min-w-0">
          {company.name}
        </h3>
      </div>

      <div className="flex flex-wrap gap-1 mb-2.5">
        {company.industry && (
          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">
            {company.industry}
          </span>
        )}
        {company.phase && (
          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded">
            {company.phase}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-400">
        {company.location ? (
          <span className="flex items-center gap-0.5 truncate">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {company.location}
          </span>
        ) : (
          <span />
        )}
        {jobCount > 0 && (
          <span className="text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
            求人{jobCount}件
          </span>
        )}
      </div>
    </Link>
  );
}

function Carousel({ companies }: { companies: Company[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const check = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    check();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [check]);

  const slide = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const card =
      el.querySelector<HTMLElement>(":scope > div")?.offsetWidth || 200;
    const dist = (card + 16) * 3;
    el.scrollBy({ left: dir === "left" ? -dist : dist, behavior: "smooth" });
  };

  return (
    <div className="relative group">
      {canLeft && (
        <button
          onClick={() => slide("left")}
          className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {canRight && (
        <button
          onClick={() => slide("right")}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1 no-scrollbar"
      >
        {companies.map((c) => (
          <div
            key={c.id}
            className="flex-shrink-0 w-[calc((100%-2rem)/3)] min-w-[200px] snap-start"
          >
            <CompanyCard company={c} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── メインコンポーネント ──────────────────────────────

export default function CompanySections({
  companies,
}: {
  companies: Company[];
}) {
  const sections = buildSections(companies);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* Count */}
      <p className="text-sm text-gray-500 mb-4">
        {companies.length}社の企業が見つかりました
      </p>

      {/* Filters */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map((f) => {
          const section = sections.find((s) => s.filter === f);
          if (!section) return null;
          return (
            <button
              key={f}
              onClick={() => scrollTo(section.id)}
              className="flex-shrink-0 text-xs px-4 py-2 rounded-full border bg-white text-gray-600 border-card-border hover:border-primary hover:text-primary transition-colors"
            >
              {f}
              {section && (
                <span className="ml-1 text-gray-400">
                  {section.companies.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sections */}
      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="text-lg font-bold mb-4">{section.title}</h2>
            <Carousel companies={section.companies} />
          </section>
        ))}
      </div>

      {/* No scrollbar style */}
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </>
  );
}
