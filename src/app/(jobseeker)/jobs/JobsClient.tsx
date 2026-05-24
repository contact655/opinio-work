"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import type { Job } from "@/app/jobs/mockJobData";
import { SALARY_PRESETS } from "@/app/jobs/mockJobData";
import type { Company } from "@/app/companies/mockCompanies";
import { extractPrefecture, PREFECTURES } from "@/lib/utils/location";

// ─── Constants ────────────────────────────────────────────────────────────────

const PER_PAGE = 9;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function freshLabel(days: number): string {
  if (days === 0) return "今日更新";
  if (days === 1) return "昨日更新";
  if (days <= 7) return `${days}日前更新`;
  if (days <= 14) return "今週更新";
  if (days <= 21) return "先週更新";
  if (days <= 31) return "今月更新";
  return `${Math.floor(days / 7)}週間前更新`;
}

function formatSalary(min: number, max: number): string {
  if (!min && !max) return "応相談";
  if (min && max) return `¥${min}–${max}`;
  if (max) return `〜¥${max}`;
  return `¥${min}〜`;
}

// ─── Dept color map ───────────────────────────────────────────────────────────

const DEPT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  "エンジニア":         { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  "デザイン":           { bg: "#F5F3FF", color: "#7C3AED", border: "#DDD6FE" },
  "PdM / PM":           { bg: "#F5F3FF", color: "#7C3AED", border: "#DDD6FE" },
  "プロダクト":         { bg: "#F5F3FF", color: "#7C3AED", border: "#DDD6FE" },
  "営業":               { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
  "カスタマーサクセス": { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
  "マーケティング":     { bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
  "コーポレート":       { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
  "経営":               { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
};

function getDeptStyle(dept: string) {
  for (const [key, style] of Object.entries(DEPT_COLORS)) {
    if (dept.includes(key)) return style;
  }
  return { bg: "var(--royal-50)", color: "var(--royal)", border: "var(--royal-100)" };
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  companyMap,
  initialBookmarked = false,
}: {
  job: Job;
  companyMap: Map<string, Company>;
  initialBookmarked?: boolean;
}) {
  // ── Hooks must be called before any early return ──
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkAnim, setBookmarkAnim] = useState(false);
  const bookmarkingRef = useRef(false);
  const router = useRouter();

  // Sync when parent loads bookmark state asynchronously
  useEffect(() => {
    // Only update if we're not in the middle of a user interaction
    if (!bookmarkingRef.current) {
      setBookmarked(initialBookmarked);
    }
  }, [initialBookmarked]);

  const company = companyMap.get(job.company_id);

  const handleBookmark = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (bookmarkingRef.current) return;
    bookmarkingRef.current = true;
    const next = !bookmarked;
    setBookmarked(next);
    setBookmarkAnim(true);
    setTimeout(() => setBookmarkAnim(false), 400);
    try {
      const res = await fetch("/api/bookmarks", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "job", target_id: job.id }),
      });
      if (res.status === 401) {
        setBookmarked(!next);
        router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      } else if (!res.ok) {
        setBookmarked(!next); // revert on error
      }
    } catch {
      setBookmarked(!next);
    } finally {
      bookmarkingRef.current = false;
    }
  }, [bookmarked, job.id, router]);

  if (!company) return null;

  const logoLetter = company.logo_letter ?? company.name.charAt(0).toUpperCase();
  const isFresh = job.updated_days_ago <= 7;
  const label = freshLabel(job.updated_days_ago);
  const deptStyle = getDeptStyle(job.dept);

  return (
    <div style={{ position: "relative" }}>
      {/* ブックマークボタン（カード右上に絶対配置） */}
      <button
        onClick={handleBookmark}
        aria-label={bookmarked ? "ブックマーク解除" : "ブックマーク追加"}
        style={{
          position: "absolute", top: 10, right: 10, zIndex: 10,
          width: 32, height: 32, borderRadius: "50%",
          border: "none", cursor: "pointer",
          background: bookmarked ? "#FEF2F2" : "rgba(255,255,255,0.9)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
          transform: bookmarkAnim ? "scale(1.3)" : "scale(1)",
        }}
      >
        <Heart
          size={15}
          strokeWidth={2}
          style={{
            color: bookmarked ? "#e24b4a" : "#94a3b8",
            fill: bookmarked ? "#e24b4a" : "none",
            transition: "all 0.2s",
          }}
        />
      </button>
    <Link
      href={`/jobs/${job.id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "18px 18px 16px",
        textDecoration: "none",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.06)",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
      }}
      className="job-card-link"
    >
      {/* NEW ribbon */}
      {job.is_new && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: -28,
            transform: "rotate(45deg)",
            background: "var(--success)",
            color: "#fff",
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: "0.12em",
            padding: "3px 32px",
            zIndex: 2,
          }}
        >
          NEW
        </div>
      )}

      {/* Head */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          marginBottom: 12,
          paddingRight: job.is_new ? 32 : 0,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            flexShrink: 0,
            background: company.logo_url ? "#f8fafc" : company.gradient,
            border: company.logo_url ? "1px solid var(--line)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 17,
            fontWeight: 700,
            overflow: "hidden",
          }}
        >
          {company.logo_url ? (
            <Image
              src={company.logo_url}
              alt={company.name}
              width={48}
              height={48}
              style={{ objectFit: "contain" }}
            />
          ) : (
            logoLetter
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--ink)",
              lineHeight: 1.4,
              marginBottom: 4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {job.role}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 11.5,
                color: "var(--royal)",
                fontWeight: 600,
              }}
            >
              {company.name}
            </span>
            <span style={{ fontSize: 10, color: "var(--ink-mute)" }}>·</span>
            {isFresh ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 100,
                  background: "var(--success-soft)",
                  color: "var(--success)",
                  border: "1px solid #A7F3D0",
                }}
              >
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "var(--success)",
                    flexShrink: 0,
                  }}
                />
                {label}
              </span>
            ) : (
              <span style={{ fontSize: 10, color: "var(--ink-mute)" }}>
                {label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      {job.tags.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            marginBottom: 10,
          }}
        >
          {job.tags.map((tag) => {
            const isRemote = tag.includes("リモート") || tag === "全国どこでも";
            const isOffice = tag.includes("原則出社") || tag.includes("オフィス");
            const isHybrid = tag.includes("ハイブリッド");
            const isLocation = /都|道|府|県/.test(tag) || tag === "全国";
            const isWorkStyle = isRemote || isOffice || isHybrid;
            // 🔀 はサポートが不安定なため 🏡 (ハイブリッド) に変更
            const icon = isRemote ? "🏠" : isOffice ? "🏢" : isHybrid ? "🏡" : isLocation ? "📍" : "";
            return (
              <span
                key={tag}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  padding: "3px 8px",
                  borderRadius: 100,
                  background: isRemote
                    ? "var(--success-soft)"
                    : isWorkStyle
                    ? "#F0F4FF"
                    : isLocation
                    ? "var(--bg-tint)"
                    : "var(--bg-tint)",
                  color: isRemote
                    ? "var(--success)"
                    : isWorkStyle
                    ? "#3B5FD9"
                    : "var(--ink-soft)",
                  border: `1px solid ${
                    isRemote ? "#A7F3D0" : isWorkStyle ? "#C7D7F9" : "var(--line)"
                  }`,
                  fontWeight: isWorkStyle ? 600 : 500,
                }}
              >
                {icon && (
                  <span style={{ fontSize: 11, lineHeight: 1 }}>{icon}</span>
                )}
                {tag}
              </span>
            );
          })}
        </div>
      )}


      {/* Highlight */}
      {job.highlight && (
        <p
          style={{
            fontSize: 12,
            color: "var(--ink-soft)",
            lineHeight: 1.7,
            flex: 1,
            marginBottom: 14,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {job.highlight}
        </p>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 12,
          borderTop: "1px solid var(--line-soft,#F1F5F9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Dept badge */}
          {job.dept && (
            <span style={{
              display: "inline-flex", alignItems: "center",
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
              background: deptStyle.bg, color: deptStyle.color, border: `1px solid ${deptStyle.border}`,
              letterSpacing: "0.02em", width: "fit-content",
            }}>
              {job.dept}
            </span>
          )}
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 15,
              fontWeight: (job.salary_min || job.salary_max) ? 700 : 400,
              color: (job.salary_min || job.salary_max) ? "var(--success)" : "var(--ink-mute)",
            }}
          >
            {formatSalary(job.salary_min, job.salary_max)}
            {(job.salary_min || job.salary_max) && (
              <span style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 400, marginLeft: 2 }}>万円</span>
            )}
          </div>
        </div>
        <span
          style={{
            fontSize: 12,
            color: "var(--royal)",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 3,
            flexShrink: 0,
          }}
        >
          詳細を見る
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </div>
    </Link>
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  current,
  total,
  onPage,
}: {
  current: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (total <= 1) return null;
  const pages = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 6,
        marginTop: 32,
      }}
    >
      <button
        onClick={() => onPage(current - 1)}
        disabled={current === 1}
        style={{
          padding: "8px 14px",
          border: "1px solid var(--line)",
          borderRadius: 8,
          background: "#fff",
          color: current === 1 ? "var(--ink-mute)" : "var(--ink)",
          cursor: current === 1 ? "default" : "pointer",
          fontSize: 13,
          opacity: current === 1 ? 0.4 : 1,
        }}
      >
        ← 前へ
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPage(p)}
          style={{
            padding: "8px 14px",
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: p === current ? "var(--royal)" : "#fff",
            color: p === current ? "#fff" : "var(--ink)",
            fontFamily: "Inter, sans-serif",
            fontWeight: p === current ? 700 : 400,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPage(current + 1)}
        disabled={current === total}
        style={{
          padding: "8px 14px",
          border: "1px solid var(--line)",
          borderRadius: 8,
          background: "#fff",
          color: current === total ? "var(--ink-mute)" : "var(--ink)",
          cursor: current === total ? "default" : "pointer",
          fontSize: 13,
          opacity: current === total ? 0.4 : 1,
        }}
      >
        次へ →
      </button>
    </div>
  );
}

// ─── Main client component ─────────────────────────────────────────────────────

export default function JobsClient({
  jobs: allJobs,
  companies,
  parentRoles,
}: {
  jobs: Job[];
  companies: Company[];
  parentRoles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = searchParams.get("category") ?? "";
  const dept = searchParams.get("dept") ?? "";       // 後方互換 (新規 URL では未使用)
  const work_style = searchParams.get("work_style") ?? "";
  const salary = searchParams.get("salary") ?? "";
  const industry = searchParams.get("industry") ?? "";
  const prefecture = searchParams.get("prefecture") ?? "";
  const sort = searchParams.get("sort") ?? "updated";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  // Local-only keyword search
  const [q, setQ] = useState("");

  // Bookmarks: load once on mount
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch("/api/bookmarks?target_type=job")
      .then((r) => r.ok ? r.json() : { ids: [] })
      .then((data: { ids?: string[] }) => {
        if (data.ids) setBookmarkedIds(new Set(data.ids));
      })
      .catch(() => {/* not logged in or network error — silently ignore */});
  }, []);

  // Build Map for fast company lookup
  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );

  // Derive unique industry values from loaded companies
  const industries = useMemo(
    () =>
      Array.from(new Set(companies.map((c) => c.industry).filter(Boolean))).sort(),
    [companies]
  );

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.replace(`/jobs?${params.toString()}`);
  }

  function goPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.replace(`/jobs?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 実データに含まれる都道府県のみ (北から南順)
  const availablePrefectures = useMemo(() => {
    const prefSet = new Set<string>();
    allJobs.forEach((j) => {
      const p = extractPrefecture(j.location);
      if (p) prefSet.add(p);
    });
    return PREFECTURES.filter((p) => prefSet.has(p));
  }, [allJobs]);

  const filtered = useMemo(() => {
    let list = [...allJobs];

    if (q.trim()) {
      const lq = q.trim().toLowerCase();
      list = list.filter(
        (j) =>
          j.role.toLowerCase().includes(lq) ||
          (companyMap.get(j.company_id)?.name ?? "").toLowerCase().includes(lq) ||
          j.highlight.toLowerCase().includes(lq)
      );
    }

    // ow_roles 親カテゴリフィルタ (role_category_id が親 UUID に直接紐づく前提)
    if (category) list = list.filter((j) => j.role_category_id === category);

    // 旧 dept フィルタ (後方互換、URLに ?dept= が残っている場合)
    if (!category && dept) list = list.filter((j) => j.dept === dept);

    if (work_style) {
      list = list.filter(
        (j) =>
          j.work_style === work_style ||
          j.tags.some((t) => t.includes(work_style))
      );
    }

    if (salary) {
      const min = parseInt(salary, 10);
      if (!isNaN(min)) {
        // Exclude jobs with null/0 salary_max (option A: exclude when filtering)
        list = list.filter((j) => j.salary_max > 0 && j.salary_max >= min);
      }
    }

    if (industry) {
      const companyIds = companies
        .filter((c) => c.industry === industry)
        .map((c) => c.id);
      list = list.filter((j) => companyIds.includes(j.company_id));
    }

    // 都道府県フィルタ (job.location から抽出した都道府県と完全一致)
    if (prefecture) {
      list = list.filter((j) => extractPrefecture(j.location) === prefecture);
    }

    if (sort === "salary") {
      list = [...list].sort((a, b) => b.salary_max - a.salary_max);
    } else {
      list = [...list].sort((a, b) => a.updated_days_ago - b.updated_days_ago);
    }

    return list;
  }, [allJobs, q, category, dept, work_style, salary, industry, prefecture, sort, companies, companyMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const newThisWeek = allJobs.filter((j) => j.updated_days_ago <= 7).length;
  const hasFilter = !!(category || dept || work_style || salary || industry || prefecture);

  return (
    <>
      {/* Page header */}
      <div
        style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}
      >
        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          className="px-5 py-6 md:px-12"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexShrink: 0 }}>
              <h1
                style={{
                  fontFamily: 'var(--font-noto-serif)',
                  fontSize: "clamp(22px,2.5vw,28px)",
                  fontWeight: 500,
                  color: "var(--ink)",
                  letterSpacing: "0.02em",
                }}
              >
                求人を、見つける。
              </h1>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "var(--ink-mute)" }}>
                <strong style={{ color: "var(--royal)", fontSize: 18, fontWeight: 700 }}>
                  {allJobs.length.toLocaleString()}
                </strong>
                件
              </span>
            </div>
            {newThisWeek > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--ink-mute)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                今週新着 <strong style={{ color: "var(--ink)" }}>{newThisWeek}件</strong>
              </div>
            )}
          </div>

          {/* ── Search bar ── */}
          <div style={{ position: "relative", maxWidth: 520 }}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--ink-mute)" strokeWidth={2.2} strokeLinecap="round"
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="職種・企業名・スキルで検索…"
              style={{
                width: "100%",
                padding: "10px 14px 10px 40px",
                fontSize: 14,
                border: "1.5px solid var(--line)",
                borderRadius: 10,
                outline: "none",
                background: "#fff",
                color: "var(--ink)",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              className="job-search-input"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--ink-mute)", fontSize: 16, padding: "4px",
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)" }}>
        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          className="px-5 md:px-12"
        >
          <div
            style={{
              padding: "10px 0",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {/* すべて */}
            <button
              onClick={() => setParam("category", "")}
              style={{
                padding: "6px 16px",
                borderRadius: 999,
                border: `1.5px solid ${!category ? "var(--royal)" : "var(--line)"}`,
                background: !category ? "var(--royal)" : "#fff",
                color: !category ? "#fff" : "var(--ink-soft)",
                fontSize: 13,
                fontWeight: !category ? 600 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "background 0.12s, border-color 0.12s, color 0.12s",
              }}
            >
              すべて
            </button>

            {parentRoles.map((role) => {
              const active = category === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setParam("category", role.id)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 999,
                    border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`,
                    background: active ? "var(--royal)" : "#fff",
                    color: active ? "#fff" : "var(--ink-soft)",
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "background 0.12s, border-color 0.12s, color 0.12s",
                  }}
                >
                  {role.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div
        style={{
          position: "sticky",
          top: 64,
          zIndex: 50,
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          className="px-5 md:px-12"
        >
          <div
            style={{
              padding: "10px 0",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
              {/* 勤務形態ピル */}
            {(["フルリモート", "ハイブリッド", "フレックス"] as const).map((ws) => {
              const isActive = work_style === ws;
              return (
                <button
                  key={ws}
                  onClick={() => setParam("work_style", isActive ? "" : ws)}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 999,
                    border: `1.5px solid ${isActive ? "var(--royal)" : "var(--line)"}`,
                    background: isActive ? "var(--royal)" : "#fff",
                    color: isActive ? "#fff" : "var(--ink-soft)",
                    fontSize: 12.5,
                    fontWeight: isActive ? 700 : 400,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "background 0.12s, border-color 0.12s, color 0.12s",
                    fontFamily: "inherit",
                  }}
                >
                  {ws}
                </button>
              );
            })}

            <div style={{ width: 1, height: 18, background: "var(--line)", flexShrink: 0 }} />

            {/* Salary filter */}
            <select
              value={salary}
              onChange={(e) => setParam("salary", e.target.value)}
              style={{
                padding: "5px 10px",
                border: `1.5px solid ${salary ? "var(--royal)" : "var(--line)"}`,
                borderRadius: 8,
                background: salary ? "var(--royal-50)" : "#fff",
                color: salary ? "var(--royal)" : "var(--ink-soft)",
                fontSize: 12.5,
                cursor: "pointer",
                outline: "none",
                fontWeight: salary ? 600 : 400,
                fontFamily: "inherit",
                appearance: "none" as const,
                WebkitAppearance: "none" as const,
                paddingRight: 28,
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b95a3' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
              }}
            >
              <option value="">年収指定なし</option>
              {SALARY_PRESETS.map((s) => (
                <option key={s} value={String(s)}>
                  {s}万〜
                </option>
              ))}
            </select>

            {/* Industry filter */}
            <select
              value={industry}
              onChange={(e) => setParam("industry", e.target.value)}
              style={{
                padding: "5px 10px",
                border: `1.5px solid ${industry ? "var(--royal)" : "var(--line)"}`,
                borderRadius: 8,
                background: industry ? "var(--royal-50)" : "#fff",
                color: industry ? "var(--royal)" : "var(--ink-soft)",
                fontSize: 12.5,
                cursor: "pointer",
                outline: "none",
                fontWeight: industry ? 600 : 400,
                fontFamily: "inherit",
                appearance: "none" as const,
                WebkitAppearance: "none" as const,
                paddingRight: 28,
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b95a3' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
              }}
            >
              <option value="">すべての業界</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>

            {/* 都道府県 filter */}
            {availablePrefectures.length > 0 && (
              <select
                value={prefecture}
                onChange={(e) => setParam("prefecture", e.target.value)}
                style={{
                  padding: "5px 10px",
                  border: `1.5px solid ${prefecture ? "var(--royal)" : "var(--line)"}`,
                  borderRadius: 8,
                  background: prefecture ? "var(--royal-50)" : "#fff",
                  color: prefecture ? "var(--royal)" : "var(--ink-soft)",
                  fontSize: 12.5,
                  cursor: "pointer",
                  outline: "none",
                  fontWeight: prefecture ? 600 : 400,
                  fontFamily: "inherit",
                  appearance: "none" as const,
                  WebkitAppearance: "none" as const,
                  paddingRight: 28,
                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b95a3' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 8px center",
                }}
                aria-label="都道府県で絞り込み"
              >
                <option value="">都道府県</option>
                {availablePrefectures.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}

            {hasFilter && (
              <button
                onClick={() => {
                  setQ("");
                  router.replace("/jobs");
                }}
                style={{
                  padding: "5px 10px",
                  border: "none",
                  background: "none",
                  color: "var(--ink-mute)",
                  fontSize: 12,
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontFamily: "inherit",
                }}
              >
                リセット
              </button>
            )}

            <div style={{ flex: 1 }} />

            {/* Result count */}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: hasFilter ? "4px 12px" : "0",
              borderRadius: 100, whiteSpace: "nowrap",
              background: hasFilter ? "var(--royal-50)" : "transparent",
              border: hasFilter ? "1px solid var(--royal-100)" : "none",
              transition: "all 0.2s",
            }}>
              <strong style={{ color: "var(--royal)", fontSize: 15, fontFamily: "Inter, sans-serif" }}>
                {filtered.length}
              </strong>
              <span style={{ fontSize: 12.5, color: hasFilter ? "var(--royal)" : "var(--ink-mute)" }}>
                {hasFilter ? "件 該当" : "件"}
              </span>
            </span>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setParam("sort", e.target.value)}
              style={{
                padding: "5px 10px",
                border: "1.5px solid var(--line)",
                borderRadius: 8,
                background: "#fff",
                fontSize: 12.5,
                color: "var(--ink-soft)",
                cursor: "pointer",
                outline: "none",
                fontFamily: "inherit",
                appearance: "none" as const,
                WebkitAppearance: "none" as const,
                paddingRight: 28,
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b95a3' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
              }}
            >
              <option value="updated">新着順</option>
              <option value="salary">年収順</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <main style={{ background: "var(--bg-tint)" }}>
        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          className="px-5 py-8 md:px-12 md:py-10"
        >
          {paged.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "48px 24px", background: "#fff",
              borderRadius: 16, border: "1px solid var(--line)", marginTop: 20,
            }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>条件に合う求人が見つかりませんでした</h3>
              <p style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 20 }}>フィルター条件を変えるか、先輩メンターに直接聞いてみましょう</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => router.replace("/jobs")} style={{
                  padding: "10px 24px", borderRadius: 8, background: "var(--royal)",
                  color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}>
                  すべてリセット
                </button>
                <Link href="/mentors" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "10px 20px", borderRadius: 8,
                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                  color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none",
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  先輩に相談する
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {paged.map((job) => (
                  <JobCard key={job.id} job={job} companyMap={companyMap} initialBookmarked={bookmarkedIds.has(job.id)} />
                ))}
              </div>
              <Pagination
                current={safePage}
                total={totalPages}
                onPage={goPage}
              />

              {/* ── メンター相談 CTA ── */}
              <div style={{
                marginTop: 48, padding: "28px 32px",
                background: "linear-gradient(135deg, #001A4D 0%, #002366 60%, #1D4ED8 100%)",
                borderRadius: 16,
                display: "flex", flexDirection: "column", alignItems: "center",
                textAlign: "center",
                position: "relative", overflow: "hidden",
              }}>
                {/* 背景デコ */}
                <div style={{
                  position: "absolute", top: -30, right: -30,
                  width: 180, height: 180, borderRadius: "50%",
                  background: "rgba(255,255,255,0.04)",
                  pointerEvents: "none",
                }} />
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.55)", marginBottom: 10, textTransform: "uppercase" as const }}>
                  OPINIO独自の機能
                </div>
                <h3 style={{
                  fontFamily: "var(--font-noto-serif)",
                  fontSize: "clamp(16px,2.5vw,20px)", fontWeight: 500,
                  color: "#fff", marginBottom: 10, lineHeight: 1.5,
                }}>
                  気になる求人を見つけたら、<br />その職種の先輩に話を聞いてみよう。
                </h3>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.75, marginBottom: 22, maxWidth: 480 }}>
                  「応募前にもっとリアルな声を聞きたい」なら、OPINIO編集部が紹介する先輩メンターに30分相談できます。営業される心配ゼロ・完全無料。
                </p>
                <Link href="/mentors" style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 28px",
                  background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                  color: "#fff", borderRadius: 8, textDecoration: "none",
                  fontSize: 14, fontWeight: 700,
                  boxShadow: "0 4px 16px rgba(245,158,11,0.35)",
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  先輩メンターを見てみる（無料）
                </Link>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 12 }}>
                  OPINIO編集部が個別に声がけした厳選メンターのみ掲載
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      <style>{`
        .job-card-link:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 6px 16px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.08) !important;
          transform: translateY(-2px) !important;
        }
      `}</style>
    </>
  );
}
