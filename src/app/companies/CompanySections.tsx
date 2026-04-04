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

function isListed(c: Company): boolean {
  const count = parseEmployeeCount(c.employee_count);
  const phases = ["上場", "listed", "ユニコーン", "シリーズC", "シリーズD", "middle", "ミドル"];
  return (
    count > 100 ||
    phases.some((p) => c.phase?.includes(p))
  );
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
      title: "注目の企業",
      filter: "すべて",
      companies: companies.slice(0, 15),
    },
    {
      id: "gaishi",
      title: "外資系・グローバル",
      filter: "外資系",
      companies: companies.filter(isGaishi),
    },
    {
      id: "startup",
      title: "スタートアップ",
      filter: "スタートアップ",
      companies: companies.filter(isStartup),
    },
    {
      id: "listed",
      title: "上場・大手",
      filter: "上場・大手",
      companies: companies.filter(
        (c) => isListed(c) && !isGaishi(c)
      ),
    },
    {
      id: "remote",
      title: "フルリモート歓迎",
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
  "上場・大手",
  "フルリモート",
];

// ─── カード ─────────────────────────────────────────

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
  const color =
    LOGO_COLORS[company.name.charCodeAt(0) % LOGO_COLORS.length];

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block bg-white rounded-lg border border-card-border p-3 hover:shadow-md transition-shadow h-full"
    >
      {/* Logo */}
      <div className="w-full aspect-square rounded-md border border-gray-100 overflow-hidden flex items-center justify-center bg-gray-50 mb-2">
        {company.logo_url ? (
          <img
            src={company.logo_url}
            alt={company.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full ${color} flex items-center justify-center text-white text-2xl font-bold`}
          >
            {company.name[0]}
          </div>
        )}
      </div>

      {/* Industry */}
      {company.industry && (
        <p className="text-[10px] text-gray-400 truncate mb-0.5">
          {company.industry}
        </p>
      )}

      {/* Name */}
      <h3 className="font-semibold text-xs leading-tight line-clamp-2">
        {company.name}
      </h3>
    </Link>
  );
}

// ─── カルーセル ──────────────────────────────────────

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
      el.querySelector<HTMLElement>(":scope > div")?.offsetWidth || 160;
    const dist = (card + 12) * 5;
    el.scrollBy({ left: dir === "left" ? -dist : dist, behavior: "smooth" });
  };

  return (
    <div className="relative group">
      {canLeft && (
        <button
          onClick={() => slide("left")}
          className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {canRight && (
        <button
          onClick={() => slide("right")}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1 no-scrollbar"
      >
        {companies.map((c) => (
          <div
            key={c.id}
            className="flex-shrink-0 w-[calc((100%-3rem)/5)] min-w-[140px] snap-start"
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
      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="text-base font-bold mb-3">{section.title}</h2>
            <Carousel companies={section.companies} />
          </section>
        ))}
      </div>

      {/* No scrollbar style */}
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </>
  );
}
