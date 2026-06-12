"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Search, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { BookmarkButton } from "./BookmarkButton";

// ─── Types ───────────────────────────────────────────────────────────────────
export type JobRow = {
  id: string;
  title: string;
  job_category: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  location: string | null;
  work_style: string | null;
  status: string;
  published_at: string | null;
  catch_copy: string | null;
  urgency: string | null;
  why_hire: string | null;
};

export type CompanyBasic = {
  id: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  logo_gradient: string | null;
  logo_letter: string | null;
  industry: string | null;
  location: string | null;
  employee_count: number | string | null;
  accepting_casual_meetings: boolean | null;
};

// ─── Salary helper ───────────────────────────────────────────────────────────
function formatSalary(min: number | null, max: number | null): { text: string; known: boolean } {
  if (!min && !max) return { text: "応相談", known: false };
  if (min && max) return { text: `${min}〜${max}万円`, known: true };
  if (min) return { text: `${min}万円〜`, known: true };
  return { text: `〜${max}万円`, known: true };
}

// ─── ⑧ Days-ago helper ──────────────────────────────────────────────────────
function daysAgo(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  const d = Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86400000);
  if (d === 0) return "今日";
  if (d < 7) return `${d}日前`;
  if (d < 30) return `${Math.floor(d / 7)}週間前`;
  return `${Math.floor(d / 30)}ヶ月前`;
}

// ─── Work style labels ───────────────────────────────────────────────────────
const WORK_STYLE_LABELS: Record<string, string> = {
  full_remote: "フルリモート",
  remote: "リモート可",
  hybrid: "ハイブリッド勤務",
  office: "出社",
  flex: "フレックス",
  on_site: "オンサイト",
};

function WorkStyleBadge({ style }: { style: string | null }) {
  if (!style) return null;
  const label = WORK_STYLE_LABELS[style] ?? style;
  const isRemote = label.includes("リモート");
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 11, padding: "2px 8px", borderRadius: 6,
      background: isRemote ? "#f0fdf4" : "var(--bg-tint)",
      color: isRemote ? "var(--success)" : "var(--ink-mute)",
      border: `1px solid ${isRemote ? "#A7F3D0" : "var(--line)"}`,
      fontWeight: 500,
    }}>
      {isRemote ? "🏠" : "🏢"} {label}
    </span>
  );
}

// ─── Chat bubble icon ────────────────────────────────────────────────────────
function ChatIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ─── Chevron icon ────────────────────────────────────────────────────────────
function ChevronRightIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

const PAGE_SIZE = 20;

// ─── Main component ───────────────────────────────────────────────────────────
export function CompanyJobsClient({
  company,
  allJobs,
}: {
  company: CompanyBasic;
  allJobs: JobRow[];
}) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [sort, setSort] = useState<"default" | "salary_high" | "newest">("default");
  const [showCount, setShowCount] = useState(PAGE_SIZE);
  const [mobileOpen, setMobileOpen] = useState(false);
  // ⑤ Sticky CTA visibility
  const [showStickyCta, setShowStickyCta] = useState(false);
  // ⑩ Viewed jobs
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  // ⑩ Load viewed jobs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("opinio-viewed-jobs");
      if (stored) setViewedIds(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  }, []);

  // ⑤ Scroll listener for sticky CTA
  useEffect(() => {
    const onScroll = () => setShowStickyCta(window.scrollY > 280);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ⑩ Mark a job as viewed and persist to localStorage
  const markViewed = useCallback((id: string) => {
    setViewedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("opinio-viewed-jobs", JSON.stringify(Array.from(next)));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Categories sorted by count descending
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    allJobs.forEach((j) => {
      if (j.job_category) map.set(j.job_category, (map.get(j.job_category) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([cat]) => cat);
  }, [allJobs]);

  // Keyword search + category filter + sort
  const filtered = useMemo(() => {
    let jobs = [...allJobs];
    if (query.trim()) {
      const q = query.toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.catch_copy?.toLowerCase().includes(q) ||
          j.job_category?.toLowerCase().includes(q)
      );
    }
    if (selectedCat) jobs = jobs.filter((j) => j.job_category === selectedCat);
    if (sort === "salary_high") {
      jobs.sort(
        (a, b) =>
          (b.salary_max ?? b.salary_min ?? -1) - (a.salary_max ?? a.salary_min ?? -1)
      );
    } else if (sort === "newest") {
      jobs.sort(
        (a, b) =>
          new Date(b.published_at ?? 0).getTime() -
          new Date(a.published_at ?? 0).getTime()
      );
    } else {
      jobs.sort((a, b) => {
        if (a.urgency === "hot" && b.urgency !== "hot") return -1;
        if (b.urgency === "hot" && a.urgency !== "hot") return 1;
        const aHasSal = !!(a.salary_min || a.salary_max) ? 1 : 0;
        const bHasSal = !!(b.salary_min || b.salary_max) ? 1 : 0;
        if (bHasSal !== aHasSal) return bHasSal - aHasSal;
        return (
          new Date(b.published_at ?? 0).getTime() -
          new Date(a.published_at ?? 0).getTime()
        );
      });
    }
    return jobs;
  }, [allJobs, query, selectedCat, sort]);

  function resetAll() {
    setQuery("");
    setSelectedCat("");
    setShowCount(PAGE_SIZE);
  }
  function pickCat(cat: string) {
    setSelectedCat((prev) => (prev === cat ? "" : cat));
    setShowCount(PAGE_SIZE);
    setMobileOpen(false);
  }
  function changeQuery(q: string) {
    setQuery(q);
    setShowCount(PAGE_SIZE);
  }
  function changeSort(s: typeof sort) {
    setSort(s);
    setShowCount(PAGE_SIZE);
  }

  const visible = filtered.slice(0, showCount);
  const hasMore = filtered.length > showCount;
  const activeFilters = (query ? 1 : 0) + (selectedCat ? 1 : 0);
  // ⑦ Count jobs with salary disclosed
  const salaryKnownCount = allJobs.filter((j) => j.salary_min || j.salary_max).length;
  const canMeet = company.accepting_casual_meetings !== false;

  const gradient =
    company.logo_gradient || "linear-gradient(135deg,var(--royal),#3B5FD9)";
  const letter = company.logo_letter || company.name?.[0] || "?";
  // Short company name for CTA buttons (strip 株式会社 prefix)
  const shortName = company.name.replace(/^株式会社/, "").replace(/株式会社$/, "").trim();

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-tint)", paddingTop: 64 }}>

      {/* ── Company banner ─────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 24px 16px" }}>
          <Link
            href={`/companies/${company.id}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 13, color: "var(--ink-mute)", textDecoration: "none",
              marginBottom: 14,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            企業詳細に戻る
          </Link>

          {/* Logo + name + right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                style={{ width: 52, height: 52, borderRadius: 12, objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                background: gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 22, fontWeight: 700,
                fontFamily: "var(--font-noto-serif)",
              }}>
                {letter}
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: 20, fontWeight: 700,
                color: "var(--ink)", margin: 0, lineHeight: 1.3,
              }}>
                {company.name}の求人一覧
              </h1>
              <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                {company.industry && (
                  <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{company.industry}</span>
                )}
                {company.location && (
                  <span style={{ fontSize: 13, color: "var(--ink-soft)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <MapPin size={13} color="#6B7280" />{company.location}
                  </span>
                )}
              </div>
            </div>

            {/* ④ Right: job count badge + talk CTA */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
              <div style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 13, fontWeight: 700,
                color: "var(--royal)",
                background: "var(--royal-50)",
                border: "1px solid var(--royal-100)",
                borderRadius: 8, padding: "6px 14px",
              }}>
                {allJobs.length}件募集中
              </div>
              {canMeet && (
                <Link
                  href={`/companies/${company.id}/casual-meeting`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "7px 14px", borderRadius: 8,
                    background: "linear-gradient(135deg,#F59E0B,#FB923C)",
                    color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none",
                    boxShadow: "0 2px 8px rgba(245,158,11,0.25)", whiteSpace: "nowrap",
                  }}
                >
                  <ChatIcon />
                  話を聞く（無料）
                </Link>
              )}
            </div>
          </div>

          {/* ⑦ Company strengths strip */}
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
            {company.tagline && (
              <span style={{
                fontSize: 13, color: "var(--ink-soft)", fontStyle: "italic",
                flex: "1 1 auto", minWidth: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                「{company.tagline}」
              </span>
            )}
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", flexShrink: 0 }}>
              {canMeet && (
                <span style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 100,
                  background: "linear-gradient(135deg,#FEF3C7,#FDE68A)",
                  color: "#92400E", border: "1px solid #FDE68A", fontWeight: 700,
                }}>
                  💬 面談受付中
                </span>
              )}
              {salaryKnownCount > 0 && (
                <span style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 100,
                  background: "#F0FDF4", color: "var(--success)",
                  border: "1px solid #A7F3D0", fontWeight: 700,
                }}>
                  💴 年収公開 {salaryKnownCount}件
                </span>
              )}
              <span style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 100,
                background: "var(--royal-50)", color: "var(--royal)",
                border: "1px solid var(--royal-100)", fontWeight: 700,
              }}>
                ✍ OPINIO掲載企業
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ③ Sticky filter bar (pills wrap on desktop) ────────────────────── */}
      <div style={{
        position: "sticky", top: 64, zIndex: 100,
        background: "#fff", borderBottom: "1px solid var(--line)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "10px 24px 8px" }}>

          {/* Row 1: search + sort + mobile toggle */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search
                size={14} color="#9CA3AF"
                style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              />
              <input
                type="text"
                placeholder="タイトル・スキルで検索..."
                value={query}
                onChange={(e) => changeQuery(e.target.value)}
                style={{
                  width: "100%", padding: "8px 30px 8px 33px",
                  fontSize: 13, border: "1.5px solid var(--line)", borderRadius: 8,
                  background: "var(--bg-tint)", outline: "none", boxSizing: "border-box",
                }}
              />
              {query && (
                <button
                  onClick={() => changeQuery("")}
                  style={{
                    position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--ink-mute)", padding: 2, display: "flex",
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div style={{ position: "relative", flexShrink: 0 }}>
              <select
                value={sort}
                onChange={(e) => changeSort(e.target.value as typeof sort)}
                style={{
                  appearance: "none" as const,
                  padding: "8px 28px 8px 12px", fontSize: 12,
                  border: "1.5px solid var(--line)", borderRadius: 8,
                  background: "var(--bg-tint)", cursor: "pointer",
                  fontWeight: 600, color: "var(--ink)",
                }}
              >
                <option value="default">おすすめ順</option>
                <option value="salary_high">年収が高い順</option>
                <option value="newest">新着順</option>
              </select>
              <ChevronDown
                size={12} color="#6B7280"
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              />
            </div>

            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="job-mobile-filter-btn"
              style={{
                alignItems: "center", gap: 4, padding: "8px 12px", borderRadius: 8,
                border: `1.5px solid ${selectedCat ? "var(--royal)" : "var(--line)"}`,
                background: selectedCat ? "var(--royal-50)" : "var(--bg-tint)",
                color: selectedCat ? "var(--royal)" : "var(--ink)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              <SlidersHorizontal size={13} />
              絞り込む{activeFilters > 0 ? ` (${activeFilters})` : ""}
            </button>
          </div>

          {/* ③ Category pills — wrap on desktop (CSS updated), toggle on mobile */}
          {categories.length > 1 && (
            <div className={`job-filter-pills${mobileOpen ? " open" : ""}`}>
              {[
                { cat: "", label: `すべて（${allJobs.length}）` },
                ...categories.map((cat) => ({
                  cat,
                  label: `${cat}（${allJobs.filter((j) => j.job_category === cat).length}）`,
                })),
              ].map(({ cat, label }) => (
                <button
                  key={cat}
                  onClick={() => pickCat(cat)}
                  style={{
                    padding: "5px 14px", borderRadius: 100,
                    fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer",
                    border: `1.5px solid ${selectedCat === cat ? "var(--royal)" : "var(--line)"}`,
                    background: selectedCat === cat ? "var(--royal)" : "#fff",
                    color: selectedCat === cat ? "#fff" : "var(--ink-soft)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Result count + reset */}
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 8 }}>
            <span>
              {query || selectedCat ? (
                <>
                  <strong style={{ color: "var(--royal)" }}>{filtered.length}件</strong> 該当
                </>
              ) : (
                <>全 <strong>{allJobs.length}件</strong> の求人</>
              )}
            </span>
            {(query || selectedCat) && (
              <button
                onClick={resetAll}
                style={{
                  fontSize: 11, color: "var(--error)", background: "none",
                  border: "none", cursor: "pointer", textDecoration: "underline", padding: 0,
                }}
              >
                リセット
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Job list with pagination ─────────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 24px 100px" }}>
        {filtered.length === 0 ? (
          /* ⑨ Enhanced empty state with casual meeting CTA */
          <div style={{
            textAlign: "center", padding: "56px 24px 64px",
            background: "#fff", border: "1px solid var(--line)", borderRadius: 16,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-soft)", margin: 0 }}>
              {query
                ? `「${query}」に一致する求人が見つかりませんでした`
                : `${selectedCat} の求人は現在掲載されていません`}
            </p>
            <p style={{ fontSize: 13, color: "var(--ink-mute)", marginTop: 8, marginBottom: 0 }}>
              求人票にない情報は、社員に直接話を聞くのが一番早いです
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
              <button
                onClick={resetAll}
                style={{
                  padding: "9px 20px", borderRadius: 8,
                  border: "1px solid var(--line)", background: "#fff",
                  cursor: "pointer", fontSize: 13, fontWeight: 600,
                }}
              >
                すべての求人を表示
              </button>
              {canMeet && (
                <Link
                  href={`/companies/${company.id}/casual-meeting`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "9px 20px", borderRadius: 8,
                    background: "linear-gradient(135deg,#F59E0B,#FB923C)",
                    color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none",
                  }}
                >
                  <ChatIcon />
                  {shortName}に話を聞く（無料）
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visible.map((job) => {
                const sal = formatSalary(job.salary_min, job.salary_max);
                const isHot = job.urgency === "hot";
                const isNewJob =
                  !!job.published_at &&
                  Date.now() - new Date(job.published_at).getTime() < 7 * 86400000;
                // ⑩ Viewed state
                const isViewed = viewedIds.has(job.id);
                // ⑧ Days ago
                const ago = daysAgo(job.published_at);

                return (
                  /* ⑥ Entire card is clickable */
                  <div
                    key={job.id}
                    className="company-job-card"
                    tabIndex={0}
                    role="button"
                    aria-label={`${job.title}の詳細を見る`}
                    onClick={() => { markViewed(job.id); router.push(`/jobs/${job.id}`); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        markViewed(job.id);
                        router.push(`/jobs/${job.id}`);
                      }
                    }}
                    style={{
                      display: "flex", gap: 0,
                      border: `1px solid ${isHot ? "#FED7AA" : "var(--line)"}`,
                      borderRadius: 14,
                      background: isHot ? "linear-gradient(to right,#FFFBF0,#fff)" : "#fff",
                      overflow: "hidden",
                      cursor: "pointer",
                      // ⑩ Dim viewed cards slightly
                      opacity: isViewed ? 0.75 : 1,
                      outline: "none",
                    }}
                  >
                    {/* Left accent bar */}
                    <div style={{
                      width: 4, flexShrink: 0,
                      background: isHot
                        ? "linear-gradient(to bottom,#F59E0B,#FB923C)"
                        : sal.known
                        ? "var(--success)"
                        : "var(--royal)",
                      opacity: isHot || sal.known ? 1 : 0.35,
                    }} />

                    <div style={{ flex: 1, padding: "16px 20px 14px", minWidth: 0 }}>
                      {/* ⑧ Badges row + days-ago timestamp */}
                      <div style={{
                        display: "flex", gap: 5, marginBottom: 6,
                        flexWrap: "wrap", alignItems: "center",
                        justifyContent: "space-between",
                      }}>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                          {isHot && (
                            <span style={{
                              fontSize: 10, padding: "2px 8px", borderRadius: 4,
                              background: "#FFF7ED", color: "#C2410C",
                              border: "1px solid #FED7AA", fontWeight: 700,
                            }}>
                              🔥 急募
                            </span>
                          )}
                          {isNewJob && !isHot && (
                            <span style={{
                              fontSize: 10, padding: "2px 8px", borderRadius: 4,
                              background: "#ECFDF5", color: "var(--success)",
                              border: "1px solid #A7F3D0", fontWeight: 700,
                            }}>
                              新着
                            </span>
                          )}
                          {sal.known && (
                            <span style={{
                              fontSize: 10, padding: "2px 7px", borderRadius: 4,
                              background: "#F0FDF4", color: "var(--success)",
                              border: "1px solid #A7F3D0", fontWeight: 700,
                            }}>
                              年収公開
                            </span>
                          )}
                          {/* ⑩ Viewed badge */}
                          {isViewed && (
                            <span style={{
                              fontSize: 10, padding: "2px 7px", borderRadius: 4,
                              background: "var(--bg-tint)", color: "var(--ink-mute)",
                              border: "1px solid var(--line)", fontWeight: 500,
                            }}>
                              閲覧済
                            </span>
                          )}
                        </div>
                        {/* ⑧ Days ago timestamp */}
                        {ago && (
                          <span style={{ fontSize: 11, color: "var(--ink-mute)", flexShrink: 0 }}>
                            {ago}更新
                          </span>
                        )}
                      </div>

                      {/* Title + ⑥ Bookmark (stops propagation) */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                        <h2 style={{
                          flex: 1, fontSize: 15, fontWeight: 700,
                          color: "var(--ink)", margin: 0, lineHeight: 1.4,
                        }}>
                          {job.title}
                        </h2>
                        <div onClick={(e) => e.stopPropagation()}>
                          <BookmarkButton jobId={job.id} />
                        </div>
                      </div>

                      {/* catch_copy subtitle */}
                      {job.catch_copy && (
                        <p style={{
                          fontSize: 13, color: "var(--ink-soft)",
                          margin: "0 0 10px", lineHeight: 1.55,
                        }}>
                          {job.catch_copy}
                        </p>
                      )}

                      {/* Tags */}
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                        {job.job_category && (
                          <span style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 6,
                            background: "var(--royal-50)", color: "var(--royal)",
                            border: "1px solid var(--royal-100)", fontWeight: 600,
                          }}>
                            {job.job_category}
                          </span>
                        )}
                        <WorkStyleBadge style={job.work_style} />
                        {job.employment_type && (
                          <span style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 6,
                            background: "var(--bg-tint)", color: "var(--ink-mute)",
                            border: "1px solid var(--line)", fontWeight: 500,
                          }}>
                            {job.employment_type}
                          </span>
                        )}
                        {job.location && job.location !== company.location && (
                          <span style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 6,
                            background: "var(--bg-tint)", color: "var(--ink-mute)",
                            border: "1px solid var(--line)", fontWeight: 500,
                            display: "inline-flex", alignItems: "center", gap: 3,
                          }}>
                            <MapPin size={10} color="#6B7280" />{job.location}
                          </span>
                        )}
                        {job.why_hire && (
                          <span style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 6,
                            background: "var(--purple-soft,#F3E8FF)", color: "var(--purple,#7C3AED)",
                            border: "1px solid #DDD6FE", fontWeight: 500,
                            maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {(job.why_hire as string).slice(0, 20)}{(job.why_hire as string).length > 20 ? "…" : ""}
                          </span>
                        )}
                      </div>

                      {/* ① Salary + ④ single CTA (カード内は「詳細を見る」のみ) */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                          <span style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 600 }}>年収</span>
                          <span style={{
                            fontFamily: "Inter, sans-serif",
                            fontSize: sal.known ? 16 : 13,
                            fontWeight: 700,
                            color: sal.known ? "var(--success)" : "var(--ink-mute)",
                          }}>
                            {sal.text}
                          </span>
                        </div>
                        <div style={{ flex: 1 }} />
                        {/* ⑥ Filled royal blue CTA (visual only — card onClick handles navigation) */}
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "7px 16px", borderRadius: 8,
                          background: "var(--royal)", color: "#fff",
                          fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                          pointerEvents: "none",
                        }}>
                          詳細を見る <ChevronRightIcon />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* もっと見る */}
            {hasMore && (
              <div style={{ textAlign: "center", marginTop: 28 }}>
                <button
                  onClick={() => setShowCount((c) => c + PAGE_SIZE)}
                  style={{
                    padding: "12px 32px", borderRadius: 100,
                    border: "2px solid var(--royal)", background: "#fff",
                    color: "var(--royal)", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  もっと見る（残り{filtered.length - showCount}件）
                </button>
              </div>
            )}
            {!hasMore && filtered.length > PAGE_SIZE && (
              <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "var(--ink-mute)" }}>
                全{filtered.length}件を表示しています
              </p>
            )}
          </>
        )}
      </div>

      {/* ⑤ Sticky CTA — appears after scrolling past banner */}
      {showStickyCta && canMeet && (
        <div className="job-sticky-cta">
          <div style={{
            maxWidth: 960, margin: "0 auto", padding: "0 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.35 }}>
              <span style={{ opacity: 0.8, fontWeight: 400 }}>気になる求人があれば —</span>
              <br />
              {shortName}に直接話を聞けます（無料）
            </div>
            <Link
              href={`/companies/${company.id}/casual-meeting`}
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                padding: "10px 20px", borderRadius: 8,
                background: "linear-gradient(135deg,#F59E0B,#FB923C)",
                color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none",
                boxShadow: "0 2px 10px rgba(245,158,11,0.4)",
              }}
            >
              <ChatIcon />
              話を聞く
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
