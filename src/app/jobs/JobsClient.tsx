"use client";

import Link from "next/link";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { JobCard } from "@/components/jobs/JobCard";

// ─── Types ──────────────────────────────────────────

type Job = any;
type ViewMode = "list" | "grid";

// ─── Constants ──────────────────────────────────────

import { ROLE_CATEGORY_LABELS, matchesRoleCategory } from "@/lib/roleCategories";
import { MobileFilterSheet, FilterDef } from "@/components/MobileFilterSheet";

// Fix 5: Restructured category list (10 items + すべて)
const CATEGORY_CHIPS = ["すべて", ...ROLE_CATEGORY_LABELS];
const STYLE_CHIPS = ["すべて", "フルリモート", "ハイブリッド", "オフィス出社"];
const SALARY_CHIPS = ["すべて", "600万〜", "800万〜", "1000万〜"];
const LOCATION_CHIPS = ["すべて", "東京", "大阪", "名古屋", "福岡", "リモート可"];

const SORT_OPTIONS = [
  { value: "match", label: "マッチ度順" },
  { value: "newest", label: "新着順" },
  { value: "salary", label: "年収順" },
];

// param key → chip array mapping for active tags
const FILTER_DEFS = [
  { key: "category", label: "職種", chips: CATEGORY_CHIPS },
  { key: "style", label: "勤務形態", chips: STYLE_CHIPS },
  { key: "salary", label: "年収", chips: SALARY_CHIPS },
  { key: "location", label: "勤務地", chips: LOCATION_CHIPS },
] as const;

// ─── Helpers ────────────────────────────────────────

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

function matchesLocationFilter(job: Job, filter: string): boolean {
  if (filter === "すべて") return true;
  const loc = job.location || "";
  const ws = job.work_style || "";
  if (filter === "東京") return loc.includes("東京");
  if (filter === "大阪") return loc.includes("大阪") || loc.includes("関西");
  if (filter === "名古屋") return loc.includes("名古屋");
  if (filter === "福岡") return loc.includes("福岡");
  if (filter === "リモート可") return ws.includes("リモート") || ws.includes("フルリモート");
  return true;
}

function matchesCategoryFilter(job: Job, filter: string): boolean {
  return matchesRoleCategory(job.job_category, filter);
}

// Match functions by param key
const MATCHERS: Record<string, (job: Job, v: string) => boolean> = {
  category: matchesCategoryFilter,
  style: matchesStyleFilter,
  salary: matchesSalaryFilter,
  location: matchesLocationFilter,
};

function getJobMatchScore(job: Job): number | null {
  // サーバーで計算済みのスコアのみ採用。ダミーは出さない（Fix 2）。
  return job.match_score ?? null;
}

function sortJobs(jobs: Job[], sortBy: string): Job[] {
  if (sortBy === "salary") {
    return [...jobs].sort((a, b) => (b.salary_max || 0) - (a.salary_max || 0));
  } else if (sortBy === "newest") {
    return [...jobs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } else {
    // match: null は最下位扱い（ダミー値で順序を作らない）
    return [...jobs].sort((a, b) => {
      const sa = getJobMatchScore(a);
      const sb = getJobMatchScore(b);
      if (sa == null && sb == null) return 0;
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sb - sa;
    });
  }
}

// ─── Component ──────────────────────────────────────

export default function JobsClient({
  jobs,
  isLoggedIn = false,
  hasProfile = false,
}: {
  jobs: Job[];
  initialParams?: Record<string, string | undefined>;
  isLoggedIn?: boolean;
  hasProfile?: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  // Match-sort eligibility: requires login + profile
  const canMatchSort = isLoggedIn && hasProfile;

  // お気に入り状態をクライアント側で取得
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!isLoggedIn) return;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("ow_job_favorites")
        .select("job_id")
        .eq("user_id", user.id);
      if (data) setFavoriteIds(new Set(data.map((f: any) => f.job_id)));
    })();
  }, [isLoggedIn]);

  // Read filters from URL
  const query = searchParams.get("q") || "";
  const categoryFilter = searchParams.get("category") || "すべて";
  const styleFilter = searchParams.get("style") || "すべて";
  const salaryFilter = searchParams.get("salary") || "すべて";
  const locationFilter = searchParams.get("location") || "すべて";
  // Fix 3: 常に新着順をデフォルトにする（マッチ度順はオプトイン）
  const defaultSort = "newest";
  const rawSort = searchParams.get("sort") || defaultSort;
  // マッチ度順を選択しているがプロフィール未完成 → 新着順にフォールバック
  const sortBy = rawSort === "match" && !canMatchSort ? "newest" : rawSort;
  const viewMode: ViewMode = (searchParams.get("view") as ViewMode) || "list";

  // Build new URL with updated params
  const pushParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        // Remove param if it's the default value
        if (
          v === "" ||
          v === "すべて" ||
          (k === "sort" && v === defaultSort) ||
          (k === "view" && v === "list")
        ) {
          params.delete(k);
        } else {
          params.set(k, v);
        }
      });
      const qs = params.toString();
      router.push(qs ? `/jobs?${qs}` : "/jobs", { scroll: false });
    },
    [searchParams, router, defaultSort]
  );

  // Current filter values by key
  const currentFilters: Record<string, string> = useMemo(
    () => ({
      category: categoryFilter,
      style: styleFilter,
      salary: salaryFilter,
      location: locationFilter,
    }),
    [categoryFilter, styleFilter, salaryFilter, locationFilter]
  );

  // Base set filtered by query only (for counting per-filter)
  const queryFiltered = useMemo(() => {
    if (!query.trim()) return jobs;
    const q = query.toLowerCase();
    return jobs.filter(
      (j: Job) =>
        j.title?.toLowerCase().includes(q) ||
        j.job_category?.toLowerCase().includes(q) ||
        j.location?.toLowerCase().includes(q) ||
        j.description?.toLowerCase().includes(q) ||
        j.ow_companies?.name?.toLowerCase().includes(q)
    );
  }, [jobs, query]);

  // Count for a chip: apply all OTHER filters except the one being counted
  const chipCounts = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {};
    for (const { key } of FILTER_DEFS) {
      counts[key] = {};
      // Get the other filter keys
      const otherKeys = FILTER_DEFS.map((d) => d.key).filter((k) => k !== key);
      // Filter by other active filters
      const baseForThis = queryFiltered.filter((j: Job) =>
        otherKeys.every((ok) => MATCHERS[ok](j, currentFilters[ok]))
      );
      // Get the chip list for this key
      const chips = FILTER_DEFS.find((d) => d.key === key)!.chips;
      for (const chip of chips) {
        if (chip === "すべて") {
          counts[key][chip] = baseForThis.length;
        } else {
          counts[key][chip] = baseForThis.filter((j: Job) => MATCHERS[key](j, chip)).length;
        }
      }
    }
    return counts;
  }, [queryFiltered, currentFilters]);

  // Full filtered + sorted results
  const baseFiltered = useMemo(() => {
    let result = queryFiltered;
    result = result.filter((j: Job) => matchesCategoryFilter(j, categoryFilter));
    result = result.filter((j: Job) => matchesStyleFilter(j, styleFilter));
    result = result.filter((j: Job) => matchesSalaryFilter(j, salaryFilter));
    result = result.filter((j: Job) => matchesLocationFilter(j, locationFilter));
    return result;
  }, [queryFiltered, categoryFilter, styleFilter, salaryFilter, locationFilter]);

  const allSorted = useMemo(() => sortJobs(baseFiltered, sortBy), [baseFiltered, sortBy]);
  const totalCount = allSorted.length;

  // Active filters (non-default)
  const activeFilters = useMemo(() => {
    const tags: { key: string; label: string; value: string }[] = [];
    for (const { key, label } of FILTER_DEFS) {
      const v = currentFilters[key];
      if (v && v !== "すべて") {
        tags.push({ key, label, value: v });
      }
    }
    if (query.trim()) {
      tags.push({ key: "q", label: "検索", value: query });
    }
    return tags;
  }, [currentFilters, query]);

  const clearAll = useCallback(() => {
    router.push("/jobs", { scroll: false });
  }, [router]);

  const removeFilter = useCallback(
    (key: string) => {
      if (key === "q") {
        pushParams({ q: "" });
      } else {
        pushParams({ [key]: "すべて" });
      }
    },
    [pushParams]
  );

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
  }

  function handleQueryChange(value: string) {
    pushParams({ q: value });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ─── Page Header ─── */}
      <div style={{ marginBottom: 20, borderLeft: "3px solid #059669", paddingLeft: 12 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
          募集を探す
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280" }}>
          IT/SaaS企業の求人を、職種・勤務地・年収から探せます。
        </p>
      </div>

      {/* ─── 未ログインバナー ─── */}
      {!isLoggedIn && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
          padding: "14px 20px",
          borderRadius: 12,
          background: "#f0faf5",
          border: "1px solid #c6f0dc",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span style={{ fontSize: 14, color: "#1f2937" }}>
              プロフィールを登録すると<strong style={{ color: "#0F6E56" }}>あなたへのマッチ度</strong>が表示されます
            </span>
          </div>
          <Link
            href="/auth/signup"
            style={{
              flexShrink: 0,
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: "#1D9E75",
              padding: "8px 18px",
              borderRadius: 8,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            無料登録（30秒）→
          </Link>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            defaultValue={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="職種・企業名・キーワードで検索"
            className="w-full pl-12 pr-4 bg-white focus:outline-none transition-colors"
            style={{ height: 48, fontSize: 15, color: "#111827", border: "1.5px solid #e5e7eb", borderRadius: 10 }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#059669"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
          />
        </div>
      </form>

      {/* ─── Active Filter Tags ─── */}
      {activeFilters.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {activeFilters.map((tag) => (
            <span
              key={tag.key}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 500,
                background: "#E1F5EE",
                color: "#0F6E56",
                padding: "5px 12px",
                borderRadius: 999,
                border: "1px solid #a7f3d0",
              }}
            >
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 400 }}>{tag.label}:</span>
              {tag.value}
              <button
                onClick={() => removeFilter(tag.key)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "#059669",
                  padding: 0,
                  lineHeight: 1,
                  fontWeight: 700,
                }}
                aria-label={`${tag.value}を解除`}
              >
                ×
              </button>
            </span>
          ))}
          <button
            onClick={clearAll}
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#6b7280",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            条件をすべてクリア
          </button>
        </div>
      )}

      {/* Fix 10: Mobile filter trigger (hidden on md+) */}
      <div className="md:hidden" style={{ marginBottom: 16 }}>
        <button
          onClick={() => setMobileSheetOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "1.5px solid #e5e7eb",
            background: "#fff",
            fontSize: 14,
            fontWeight: 600,
            color: "#0f172a",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="10" y1="18" x2="14" y2="18" />
            </svg>
            絞り込み
            {activeFilters.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#1D9E75", color: "#fff" }}>
                {activeFilters.length}
              </span>
            )}
          </span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{totalCount}件</span>
        </button>
      </div>

      {/* Mobile filter bottom sheet */}
      <MobileFilterSheet
        open={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
        filterDefs={FILTER_DEFS.map((d): FilterDef => ({
          key: d.key,
          label: d.label,
          chips: d.chips as unknown as string[],
          counts: chipCounts[d.key],
        }))}
        current={currentFilters}
        onApply={(next) => {
          // Apply all changed values at once
          const updates: Record<string, string> = {};
          for (const key of Object.keys(next)) {
            updates[key] = next[key];
          }
          pushParams(updates);
        }}
        onClear={() => {
          // Reset all filter params (keep query/view/sort)
          const updates: Record<string, string> = {};
          for (const d of FILTER_DEFS) updates[d.key] = "すべて";
          pushParams(updates);
        }}
      />

      {/* Filter chips (hidden on mobile, replaced by sheet trigger) */}
      <div className="hidden md:flex" style={{ flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {FILTER_DEFS.map(({ key, label, chips }) => {
          const value = currentFilters[key];
          return (
            <div key={key} className="flex items-center flex-wrap" style={{ gap: 12 }}>
              <span className="flex-shrink-0" style={{ fontSize: 14, fontWeight: 600, color: "#374151", minWidth: 48 }}>{label}</span>
              <div className="flex flex-wrap md:flex-wrap" style={{ gap: 8, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" } as any}>
                {chips.filter((chip) => {
                  if (chip === "すべて") return true;
                  const count = chipCounts[key]?.[chip];
                  return count !== undefined && count > 0;
                }).map((chip) => {
                  const count = chipCounts[key]?.[chip];
                  const isActive = value === chip;
                  const isAll = chip === "すべて";
                  return (
                    <button
                      key={chip}
                      onClick={() => pushParams({ [key]: chip })}
                      className="transition-all whitespace-nowrap"
                      style={
                        isActive
                          ? { fontSize: 14, fontWeight: 600, background: "#059669", border: "1.5px solid #059669", color: "#fff", borderRadius: 999, padding: "6px 16px" }
                          : { fontSize: 14, fontWeight: 500, background: "#fff", border: "1.5px solid #d1d5db", color: "#1f2937", borderRadius: 999, padding: "6px 16px" }
                      }
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.borderColor = "#059669";
                          e.currentTarget.style.color = "#059669";
                          e.currentTarget.style.background = "#f0fdf4";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.borderColor = "#d1d5db";
                          e.currentTarget.style.color = "#1f2937";
                          e.currentTarget.style.background = "#fff";
                        }
                      }}
                    >
                      {chip}
                      {!isAll && count !== undefined && (
                        <span style={{
                          marginLeft: 4,
                          fontSize: 12,
                          fontWeight: isActive ? 500 : 400,
                          opacity: isActive ? 0.9 : 0.6,
                        }}>
                          ({count})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-gray-500" style={{ margin: 0 }}>
            厳選 <span className="font-semibold text-gray-800">{totalCount}件</span>の求人
          </p>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0 0" }}>IT/SaaS企業の厳選求人のみ掲載</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex" style={{ gap: 8 }}>
            {SORT_OPTIONS.map((s) => {
              const isMatchSort = s.value === "match";
              const isLocked = isMatchSort && !canMatchSort;
              const isActive = sortBy === s.value && !isLocked;
              const lockTitle = !isLoggedIn
                ? "ログインして確認"
                : !hasProfile
                ? "プロフィール完成でマッチ度表示"
                : undefined;
              return (
                <button
                  key={s.value}
                  onClick={() => {
                    if (isLocked) {
                      router.push(isLoggedIn ? "/profile/setup" : "/auth/login");
                      return;
                    }
                    pushParams({ sort: s.value });
                  }}
                  className="transition-all"
                  title={lockTitle}
                  style={
                    isActive
                      ? { fontSize: 13, fontWeight: 600, background: "#2d7a4f", border: "1px solid #2d7a4f", color: "#fff", borderRadius: 999, padding: "6px 14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }
                      : { fontSize: 13, fontWeight: 500, background: "transparent", border: "1px solid #e0e0e0", color: isLocked ? "#9ca3af" : "#999", borderRadius: 999, padding: "6px 14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }
                  }
                >
                  {isLocked && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  )}
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "0.5px solid #e5e7eb" }}>
            {(["list", "grid"] as const).map((mode, i) => (
              <button
                key={mode}
                onClick={() => pushParams({ view: mode })}
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

      {/* ─── Results (Wantedly 型 JobCard) ─── */}
      {allSorted.length > 0 ? (
        <div
          className={
            viewMode === "list"
              ? "grid grid-cols-1 gap-3.5"
              : "grid grid-cols-1 md:grid-cols-2 gap-3.5"
          }
        >
          {allSorted.map((j: Job) => {
            const company = j.ow_companies || {};
            return (
              <JobCard
                key={j.id}
                job={{
                  id: j.id,
                  title: j.title,
                  job_category: j.job_category ?? null,
                  work_style: j.work_style ?? null,
                  salary_min: j.salary_min ?? null,
                  salary_max: j.salary_max ?? null,
                  main_image_url: j.main_image_url ?? null,
                  catch_copy: j.catch_copy ?? null,
                  one_liner: j.one_liner ?? null,
                  gradient_preset: j.gradient_preset ?? null,
                  company: {
                    id: company.id,
                    name: company.name || "企業名",
                    logo_url: company.logo_url ?? null,
                    url: company.url ?? null,
                    website_url: company.website_url ?? null,
                    phase: company.phase ?? null,
                  },
                  is_favorited: favoriteIds.has(j.id),
                }}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-600 text-[14px] mb-2">求人が見つかりませんでした</p>
          <button
            onClick={clearAll}
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
