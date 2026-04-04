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

// ─── カード色 ─────────────────────────────────────────

const LOGO_COLORS = [
  "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
];

// ─── コンポーネント ───────────────────────────────────

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
    <div className="mb-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="space-y-1">
        {options.map((opt) => {
          const isSelected = value === opt || (opt === "すべて" && !value);
          return (
            <button
              key={opt}
              onClick={() => onChange(opt === "すべて" ? "" : opt)}
              className={`block w-full text-left text-sm px-3 py-1.5 rounded-md transition-colors ${
                isSelected
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-gray-600 hover:bg-gray-100"
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

function CompanyRow({ company }: { company: Company }) {
  const jobCount = company.ow_jobs?.length || 0;
  const color = LOGO_COLORS[company.name.charCodeAt(0) % LOGO_COLORS.length];
  const tags = company.ow_company_culture_tags || [];
  const workStyleTag = tags.find((t: any) => t.tag_category === "work_style");

  return (
    <Link
      href={`/companies/${company.id}`}
      className="flex items-center gap-4 bg-white rounded-lg border border-card-border p-4 hover:shadow-md transition-shadow"
    >
      {/* Logo */}
      <div className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50">
        {company.logo_url ? (
          <img
            src={company.logo_url}
            alt={company.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full ${color} flex items-center justify-center text-white text-lg font-bold`}
          >
            {company.name[0]}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm truncate">{company.name}</h3>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {company.industry && (
            <span className="text-[11px] text-gray-500">{company.industry}</span>
          )}
          {company.location && (
            <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {company.location}
            </span>
          )}
          {company.phase && (
            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded">
              {company.phase}
            </span>
          )}
          {workStyleTag && (
            <span className="px-1.5 py-0.5 bg-green-50 text-green-600 text-[10px] rounded">
              {workStyleTag.tag_value}
            </span>
          )}
        </div>
      </div>

      {/* Job count */}
      <div className="flex-shrink-0 text-right">
        {jobCount > 0 && (
          <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">
            求人{jobCount}件
          </span>
        )}
      </div>
    </Link>
  );
}

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

  // URL更新
  function updateURL(params: Record<string, string>) {
    const sp = new URLSearchParams();
    const merged = { category, phase, workstyle, location, q: query, ...params };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    const qs = sp.toString();
    router.push(`/companies/list${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function handleCategory(v: string) {
    setCategory(v);
    updateURL({ category: v });
  }
  function handlePhase(v: string) {
    setPhase(v);
    updateURL({ phase: v });
  }
  function handleWorkstyle(v: string) {
    setWorkstyle(v);
    updateURL({ workstyle: v });
  }
  function handleLocation(v: string) {
    setLocation(v);
    updateURL({ location: v });
  }

  // フィルタリング
  const filtered = useMemo(() => {
    return companies.filter((c) => {
      // カテゴリ
      if (category && !matchesCategory(c, category)) return false;

      // フェーズ
      if (phase) {
        if (phase === "外資系") {
          if (!isGaishi(c)) return false;
        } else if (!c.phase?.includes(phase)) {
          return false;
        }
      }

      // 勤務スタイル
      if (workstyle) {
        const tags = c.ow_company_culture_tags || [];
        const hasStyle = tags.some(
          (t: any) =>
            t.tag_category === "work_style" &&
            t.tag_value?.includes(workstyle)
        );
        if (!hasStyle) return false;
      }

      // 所在地
      if (location) {
        if (location === "その他") {
          const major = ["東京都", "大阪府", "愛知県", "福岡県"];
          if (major.some((m) => c.location?.includes(m))) return false;
        } else {
          if (!c.location?.includes(location)) return false;
        }
      }

      // テキスト検索
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/companies"
              className="text-sm text-primary hover:underline"
            >
              ← 企業トップ
            </Link>
          </div>
          <h1 className="text-xl font-bold">企業一覧</h1>
        </div>
        <p className="text-sm text-gray-500">
          {filtered.length}社
          {activeFilterCount > 0 && (
            <span className="text-gray-400 ml-1">
              （{activeFilterCount}件のフィルター適用中）
            </span>
          )}
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateURL({ q: query });
          }}
          placeholder="企業名・業界・キーワードで検索"
          className="w-full px-4 py-3 bg-white border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden md:block w-56 flex-shrink-0">
          <div className="bg-white rounded-lg border border-card-border p-4 sticky top-24">
            <FilterSection
              title="カテゴリ"
              options={CATEGORIES}
              value={category}
              onChange={handleCategory}
            />
            <FilterSection
              title="フェーズ"
              options={PHASES}
              value={phase}
              onChange={handlePhase}
            />
            <FilterSection
              title="勤務スタイル"
              options={WORKSTYLES}
              value={workstyle}
              onChange={handleWorkstyle}
            />
            <FilterSection
              title="所在地"
              options={LOCATIONS}
              value={location}
              onChange={handleLocation}
            />

            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setCategory("");
                  setPhase("");
                  setWorkstyle("");
                  setLocation("");
                  router.push("/companies/list", { scroll: false });
                }}
                className="w-full text-xs text-gray-400 hover:text-red-500 mt-2 transition-colors"
              >
                フィルターをクリア
              </button>
            )}
          </div>
        </aside>

        {/* Main list */}
        <div className="flex-1 min-w-0">
          {filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map((c) => (
                <CompanyRow key={c.id} company={c} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg mb-2">
                該当する企業が見つかりませんでした
              </p>
              <button
                onClick={() => {
                  setCategory("");
                  setPhase("");
                  setWorkstyle("");
                  setLocation("");
                  setQuery("");
                  router.push("/companies/list", { scroll: false });
                }}
                className="text-primary hover:underline text-sm"
              >
                フィルターをクリアする
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
