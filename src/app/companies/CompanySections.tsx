"use client";

import Link from "next/link";
import { useRef, useState, useEffect, useCallback } from "react";

// ─── タイプ定義 ─────────────────────────────────────────

type Company = any;
type Job = any;

// ─── カテゴリ分類ロジック ───────────────────────────────

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

// ─── ロゴカラー ─────────────────────────────────────────

const LOGO_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-rose-500",
];

// ─── 企業カード（ワンキャリア風） ──────────────────────

function CompanyCard({ company }: { company: Company }) {
  const color =
    LOGO_COLORS[company.name.charCodeAt(0) % LOGO_COLORS.length];
  const jobCount = company.ow_jobs?.length || 0;

  return (
    <Link
      href={`/companies/${company.id}`}
      className="group block bg-white rounded-xl p-4 h-[180px] hover:border-primary/50 transition-all hover:shadow-sm"
      style={{ border: "0.5px solid #e5e7eb" }}
    >
      {/* Logo */}
      <div className="flex justify-center mb-3">
        <div className="w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0"
          style={{ border: "0.5px solid #e5e7eb" }}
        >
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={`w-full h-full ${color} flex items-center justify-center text-white text-xl font-bold`}
            >
              {company.name[0]}
            </div>
          )}
        </div>
      </div>

      {/* Industry */}
      {company.industry && (
        <p className="text-[11px] text-gray-600 truncate text-center leading-none mb-1.5">
          {company.industry}
        </p>
      )}

      {/* Name */}
      <h3 className="font-medium text-[13px] leading-tight line-clamp-2 text-center text-gray-800 mb-1.5">
        {company.name}
      </h3>

      {/* Job count */}
      {jobCount > 0 && (
        <p className="text-[11px] text-primary font-medium text-center">
          {jobCount}件の求人
        </p>
      )}
    </Link>
  );
}

// ─── 求人カード ─────────────────────────────────────────

function JobCard({ job }: { job: Job }) {
  const company = job.ow_companies;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block bg-white rounded-xl p-4 hover:border-primary/50 transition-all hover:shadow-sm"
      style={{ border: "0.5px solid #e5e7eb", minHeight: "140px" }}
    >
      {/* Company info */}
      {company && (
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-md overflow-hidden flex items-center justify-center flex-shrink-0 bg-gray-50"
            style={{ border: "0.5px solid #e5e7eb" }}
          >
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-gray-600">{company.name?.[0]}</span>
            )}
          </div>
          <span className="text-[11px] text-gray-600 truncate">{company.name}</span>
        </div>
      )}

      {/* Title */}
      <h3 className="font-medium text-[13px] leading-snug text-gray-800 line-clamp-2 mb-2">
        {job.title}
      </h3>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-1.5">
        {job.job_category && (
          <span className="text-[10px] text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
            {job.job_category}
          </span>
        )}
        {job.salary_min && job.salary_max && (
          <span className="text-[10px] text-gray-600">
            {job.salary_min}〜{job.salary_max}万
          </span>
        )}
        {job.location && (
          <span className="text-[10px] text-gray-600">{job.location}</span>
        )}
      </div>
    </Link>
  );
}

// ─── 汎用カルーセル ──────────────────────────────────────

function Carousel({
  children,
  itemWidth = 160,
  gap = 12,
  slideCount = 5,
}: {
  children: React.ReactNode;
  itemWidth?: number;
  gap?: number;
  slideCount?: number;
}) {
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
      el.querySelector<HTMLElement>(":scope > div")?.offsetWidth || itemWidth;
    const dist = (card + gap) * slideCount;
    el.scrollBy({ left: dir === "left" ? -dist : dist, behavior: "smooth" });
  };

  return (
    <div className="relative group/carousel">
      {canLeft && (
        <button
          onClick={() => slide("left")}
          className="absolute -left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          style={{ border: "0.5px solid #e5e7eb" }}
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {canRight && (
        <button
          onClick={() => slide("right")}
          className="absolute -right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          style={{ border: "0.5px solid #e5e7eb" }}
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 no-scrollbar"
        style={{ gap: `${gap}px` }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── メインコンポーネント ──────────────────────────────

export default function CompanySections({
  companies,
  recentJobs,
}: {
  companies: Company[];
  recentJobs: Job[];
}) {
  const sections = buildSections(companies);

  return (
    <>
      {/* Count + View All */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-600">
          {companies.length}社の企業
        </p>
        <Link
          href="/companies/list"
          className="text-sm text-primary hover:underline font-medium"
        >
          すべての企業を見る →
        </Link>
      </div>

      {/* Company Sections */}
      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-gray-800">{section.title}</h2>
              <Link
                href={
                  section.filter === "すべて"
                    ? "/companies/list"
                    : `/companies/list?category=${encodeURIComponent(section.filter)}`
                }
                className="text-xs text-gray-600 hover:text-primary transition-colors"
              >
                すべて見る →
              </Link>
            </div>
            <Carousel itemWidth={160} gap={12} slideCount={5}>
              {section.companies.map((c) => (
                <div
                  key={c.id}
                  className="flex-shrink-0 w-[160px] snap-start"
                >
                  <CompanyCard company={c} />
                </div>
              ))}
            </Carousel>
          </section>
        ))}
      </div>

      {/* Recent Jobs Section */}
      {recentJobs.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold text-gray-800">新着求人</h2>
            <Link
              href="/jobs"
              className="text-xs text-gray-600 hover:text-primary transition-colors"
            >
              すべての求人を見る →
            </Link>
          </div>
          <Carousel itemWidth={260} gap={12} slideCount={3}>
            {recentJobs.map((job) => (
              <div
                key={job.id}
                className="flex-shrink-0 w-[260px] snap-start"
              >
                <JobCard job={job} />
              </div>
            ))}
          </Carousel>
        </section>
      )}

      {/* All companies button */}
      <div className="mt-12 text-center">
        <Link
          href="/companies/list"
          className="inline-flex items-center gap-2 px-8 py-3 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          style={{ border: "0.5px solid #d1d5db" }}
        >
          すべての企業を見る
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* No scrollbar style */}
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </>
  );
}
