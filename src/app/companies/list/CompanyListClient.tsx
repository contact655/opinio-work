"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type Company = any;

// ─── カテゴリ分類 ─────────────────────────────────────

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
  const phases = ["シード", "シリーズA", "シリーズB", "early", "seed"];
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

function matchesCategory(c: Company, category: string): boolean {
  switch (category) {
    case "外資系":
      return isGaishi(c);
    case "スタートアップ":
      return isStartup(c);
    case "上場・大手":
      return isListed(c);
    case "フルリモート":
      return isRemote(c);
    default:
      return true;
  }
}

// ─── フィルター選択肢 ─────────────────────────────────

const CATEGORIES = ["すべて", "外資系", "スタートアップ", "上場・大手", "フルリモート"];
const PHASES = ["すべて", "シード", "シリーズA", "シリーズB", "シリーズC", "上場企業", "外資系"];
const WORKSTYLES = ["すべて", "フルリモート", "リモート中心", "ハイブリッド", "出社中心"];
const LOCATIONS = ["すべて", "東京都", "大阪府", "愛知県", "福岡県", "その他"];

// ─── ロゴカラー ───────────────────────────────────────

const LOGO_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
];

// ─── サイドバーフィルター ──────────────────────────────

function FilterSection({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-6">
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="space-y-0.5">
        {options.map((opt) => {
          const isSelected = value === opt || (opt === "すべて" && !value);
          return (
            <button
              key={opt}
              onClick={() => onChange(opt === "すべて" ? "" : opt)}
              className={`block w-full text-left text-[13px] px-3 py-1.5 rounded-md transition-colors ${
                isSelected
                  ? "bg-primary/8 text-primary font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 企業リスト行 ────────────────────────────────────

function CompanyRow({ company }: { company: Company }) {
  const jobCount = company.ow_jobs?.length || 0;
  const color = LOGO_COLORS[company.name.charCodeAt(0) % LOGO_COLORS.length];

  return (
    <div
      className="flex items-center gap-4 bg-white py-4 px-5 hover:bg-gray-50/50 transition-colors"
      style={{ borderBottom: "0.5px solid #f0f0f0" }}
    >
      {/* Logo */}
      <Link
        href={`/companies/${company.id}`}
        className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center"
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
            className={`w-full h-full ${color} flex items-center justify-center text-white text-sm font-bold`}
          >
            {company.name[0]}
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/companies/${company.id}`}
          className="font-medium text-[13px] text-gray-800 hover:text-primary transition-colors truncate block"
        >
          {company.name}
        </Link>
        <div className="flex items-center gap-3 mt-0.5">
          {company.industry && (
            <span className="text-[11px] text-gray-400">{company.industry}</span>
          )}
          {company.employee_count && (
            <span className="text-[11px] text-gray-400">{/^\d+$/.test(company.employee_count) ? `${company.employee_count}名` : String(company.employee_count).includes("名") ? company.employee_count : `${company.employee_count}名`}</span>
          )}
          {company.location && (
            <span className="text-[11px] text-gray-400">{company.location}</span>
          )}
        </div>
      </div>

      {/* Job count + CTA */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {jobCount > 0 ? (
          <>
            <span className="text-[11px] text-gray-400">
              求人 {jobCount}件
            </span>
            <Link
              href={`/companies/${company.id}#jobs`}
              className="text-[12px] text-primary font-medium px-3 py-1.5 rounded-md hover:bg-primary/5 transition-colors"
              style={{ border: "0.5px solid currentColor" }}
            >
              求人を見る
            </Link>
          </>
        ) : (
          <Link
            href={`/companies/${company.id}`}
            className="text-[12px] text-gray-400 font-medium px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
            style={{ border: "0.5px solid #d1d5db" }}
          >
            詳細を見る
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── メインコンポーネント ──────────────────────────────

export default function CompanyListClient({
  companies,
  initialCategory,
  initialPhase,
  initialWorkstyle,
  initialLocation,
  initialQuery,
}: {
  companies: Company[];
  initialCategory: string;
  initialPhase: string;
  initialWorkstyle: string;
  initialLocation: string;
  initialQuery: string;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(initialCategory);
  const [phase, setPhase] = useState(initialPhase);
  const [workstyle, setWorkstyle] = useState(initialWorkstyle);
  const [location, setLocation] = useState(initialLocation);
  const [query, setQuery] = useState(initialQuery);

  function updateURL(params: Record<string, string>) {
    const sp = new URLSearchParams();
    const merged = { category, phase, workstyle, location, q: query, ...params };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    const qs = sp.toString();
    router.push(`/companies/list${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function handleCategory(v: string) { setCategory(v); updateURL({ category: v }); }
  function handlePhase(v: string) { setPhase(v); updateURL({ phase: v }); }
  function handleWorkstyle(v: string) { setWorkstyle(v); updateURL({ workstyle: v }); }
  function handleLocation(v: string) { setLocation(v); updateURL({ location: v }); }

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      if (category && !matchesCategory(c, category)) return false;
      if (phase) {
        if (phase === "外資系") {
          if (!isGaishi(c)) return false;
        } else if (!c.phase?.includes(phase)) {
          return false;
        }
      }
      if (workstyle) {
        const tags = c.ow_company_culture_tags || [];
        const hasStyle = tags.some(
          (t: any) => t.tag_category === "work_style" && t.tag_value?.includes(workstyle)
        );
        if (!hasStyle) return false;
      }
      if (location) {
        if (location === "その他") {
          const major = ["東京都", "大阪府", "愛知県", "福岡県"];
          if (major.some((m) => c.location?.includes(m))) return false;
        } else {
          if (!c.location?.includes(location)) return false;
        }
      }
      if (query) {
        const q = query.toLowerCase();
        const text = `${c.name} ${c.industry} ${c.description} ${c.location}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [companies, category, phase, workstyle, location, query]);

  const activeFilterCount = [category, phase, workstyle, location].filter(Boolean).length;

  return (
    <>
      {/* Breadcrumb + Title */}
      <div className="mb-6">
        <Link
          href="/companies"
          className="text-[12px] text-gray-400 hover:text-primary transition-colors"
        >
          企業トップ
        </Link>
        <span className="text-[12px] text-gray-300 mx-1.5">/</span>
        <span className="text-[12px] text-gray-600">企業一覧</span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-gray-800">企業一覧</h1>
        <p className="text-[13px] text-gray-400">
          {filtered.length}社
          {activeFilterCount > 0 && (
            <span className="ml-1">
              ({activeFilterCount}件のフィルター)
            </span>
          )}
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") updateURL({ q: query }); }}
            placeholder="企業名・業界・キーワードで検索"
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent focus:bg-white transition-colors"
          />
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="hidden md:block w-[220px] flex-shrink-0">
          <div className="sticky top-24">
            <FilterSection title="カテゴリ" options={CATEGORIES} value={category} onChange={handleCategory} />
            <FilterSection title="フェーズ" options={PHASES} value={phase} onChange={handlePhase} />
            <FilterSection title="勤務スタイル" options={WORKSTYLES} value={workstyle} onChange={handleWorkstyle} />
            <FilterSection title="所在地" options={LOCATIONS} value={location} onChange={handleLocation} />

            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setCategory(""); setPhase(""); setWorkstyle(""); setLocation("");
                  router.push("/companies/list", { scroll: false });
                }}
                className="w-full text-[11px] text-gray-400 hover:text-red-500 mt-1 transition-colors text-left px-3"
              >
                フィルターをクリア
              </button>
            )}
          </div>
        </aside>

        {/* Main list */}
        <div className="flex-1 min-w-0">
          {filtered.length > 0 ? (
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: "0.5px solid #e5e7eb" }}>
              {filtered.map((c) => (
                <CompanyRow key={c.id} company={c} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-400 text-sm mb-3">
                該当する企業が見つかりませんでした
              </p>
              <button
                onClick={() => {
                  setCategory(""); setPhase(""); setWorkstyle(""); setLocation(""); setQuery("");
                  router.push("/companies/list", { scroll: false });
                }}
                className="text-primary hover:underline text-sm"
              >
                フィルターをクリア
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
