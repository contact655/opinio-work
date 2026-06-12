"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import type { Job } from "@/app/jobs/mockJobData";
import { showToast } from "@/lib/toast";
import type { CompanyAlumniPreview } from "@/lib/supabase/queries";
const SALARY_PILL_TIERS = [
  { value: "400",  label: "400万〜" },
  { value: "500",  label: "500万〜" },
  { value: "600",  label: "600万〜" },
  { value: "700",  label: "700万〜" },
  { value: "800",  label: "800万〜" },
  { value: "1000", label: "1000万〜" },
  { value: "1200", label: "1200万〜" },
  { value: "1500", label: "1500万〜" },
] as const;
import type { Company } from "@/app/companies/mockCompanies";
import { extractPrefecture, PREFECTURES } from "@/lib/utils/location";

// ─── Constants ────────────────────────────────────────────────────────────────

const PER_PAGE = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// freshLabel is now only used as fallback; badge rendering is inline
function freshBadge(days: number): { label: string; bg: string; color: string; border: string } | null {
  if (days === 0) return { label: "🔥 今日", bg: "#FEE2E2", color: "#DC2626", border: "#FECACA" };
  if (days <= 3) return { label: "NEW", bg: "var(--success)", color: "#fff", border: "transparent" };
  if (days <= 7) return { label: "今週", bg: "var(--royal-50)", color: "var(--royal)", border: "var(--royal-100)" };
  return null;
}

function formatSalary(min: number, max: number): string {
  if (!min && !max) return "応相談";
  if (min && max) return `${min}〜${max}万円`;
  if (max) return `〜${max}万円`;
  return `${min}万円〜`;
}

// ⑧ 相対時間表示
function timeAgo(days: number): string {
  if (days === 0) return "今日";
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  return `${Math.floor(days / 30)}ヶ月前`;
}

// ③ フェーズバッジ
const PHASE_BADGE_MAP: Record<string, { bg: string; color: string; label: string }> = {
  "Pre-seed":      { bg: "#F1F5F9", color: "#475569", label: "プレシード" },
  "Seed":          { bg: "#FEF3C7", color: "#92400E", label: "シード" },
  "Series A":      { bg: "#D1FAE5", color: "#065F46", label: "シリーズA" },
  "Series B":      { bg: "#DBEAFE", color: "#1E40AF", label: "シリーズB" },
  "Series C":      { bg: "#EDE9FE", color: "#5B21B6", label: "シリーズC" },
  "Series D":      { bg: "#FEE2E2", color: "#991B1B", label: "シリーズD+" },
  "Series E":      { bg: "#FEE2E2", color: "#991B1B", label: "シリーズD+" },
  "東証グロース":  { bg: "#D1FAE5", color: "#065F46", label: "グロース上場" },
  "東証プライム":  { bg: "#ECFDF5", color: "#065F46", label: "プライム上場" },
  "上場 (NASDAQ)": { bg: "#ECFDF5", color: "#065F46", label: "NASDAQ上場" },
  "上場 (NYSE)":   { bg: "#ECFDF5", color: "#065F46", label: "NYSE上場" },
  "上場":          { bg: "#ECFDF5", color: "#065F46", label: "上場" },
  "シード":        { bg: "#FEF3C7", color: "#92400E", label: "シード" },
  "シリーズA":     { bg: "#D1FAE5", color: "#065F46", label: "シリーズA" },
  "シリーズB":     { bg: "#DBEAFE", color: "#1E40AF", label: "シリーズB" },
  "シリーズC":     { bg: "#EDE9FE", color: "#5B21B6", label: "シリーズC" },
  "シリーズD以降": { bg: "#FEE2E2", color: "#991B1B", label: "シリーズD+" },
  "IPO準備中":     { bg: "#FFEDD5", color: "#9A3412", label: "IPO準備中" },
};
function getPhaseBadge(phase: string | null | undefined) {
  if (!phase) return null;
  return PHASE_BADGE_MAP[phase] ?? { bg: "#F1F5F9", color: "#475569", label: phase };
}

// ─── Dept short labels (⑤) ───────────────────────────────────────────────────

const DEPT_SHORT: Record<string, string> = {
  "プロフェッショナルサービス": "プロサービス",
  "カスタマーサクセス":         "CS",
  "テクニカルサポート":         "テクサポ",
  "セールスエンジニア":         "SE",
  "ソリューションエンジニア":   "SE",
  "マーケティング":             "マーケ",
  "プロダクトマネージャー":     "PdM",
  "プロダクト":                 "プロダクト",
  "エンジニア":                 "エンジニア",
  "デザイン":                   "デザイン",
  "コーポレート":               "コーポレート",
  "経営":                       "経営",
  "営業":                       "営業",
};

function shortDept(dept: string): string {
  for (const [key, label] of Object.entries(DEPT_SHORT)) {
    if (dept.includes(key)) return label;
  }
  // 10文字超の場合は先頭8文字 + …
  return dept.length > 10 ? dept.slice(0, 8) + "…" : dept;
}

// ─── Dept color map ───────────────────────────────────────────────────────────

const DEPT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  "エンジニア":         { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  "デザイン":           { bg: "#F5F3FF", color: "#7C3AED", border: "#DDD6FE" },
  "PdM / PM":           { bg: "#F5F3FF", color: "#7C3AED", border: "#DDD6FE" },
  "プロダクト":         { bg: "#F5F3FF", color: "#7C3AED", border: "#DDD6FE" },
  "営業":               { bg: "#ECFDF5", color: "var(--success)", border: "#A7F3D0" },
  "カスタマーサクセス": { bg: "#ECFDF5", color: "var(--success)", border: "#A7F3D0" },
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      } else {
        if (next) {
          showToast(`${job.role} を気になりリストに追加しました`, 'warm');
        } else {
          showToast('気になりリストから削除しました');
        }
      }
    } catch {
      setBookmarked(!next);
    } finally {
      bookmarkingRef.current = false;
    }
  }, [bookmarked, job.id, job.role, router]);

  if (!company) return null;

  const logoLetter = company.logo_letter ?? company.name.charAt(0).toUpperCase();
  const badge = freshBadge(job.updated_days_ago);
  const deptStyle = getDeptStyle(job.dept);

  return (
    <div style={{ position: "relative" }}>
      {/* ブックマークボタン（カード右上に絶対配置） */}
      <button
        type="button"
        onClick={handleBookmark}
        aria-label={bookmarked ? "ブックマーク解除" : "ブックマーク追加"}
        aria-pressed={bookmarked}
        style={{
          position: "absolute", top: 10, right: 10, zIndex: 20,
          width: 32, height: 32, borderRadius: "50%",
          border: "none", cursor: "pointer",
          background: bookmarked ? "#FEF2F2" : "rgba(255,255,255,0.92)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
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
      prefetch={true}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        border: "none",
        borderRadius: 18,
        padding: 0,
        textDecoration: "none",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(15,23,42,0.05), 0 6px 20px rgba(15,23,42,0.07)",
        transition: "box-shadow 0.24s cubic-bezier(0.22,1,0.36,1), transform 0.24s cubic-bezier(0.22,1,0.36,1)",
        willChange: "transform",
      }}
      className="job-card-link"
    >
      {/* ── Gradient header band ── */}
      <div style={{
        height: 60,
        background: "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
        position: "relative",
        flexShrink: 0,
        borderRadius: "18px 18px 0 0",
      }}>
        {/* HOT badge */}
        {job.urgency === "hot" && (
          <span style={{
            position: "absolute", top: 8, left: badge ? 70 : 10, zIndex: 2,
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "2px 7px", borderRadius: 4,
            background: "#FEE2E2", color: "#DC2626",
            fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
            fontFamily: "Inter, sans-serif",
            border: "1px solid #FECACA",
          }}>
            🔥 HOT
          </span>
        )}
        {/* Logo — overlaps bottom of band */}
        <div style={{
          position: "absolute",
          bottom: -20, left: 16,
          width: 44, height: 44,
          borderRadius: 10,
          background: company.logo_url ? "#fff" : "rgba(255,255,255,0.15)",
          border: "2.5px solid rgba(255,255,255,0.9)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 17, fontWeight: 700, overflow: "hidden",
          boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
          zIndex: 3,
        }}>
          {company.logo_url ? (
            <Image
              src={company.logo_url}
              alt={company.name}
              width={44}
              height={44}
              style={{ objectFit: "contain" }}
            />
          ) : logoLetter}
        </div>
        {/* ⑨ 鮮度バッジ（NEW → today / NEW / 今週） */}
        {badge && (
          <span style={{
            position: "absolute", top: 8, left: 10, zIndex: 2,
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "2px 8px", borderRadius: 100,
            background: badge.bg, color: badge.color,
            fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
            fontFamily: "Inter, sans-serif",
            border: `1px solid ${badge.border}`,
          }}>
            {badge.label}
          </span>
        )}
      </div>

      {/* ── Card content ── */}
      <div style={{ padding: "28px 18px var(--space-3)", display: "flex", flexDirection: "column", flex: 1 }}>

      {/* Head */}
      <div style={{ marginBottom: "var(--space-3)" }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--ink)",
              lineHeight: 1.35,
              marginBottom: 5,
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
              role="link"
              tabIndex={0}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/companies/${company.id}`); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); router.push(`/companies/${company.id}`); }}}
              className="company-name-link"
              style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, cursor: "pointer" }}
            >
              {company.name}
            </span>
          </div>
      </div>

      {/* 勤務地 + リモート区分（1行目に明示） */}
      {(job.location || job.work_style) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 10, flexWrap: "wrap",
        }}>
          {job.location && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 12, color: "var(--ink-soft)", fontWeight: 500,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {job.location.split("・")[0].replace(/[（(][^）)]*[）)]/g, "").trim()}
            </span>
          )}
          {job.location && job.work_style && (
            <span style={{ fontSize: 10, color: "var(--line)", userSelect: "none" }}>|</span>
          )}
          {job.work_style && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 12, fontWeight: 600,
              color: job.work_style.includes("リモート") || job.work_style.includes("フルリモート")
                ? "var(--success)" : "var(--ink-soft)",
            }}>
              {job.work_style.includes("リモート") ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
              )}
              {job.work_style}
            </span>
          )}
        </div>
      )}

      {/* Tags（勤務地・リモート以外） */}
      {job.tags.filter((t) => {
        const isWorkStyle = t === job.work_style || t.includes("リモート") || t.includes("原則出社") || t.includes("ハイブリッド");
        const isLocation = job.location ? job.location.split("・")[0] === t : false;
        return !isWorkStyle && !isLocation;
      }).length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            marginBottom: 10,
          }}
        >
          {job.tags.filter((t) => {
            const ws = t === job.work_style || t.includes("リモート") || t.includes("原則出社") || t.includes("ハイブリッド");
            const loc = job.location ? job.location.split("・")[0] === t : false;
            return !ws && !loc;
          }).map((tag) => {
            const isRemote = tag.includes("リモート") || tag === "全国どこでも";
            const isOffice = tag.includes("原則出社") || tag.includes("オフィス");
            const isHybrid = tag.includes("ハイブリッド");
            const isLocation = /都|道|府|県/.test(tag) || tag === "全国";
            const isWorkStyle = isRemote || isOffice || isHybrid;
            const iconEl = isRemote ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            ) : isOffice ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            ) : isHybrid ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            ) : isLocation ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ) : null;
            return (
              <span
                key={tag}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  padding: "3px var(--space-2)",
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
                {iconEl}
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
          paddingTop: "var(--space-3)",
          borderTop: "1px solid var(--line-soft,#F1F5F9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-2)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Dept + Employment type badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {job.dept && (
              <span style={{
                display: "inline-flex", alignItems: "center",
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                background: deptStyle.bg, color: deptStyle.color, border: `1px solid ${deptStyle.border}`,
                letterSpacing: "0.02em",
              }}>
                {job.dept}
              </span>
            )}
            {job.employment_type && job.employment_type !== "正社員" && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
                background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0",
              }}>
                {job.employment_type}
              </span>
            )}
            {company.accepting_casual_meetings && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 100,
                background: "linear-gradient(135deg, #FFF7ED, #FEF3C7)", color: "#C2410C",
                border: "1.5px solid #FDBA74",
                display: "inline-flex", alignItems: "center", gap: 3,
                boxShadow: "0 1px 4px rgba(234,88,12,0.2)",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#EA580C", animation: "pulseDot 1.8s ease-in-out infinite", flexShrink: 0 }} />
                面談受付中
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <div style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 17,
              fontWeight: (job.salary_min || job.salary_max) ? 800 : 400,
              color: (job.salary_min || job.salary_max) ? "var(--success)" : "var(--ink-mute)",
              lineHeight: 1.2,
            }}>
              {formatSalary(job.salary_min, job.salary_max)}
            </div>
            {(job.salary_min || job.salary_max) && (
              <span style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 500 }}>年収</span>
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
          話を聞きに行く
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </div>
      </div>{/* Card content end */}
      {/* hover overlay */}
      <div className="job-card-cta-overlay">
        詳細を見る
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </Link>
    </div>
  );
}

// ─── ⑥ Hover preview panel (desktop only) ────────────────────────────────────

function JobPreviewPanel({
  job,
  companyMap,
}: {
  job: Job | null;
  companyMap: Map<string, Company>;
}) {
  if (!job) return null;
  const company = companyMap.get(job.company_id);
  if (!company) return null;
  const logoLetter = company.logo_letter ?? company.name.charAt(0).toUpperCase();

  return (
    <div className="job-preview-panel" style={{
      position: "fixed", right: 24, top: "50%", transform: "translateY(-50%)",
      width: 300, maxHeight: "70vh", overflowY: "auto",
      background: "#fff", borderRadius: 16,
      boxShadow: "0 20px 60px rgba(0,35,102,0.18), 0 4px 16px rgba(0,35,102,0.1)",
      border: "1.5px solid var(--royal-100)",
      padding: 20, zIndex: 100,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: company.logo_url ? "#f8fafc" : (company.gradient || "linear-gradient(135deg, #001233, #002366)"),
          border: company.logo_url ? "1.5px solid var(--line)" : "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 16, fontWeight: 700, overflow: "hidden",
        }}>
          {company.logo_url
            ? <img src={company.logo_url} alt={company.name} width={44} height={44} style={{ objectFit: "contain" }} />
            : logoLetter}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, marginBottom: 2 }}>{company.name}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {job.role}
          </div>
        </div>
      </div>

      {/* Salary */}
      {(job.salary_min || job.salary_max) && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 20, fontWeight: 800, color: "var(--success)" }}>
            {formatSalary(job.salary_min, job.salary_max)}
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: 4 }}>年収</span>
        </div>
      )}

      {/* Location + work style */}
      {(job.location || job.work_style) && (
        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {job.location && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {job.location.split("・")[0].replace(/[（(][^）)]*[）)]/g, "").trim()}
            </span>
          )}
          {job.work_style && (
            <span style={{ color: job.work_style.includes("リモート") ? "var(--success)" : "var(--ink-soft)", fontWeight: 600 }}>
              {job.work_style}
            </span>
          )}
        </div>
      )}

      {/* Highlight */}
      {job.highlight && (
        <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 16 }}>
          {job.highlight.slice(0, 100)}{job.highlight.length > 100 ? "…" : ""}
        </p>
      )}

      {/* CTA */}
      <Link href={`/jobs/${job.id}`} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "10px 16px", borderRadius: 10,
        background: "var(--royal)", color: "#fff",
        fontSize: 13, fontWeight: 700, textDecoration: "none",
      }}>
        詳細を見る
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </Link>
    </div>
  );
}

// ─── Role color map for colorStyle chips ─────────────────────────────────────

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  "エンジニア":         { color: "#1D4ED8", bg: "#EFF6FF" },
  "デザイン":           { color: "#7C3AED", bg: "#F5F3FF" },
  "プロダクト":         { color: "#7C3AED", bg: "#F5F3FF" },
  "PdM / PM":           { color: "#7C3AED", bg: "#F5F3FF" },
  "営業":               { color: "var(--success)", bg: "#ECFDF5" },
  "カスタマーサクセス": { color: "var(--success)", bg: "#ECFDF5" },
  "マーケティング":     { color: "#B45309", bg: "#FEF3C7" },
  "コーポレート":       { color: "#16A34A", bg: "#F0FDF4" },
  "経営":               { color: "#DC2626", bg: "#FEF2F2" },
};

function getRoleColor(name: string): { color: string; bg: string } {
  for (const [key, style] of Object.entries(ROLE_COLORS)) {
    if (name.includes(key)) return style;
  }
  return { color: "var(--royal)", bg: "var(--royal-50)" };
}

// ─── Filter chip (dropdown) ───────────────────────────────────────────────────

function FilterChip({
  label,
  value,
  options,
  onSelect,
  isOpen,
  onToggle,
  listStyle = false,
  colorStyle = false,
  resultCount,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (v: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
  listStyle?: boolean;
  colorStyle?: boolean;
  resultCount?: number;
}) {
  const isActive = !!value;
  const activeOption = options.find((o) => o.value === value);
  const activeLabel = activeOption?.label;
  const activeRoleColor = colorStyle && activeOption ? getRoleColor(activeOption.label) : null;

  const chipBg = colorStyle && activeRoleColor && isActive
    ? activeRoleColor.bg
    : isActive ? "var(--royal)" : "#fff";
  const chipColor = colorStyle && activeRoleColor && isActive
    ? activeRoleColor.color
    : isActive ? "#fff" : "var(--ink-soft)";
  const chipBorder = colorStyle && activeRoleColor && isActive
    ? activeRoleColor.color
    : isActive ? "var(--royal)" : "#e2e8f0";

  const displayLabel = isActive
    ? (resultCount !== undefined ? `${activeLabel} · ${resultCount}件` : activeLabel)
    : label;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "7px 14px",
          borderRadius: 999,
          border: `1.5px solid ${chipBorder}`,
          background: chipBg,
          color: chipColor,
          fontSize: "var(--text-sm)", fontWeight: isActive ? 700 : 400,
          cursor: "pointer", whiteSpace: "nowrap",
          transition: "all 0.12s",
          fontFamily: "inherit",
        }}
      >
        {isActive && (
          <span style={{ fontSize: 10, fontWeight: 800, marginRight: 1 }}>✓</span>
        )}
        {displayLabel}
        {isActive ? (
          <span
            onClick={(e) => { e.stopPropagation(); onSelect(null); }}
            style={{ fontSize: 10, marginLeft: 1, opacity: 0.85, lineHeight: 1 }}
            aria-label="クリア"
          >
            ✕
          </span>
        ) : (
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }}>
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "#fff",
          border: "1.5px solid var(--royal)",
          borderRadius: 12,
          padding: colorStyle ? "8px" : listStyle ? "8px" : "12px 16px",
          boxShadow: "0 8px 28px rgba(0,35,102,0.14)",
          minWidth: colorStyle ? 230 : listStyle ? 160 : 180,
        }}>
          {/* colorStyle: colored card rows */}
          {colorStyle ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {options.map((o) => {
                const sel = value === o.value;
                const rc = getRoleColor(o.label);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { onSelect(sel ? null : o.value); onToggle(); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1.5px solid ${sel ? rc.color : "transparent"}`,
                      background: sel ? rc.bg : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      transition: "all 0.1s",
                      width: "100%",
                    }}
                    onMouseEnter={(e) => { if (!sel) (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { if (!sel) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: rc.color, flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: "var(--text-sm)", fontWeight: sel ? 700 : 500,
                      color: sel ? rc.color : "var(--ink)",
                      flex: 1,
                    }}>
                      {o.label}
                    </span>
                    {sel && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={rc.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          ) : listStyle ? (
            /* listStyle: scrollable vertical list */
            <div style={{
              display: "flex", flexDirection: "column", gap: 2,
              maxHeight: 280, overflowY: "auto",
            }}>
              {options.map((o) => {
                const sel = value === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { onSelect(sel ? null : o.value); onToggle(); }}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: sel ? "var(--royal-50)" : "transparent",
                      color: sel ? "var(--royal)" : "var(--ink)",
                      fontSize: "var(--text-sm)", fontWeight: sel ? 700 : 400,
                      cursor: "pointer", textAlign: "left",
                      fontFamily: "inherit",
                      transition: "background 0.1s",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => { if (!sel) (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { if (!sel) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    {sel ? "✓ " : ""}{o.label}
                  </button>
                );
              })}
            </div>
          ) : (
            /* default: pill wrap */
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {options.map((o) => {
                const sel = value === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { onSelect(sel ? null : o.value); onToggle(); }}
                    style={{
                      padding: "6px 14px", borderRadius: 999,
                      border: `1.5px solid ${sel ? "var(--royal)" : "var(--line)"}`,
                      background: sel ? "var(--royal)" : "#fff",
                      color: sel ? "#fff" : "var(--ink)",
                      fontSize: "var(--text-sm)", fontWeight: sel ? 700 : 400,
                      cursor: "pointer", whiteSpace: "nowrap",
                      fontFamily: "inherit",
                      transition: "all 0.1s",
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Horizontal list card ─────────────────────────────────────────────────────

function JobListCard({
  job, companyMap, initialBookmarked = false, alumni = [], isApplied = false, onHover,
}: {
  job: Job;
  companyMap: Map<string, Company>;
  initialBookmarked?: boolean;
  alumni?: CompanyAlumniPreview[];
  isApplied?: boolean;
  onHover?: (job: Job | null) => void;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkAnim, setBookmarkAnim] = useState(false);
  const bookmarkingRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!bookmarkingRef.current) setBookmarked(initialBookmarked);
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
        setBookmarked(!next);
      } else {
        if (next) showToast(`${job.role} を気になりリストに追加しました`, "warm");
        else showToast("気になりリストから削除しました");
      }
    } catch {
      setBookmarked(!next);
    } finally {
      bookmarkingRef.current = false;
    }
  }, [bookmarked, job.id, job.role, router]);

  if (!company) return null;

  const logoLetter = company.logo_letter ?? company.name.charAt(0).toUpperCase();
  const badge = freshBadge(job.updated_days_ago);
  const deptStyle = getDeptStyle(job.dept);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phaseBadge = getPhaseBadge((company as any).funding_stage ?? (company as any).phase);
  // ⑨ 常に投稿日を表示
  const postingLabel = (() => {
    if (job.updated_days_ago === 0) return null; // badge already says "今日"
    if (job.updated_days_ago <= 3) return null;  // badge already says "NEW"
    if (job.updated_days_ago <= 7) return null;  // badge already says "今週"
    return timeAgo(job.updated_days_ago) + "投稿";
  })();

  return (
    <div style={{ position: "relative" }}>
      {/* ブックマークボタン */}
      <button
        type="button"
        onClick={handleBookmark}
        aria-label={bookmarked ? "ブックマーク解除" : "ブックマーク追加"}
        style={{
          position: "absolute", top: 14, right: 14, zIndex: 10,
          width: 34, height: 34, borderRadius: "50%",
          border: "none", cursor: "pointer",
          background: bookmarked ? "#FEF2F2" : "rgba(255,255,255,0.95)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: bookmarkAnim ? "scale(1.3)" : "scale(1)",
          transition: "all 0.2s",
        }}
      >
        <Heart size={15} strokeWidth={2} style={{ color: bookmarked ? "#e24b4a" : "#94a3b8", fill: bookmarked ? "#e24b4a" : "none", transition: "all 0.2s" }} />
      </button>

      <Link href={`/jobs/${job.id}`} prefetch className="job-list-card-link" style={{
        display: "flex", gap: 16, alignItems: "flex-start",
        background: bookmarked ? "#FFF8F2" : "#fff", /* ⑦ bookmarked tint */
        borderRadius: 14,
        padding: "18px 56px 18px 18px",
        textDecoration: "none",
        borderTop: "1px solid var(--line)",
        borderRight: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        borderLeft: company.accepting_casual_meetings ? "3px solid #ea580c" : "1px solid var(--line)",
        transition: "box-shadow 0.22s ease, transform 0.22s ease, background 0.2s",
      }}
        onMouseEnter={() => onHover?.(job)}
        onMouseLeave={() => onHover?.(null)}
      >
        {/* ③④ Logo — 64px、企業の gradient カラーを使用 */}
        <div style={{
          width: 64, height: 64, borderRadius: 14, flexShrink: 0,
          background: company.logo_url ? "#f8fafc" : (company.gradient || "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)"),
          border: company.logo_url ? "1.5px solid var(--line)" : "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: company.logo_url ? undefined : "#fff", fontSize: 22, fontWeight: 700, overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}>
          {company.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt={company.name} width={64} height={64} style={{ objectFit: "contain" }} />
          ) : logoLetter}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Row 1: タイトル + NEW バッジ + ⑧ 投稿時期（右端） */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.35 }}>
              {job.role}
            </span>
            {badge && (
              <span style={{
                display: "inline-flex", alignItems: "center",
                padding: "1px 7px", borderRadius: 100,
                background: badge.bg, color: badge.color,
                border: `1px solid ${badge.border}`,
                fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
                fontFamily: "Inter, sans-serif", flexShrink: 0,
              }}>
                {badge.label}
              </span>
            )}
            {postingLabel && (
              <span style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: "auto", flexShrink: 0, whiteSpace: "nowrap" }}>
                {postingLabel}
              </span>
            )}
          </div>

          {/* Row 2: ③ 企業名 + フェーズバッジ + 勤務地 + 勤務形態 + 雇用形態 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/companies/${company.id}`); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); router.push(`/companies/${company.id}`); }}}
              className="company-name-link"
              style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, cursor: "pointer" }}
            >
              {company.name}
            </span>
            {phaseBadge && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 100,
                background: phaseBadge.bg, color: phaseBadge.color, flexShrink: 0,
              }}>
                {phaseBadge.label}
              </span>
            )}
            {job.location && (
              <>
                <span style={{ fontSize: 10, color: "var(--line)" }}>·</span>
                <span style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 3 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {job.location.split("・")[0].replace(/[（(][^）)]*[）)]/g, "").trim()}
                </span>
              </>
            )}
            {job.work_style && (
              <>
                <span style={{ fontSize: 10, color: "var(--line)" }}>·</span>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: job.work_style.includes("リモート") ? "var(--success)" : "var(--ink-soft)",
                }}>
                  {job.work_style}
                </span>
              </>
            )}
            {job.employment_type && job.employment_type !== "正社員" && (
              <>
                <span style={{ fontSize: 10, color: "var(--line)" }}>·</span>
                <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 700, background: "#F0FDF4", padding: "1px 7px", borderRadius: 4, border: "1px solid #BBF7D0" }}>
                  {job.employment_type}
                </span>
              </>
            )}
          </div>

          {/* Row 3: ① 年収（目立つ位置・大きなフォント） */}
          <div style={{ marginBottom: 8 }}>
            {(job.salary_min || job.salary_max) ? (
              <>
                <span style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 22, fontWeight: 800,
                  color: "var(--success)", lineHeight: 1.1,
                }}>
                  {formatSalary(job.salary_min, job.salary_max)}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 500, marginLeft: 6 }}>年収</span>
              </>
            ) : (
              <span style={{ fontSize: 13, color: "var(--ink-mute)" }}>年収応相談</span>
            )}
          </div>

          {/* Row 4: キャッチコピー ④ 1行に固定してカード高さ揃え */}
          {job.highlight && (
            <p style={{
              fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.65, margin: "0 0 10px",
              display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {job.highlight}
            </p>
          )}

          {/* ② 先輩がいます strip — <a> 内は <span> のみ使用 */}
          {alumni.length > 0 && (
            <span
              role="presentation"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                marginBottom: 10,
                padding: "6px 10px", borderRadius: 8,
                background: "var(--royal-50)", border: "1px solid var(--royal-100)",
              }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/companies/${job.company_id}#members`); }}
            >
              <span style={{ display: "inline-flex", alignItems: "center" }}>
                {alumni.slice(0, 3).map((a, i) => (
                  <span key={a.userId} style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: a.gradient,
                    border: "2px solid #fff",
                    marginLeft: i === 0 ? 0 : -6,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, color: "#fff",
                    flexShrink: 0, position: "relative",
                  }}>
                    {a.name.replace(/\s/g, "").charAt(0)}
                  </span>
                ))}
              </span>
              <span style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, cursor: "pointer" }}>
                先輩{alumni.length}名がいます →
              </span>
            </span>
          )}

          {/* Row 5: 職種バッジ + 面談バッジ + ⑩状態バッジ + 詳細→ */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {job.dept && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                background: deptStyle.bg, color: deptStyle.color, border: `1px solid ${deptStyle.border}`,
                maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {shortDept(job.dept)}
              </span>
            )}
            {/* ③ 面談受付中はソフトバッジのみ（CTA削除） */}
            {company.accepting_casual_meetings && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 100,
                background: "#FFF7ED", color: "#C2410C",
                border: "1.5px solid #FDBA74",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#EA580C", animation: "pulseDot 1.8s ease-in-out infinite", flexShrink: 0 }} />
                面談受付中
              </span>
            )}
            {/* ⑩ 応募済みバッジ */}
            {isApplied && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0",
                flexShrink: 0,
              }}>
                ✓ 応募済み
              </span>
            )}
            {/* 常に「詳細を見る→」を右端に表示 */}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 12, color: "var(--royal)", fontWeight: 600,
              marginLeft: "auto", flexShrink: 0,
            }} className="job-list-card-cta">
              詳細を見る
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

// ─── Main client component ─────────────────────────────────────────────────────

export default function JobsClient({
  jobs: allJobs,
  companies,
  parentRoles,
  alumniMap = {},
}: {
  jobs: Job[];
  companies: Company[];
  parentRoles: { id: string; name: string }[];
  alumniMap?: Record<string, CompanyAlumniPreview[]>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = searchParams.get("category") ?? "";
  const dept = searchParams.get("dept") ?? "";       // 後方互換 (新規 URL では未使用)
  const work_style = searchParams.get("work_style") ?? "";
  const salary = searchParams.get("salary") ?? "";
  const industry = searchParams.get("industry") ?? "";
  const prefecture = searchParams.get("prefecture") ?? "";
  const empType = searchParams.get("emp_type") ?? "";   // 雇用形態フィルター
  const sort = searchParams.get("sort") ?? "updated";

  // Local-only keyword search
  const [q, setQ] = useState("");

  // ⑧ 企業グルーピング toggle（デフォルトON）
  const [groupByCompany, setGroupByCompany] = useState(true);

  // Which filter chip dropdown is open
  const [openChip, setOpenChip] = useState<string | null>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);

  // Close chip dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setOpenChip(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // ⑩ Applied jobs: load once on mount
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch("/api/user/applied-jobs")
      .then((r) => r.ok ? r.json() : { ids: [] })
      .then((data: { ids?: string[] }) => {
        if (data.ids) setAppliedJobIds(new Set(data.ids));
      })
      .catch(() => {});
  }, []);

  // ⑥ Hover preview
  const [hoveredJob, setHoveredJob] = useState<Job | null>(null);
  const handleHover = useCallback((j: Job | null) => setHoveredJob(j), []);

  // ⑤ "もっと見る" — display count resets when filters change
  const [displayCount, setDisplayCount] = useState(PER_PAGE);

  // Build Map for fast company lookup
  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );

  // 業界名の正規化マップ（フィルター用）
  const INDUSTRY_NORMALIZE: Record<string, string> = {
    "IT": "IT / SaaS",
    "SaaS": "IT / SaaS",
  };
  const normalizeIndustry = (v: string | null) =>
    v ? (INDUSTRY_NORMALIZE[v] ?? v) : null;

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.replace(`/jobs?${params.toString()}`);
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
        .filter((c) => normalizeIndustry(c.industry) === industry)
        .map((c) => c.id);
      list = list.filter((j) => companyIds.includes(j.company_id));
    }

    // 都道府県フィルタ (job.location から抽出した都道府県と完全一致)
    if (prefecture) {
      list = list.filter((j) => extractPrefecture(j.location) === prefecture);
    }

    // 雇用形態フィルタ
    if (empType) {
      list = list.filter((j) => j.employment_type === empType);
    }

    // ソート
    const PHASE_ORDER: Record<string, number> = {
      "Pre-seed": 0, "Seed": 1,
      "Series A": 2, "Series B": 3, "Series C": 4, "Series D": 5, "Series E": 6,
      "東証グロース": 7, "東証プライム": 8,
      "上場 (NASDAQ)": 9, "上場 (NYSE)": 9, "上場": 9,
    };
    if (sort === "salary") {
      list = [...list].sort((a, b) => b.salary_max - a.salary_max);
    } else if (sort === "phase") {
      list = [...list].sort((a, b) => {
        const pa = PHASE_ORDER[companyMap.get(a.company_id)?.phase ?? ""] ?? 99;
        const pb = PHASE_ORDER[companyMap.get(b.company_id)?.phase ?? ""] ?? 99;
        return pa - pb;
      });
    } else {
      list = [...list].sort((a, b) => a.updated_days_ago - b.updated_days_ago);
    }

    return list;
  }, [allJobs, q, category, dept, work_style, salary, industry, prefecture, empType, sort, companies, companyMap]);

  // ⑧ グルーピング適用（1社あたり最大3件）
  const filteredForDisplay = useMemo(() => {
    if (!groupByCompany) return filtered;
    const countMap = new Map<string, number>();
    return filtered.filter((j) => {
      const c = countMap.get(j.company_id) ?? 0;
      if (c >= 3) return false;
      countMap.set(j.company_id, c + 1);
      return true;
    });
  }, [filtered, groupByCompany]);

  // ⑧ グルーピング時に「まとめられた社数」を計算
  const hiddenByGrouping = filtered.length - filteredForDisplay.length;
  // ⑧ 最も多い企業の件数を計算
  const maxPerCompany = useMemo(() => {
    const countMap = new Map<string, number>();
    filtered.forEach((j) => countMap.set(j.company_id, (countMap.get(j.company_id) ?? 0) + 1));
    return Math.max(0, ...Array.from(countMap.values()));
  }, [filtered]);

  // ⑤ reset when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filterKey = [category, dept, work_style, salary, industry, prefecture, empType, sort, q].join("|");
  useEffect(() => { setDisplayCount(PER_PAGE); }, [filterKey]);

  const paged = filteredForDisplay.slice(0, displayCount);
  const hasMore = displayCount < filteredForDisplay.length;
  const remainingCount = filteredForDisplay.length - displayCount;

  const hasFilter = !!(category || dept || work_style || salary || industry || prefecture || empType);

  return (
    <>
      <h1 className="sr-only">求人を探す</h1>


      {/* ── コンパクトフィルターバー（モバイル用、デスクトップは非表示） ── */}
      <div
        ref={filterBarRef}
        className="jobs-mobile-filterbar"
        style={{
          position: "sticky",
          top: 64,
          zIndex: 50,
          background: "#fff",
          borderBottom: "1px solid var(--line)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          padding: "20px 0 0",
        }}
      >
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
          {/* フィルターバー */}
          <div style={{ padding: "0 0 0" }}>

            {/* 1段目: 検索バー */}
            <div
              role="search"
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-2)",
                background: "#fff",
                border: "1.5px solid #e6e9ef",
                borderRadius: 999,
                padding: "0 14px",
                transition: "border-color 0.15s, box-shadow 0.15s",
                marginBottom: 8,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b95a3" strokeWidth={2.2} strokeLinecap="round" style={{ flexShrink: 0 }} aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="search"
                aria-label="求人を検索"
                value={q}
                onChange={(e) => { setQ(e.target.value); setOpenChip(null); }}
                placeholder="職種・企業名で検索"
                style={{
                  flex: 1, border: "none", outline: "none",
                  fontSize: 13.5, color: "var(--ink)", background: "transparent",
                  padding: "9px 0", minWidth: 0,
                }}
                onFocus={(e) => {
                  const wrap = e.currentTarget.parentElement as HTMLElement;
                  if (wrap) { wrap.style.borderColor = "var(--royal)"; wrap.style.boxShadow = "0 0 0 3px rgba(0,35,102,0.08)"; }
                }}
                onBlur={(e) => {
                  const wrap = e.currentTarget.parentElement as HTMLElement;
                  if (wrap) { wrap.style.borderColor = "#e6e9ef"; wrap.style.boxShadow = "none"; }
                }}
              />
              {q && (
                <button type="button" onClick={() => setQ("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#8b95a3", fontSize: "var(--text-base)", padding: "2px", lineHeight: 1, flexShrink: 0 }}>×</button>
              )}
            </div>

            {/* ⑦ 人気キーワードサジェスト（検索空のとき） */}
            {!q && (
              <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", paddingBottom: 8 }}>
                <span style={{ fontSize: 11, color: "var(--ink-mute)", flexShrink: 0, whiteSpace: "nowrap" }}>よく検索:</span>
                {["エンジニア", "PdM・PM", "マーケティング", "カスタマーサクセス", "フルリモート"].map((kw) => (
                  <button key={kw} type="button" onClick={() => setQ(kw)} style={{
                    padding: "2px 9px", borderRadius: 100, fontSize: 11,
                    border: "1.5px solid var(--line)", background: "#fff",
                    color: "var(--ink-soft)", fontWeight: 500, cursor: "pointer",
                    whiteSpace: "nowrap", fontFamily: "inherit", transition: "all 0.12s",
                  }}>
                    {kw}
                  </button>
                ))}
              </div>
            )}

            {/* ⑨ 2段目: 職種カテゴリーピル（右端フェードあり） */}
            {parentRoles.length > 0 && (
              <div style={{ position: "relative" }}>
              <div style={{
                display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8,
                scrollbarWidth: "none",
              } as React.CSSProperties}>
                {parentRoles.map((role) => {
                  const isActive = category === role.id;
                  const rc = getRoleColor(role.name);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => { setParam("category", isActive ? "" : role.id); setOpenChip(null); }}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "5px 13px", borderRadius: 100,
                        border: `1.5px solid ${isActive ? rc.color : "var(--line)"}`,
                        background: isActive ? rc.bg : "#fff",
                        color: isActive ? rc.color : "var(--ink-soft)",
                        fontSize: 13, fontWeight: isActive ? 700 : 500,
                        cursor: "pointer", whiteSpace: "nowrap",
                        fontFamily: "inherit", transition: "all 0.12s",
                        flexShrink: 0,
                      }}
                    >
                      <span style={{
                        width: isActive ? 10 : 6, height: isActive ? 10 : 6, borderRadius: "50%",
                        background: rc.color, flexShrink: 0,
                        opacity: isActive ? 1 : 0.45,
                        animation: isActive ? "pulseDot 1.8s ease-in-out infinite" : "none",
                        transition: "width 0.12s, height 0.12s",
                      }} />
                      {role.name}
                    </button>
                  );
                })}
              </div>
              {/* ⑨ 右端フェードオーバーレイ */}
              <div style={{
                position: "absolute", top: 0, right: 0, bottom: 8, width: 36,
                background: "linear-gradient(to right, transparent, #fff)",
                pointerEvents: "none",
              }} />
              </div>
            )}

            {/* 3段目: 絞り込みチップ */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
              {/* 勤務形態 chip */}
              <FilterChip
                label="勤務形態"
                value={work_style}
                options={[
                  { value: "フルリモート", label: "🏠 フルリモート" },
                  { value: "ハイブリッド", label: "🔀 ハイブリッド" },
                  { value: "出社",         label: "🏢 出社" },
                ]}
                onSelect={(v) => { setParam("work_style", v ?? ""); setOpenChip(null); }}
                isOpen={openChip === "work_style"}
                onToggle={() => setOpenChip(openChip === "work_style" ? null : "work_style")}
                resultCount={work_style ? filtered.length : undefined}
              />

              {/* 年収 chip */}
              <FilterChip
                label="年収"
                value={salary}
                options={SALARY_PILL_TIERS.map((t) => ({ value: t.value, label: t.label }))}
                onSelect={(v) => { setParam("salary", v ?? ""); setOpenChip(null); }}
                isOpen={openChip === "salary"}
                onToggle={() => setOpenChip(openChip === "salary" ? null : "salary")}
                resultCount={salary ? filtered.length : undefined}
              />

              {/* 雇用形態 chip */}
              <FilterChip
                label="雇用形態"
                value={empType}
                options={[
                  { value: "正社員",   label: "正社員" },
                  { value: "業務委託", label: "業務委託" },
                  { value: "副業",     label: "副業・複業" },
                ]}
                onSelect={(v) => { setParam("emp_type", v ?? ""); setOpenChip(null); }}
                isOpen={openChip === "emp_type"}
                onToggle={() => setOpenChip(openChip === "emp_type" ? null : "emp_type")}
                resultCount={empType ? filtered.length : undefined}
              />

              {/* ⑨ 地域 chip: 2件以上あるときのみ表示 */}
              {availablePrefectures.length > 1 && (
                <FilterChip
                  label="地域"
                  value={prefecture}
                  options={availablePrefectures.map((p) => ({ value: p, label: p }))}
                  onSelect={(v) => { setParam("prefecture", v ?? ""); setOpenChip(null); }}
                  isOpen={openChip === "prefecture"}
                  onToggle={() => setOpenChip(openChip === "prefecture" ? null : "prefecture")}
                  listStyle
                  resultCount={prefecture ? filtered.length : undefined}
                />
              )}

              {(hasFilter || q) && (
                <button
                  type="button"
                  onClick={() => { setQ(""); router.replace("/jobs"); }}
                  style={{
                    fontSize: 12.5, color: "var(--ink-mute)",
                    background: "none", border: "none", cursor: "pointer",
                    padding: "5px 4px", whiteSpace: "nowrap",
                    fontFamily: "inherit", transition: "color 0.15s",
                  }}
                >
                  ✕ リセット
                </button>
              )}
            </div>

            {/* アクティブフィルター chip 行 */}
            {hasFilter && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 8, paddingBottom: 4, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap", fontWeight: 500 }}>絞り込み中:</span>
                {category && (() => {
                  const r = parentRoles.find(r => r.id === category);
                  const rc = r ? getRoleColor(r.name) : { color: "var(--royal)", bg: "var(--royal-50)" };
                  return r ? (
                    <button key="cat" type="button" onClick={() => setParam("category", "")} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 10px", borderRadius: 100,
                      background: rc.bg, border: `1.5px solid ${rc.color}`,
                      color: rc.color, fontSize: 11, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>
                      職種: {r.name} <span style={{ fontSize: 10, opacity: 0.8 }}>✕</span>
                    </button>
                  ) : null;
                })()}
                {work_style && (
                  <button key="ws" type="button" onClick={() => setParam("work_style", "")} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 100,
                    background: "var(--success-soft)", border: "1.5px solid #6EE7B7",
                    color: "#065F46", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    勤務形態: {work_style} <span style={{ fontSize: 10, opacity: 0.8 }}>✕</span>
                  </button>
                )}
                {salary && (() => {
                  const tier = SALARY_PILL_TIERS.find(t => t.value === salary);
                  return tier ? (
                    <button key="sal" type="button" onClick={() => setParam("salary", "")} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 10px", borderRadius: 100,
                      background: "#FEF3C7", border: "1.5px solid #FDE68A",
                      color: "#92400E", fontSize: 11, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>
                      年収: {tier.label} <span style={{ fontSize: 10, opacity: 0.8 }}>✕</span>
                    </button>
                  ) : null;
                })()}
                {empType && (
                  <button key="emp" type="button" onClick={() => setParam("emp_type", "")} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 100,
                    background: "var(--royal-50)", border: "1.5px solid var(--royal-100)",
                    color: "var(--royal)", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    雇用形態: {empType} <span style={{ fontSize: 10, opacity: 0.8 }}>✕</span>
                  </button>
                )}
                {prefecture && (
                  <button key="pref" type="button" onClick={() => setParam("prefecture", "")} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 100,
                    background: "#F0FDF4", border: "1.5px solid #BBF7D0",
                    color: "#16A34A", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    地域: {prefecture} <span style={{ fontSize: 10, opacity: 0.8 }}>✕</span>
                  </button>
                )}
                <button type="button" onClick={() => { setQ(""); router.replace("/jobs"); }} style={{
                  fontSize: 11, color: "var(--ink-mute)", background: "none",
                  border: "none", cursor: "pointer", padding: "3px 4px",
                  fontFamily: "inherit", textDecoration: "underline",
                }}>
                  すべてリセット
                </button>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* Main content */}
      <div style={{ background: "#f0f4f8" }}>
        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          className="px-5 py-6 md:px-12 md:py-8"
        >
          <div className="jobs-layout">
            {/* ─ Results column ─ */}
            <main style={{ minWidth: 0 }}>
              {/* ⑤ 件数・並び順 統合バー */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 12, marginBottom: 16,
                background: "#fff", borderRadius: 12,
                border: "1px solid var(--line)", padding: "10px 16px",
                boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
              }}>
                {/* 左: 並び替えボタン */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--ink-mute)", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M7 12h10M11 18h2"/>
                    </svg>
                    並び替え
                  </div>
                  <div style={{ width: 1, height: 20, background: "var(--line)", flexShrink: 0 }} />
                  <div style={{ display: "flex", gap: 5, overflowX: "auto", scrollbarWidth: "none" } as React.CSSProperties}>
                    {([
                      { value: "updated", label: "新着順" },
                      { value: "salary",  label: "年収順" },
                      { value: "phase",   label: "ステージ順", title: "アーリー（シード）→ 成熟（上場）の順" },
                    ] as const).map((opt) => {
                      const active = sort === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setParam("sort", opt.value)}
                          title={"title" in opt ? opt.title : undefined}
                          style={{
                            padding: "5px 13px", borderRadius: 100,
                            border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`,
                            background: active ? "var(--royal)" : "#fff",
                            color: active ? "#fff" : "var(--ink-soft)",
                            fontSize: 12, fontWeight: active ? 700 : 500,
                            cursor: "pointer", whiteSpace: "nowrap",
                            fontFamily: "inherit", transition: "all 0.15s",
                            boxShadow: active ? "0 2px 8px rgba(0,35,102,0.22)" : "none",
                            flexShrink: 0,
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* 右: ⑧グルーピングトグル + ⑦件数 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {/* ⑧ 1社複数件まとめトグル（最大件数 > 3 の場合のみ表示） */}
                  {maxPerCompany > 3 && (
                    <button
                      type="button"
                      onClick={() => { setGroupByCompany(v => !v); setDisplayCount(PER_PAGE); }}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "5px 11px", borderRadius: 100,
                        border: `1.5px solid ${groupByCompany ? "var(--royal)" : "var(--line)"}`,
                        background: groupByCompany ? "var(--royal-50)" : "#fff",
                        color: groupByCompany ? "var(--royal)" : "var(--ink-mute)",
                        fontSize: 11, fontWeight: groupByCompany ? 700 : 500,
                        cursor: "pointer", whiteSpace: "nowrap",
                        fontFamily: "inherit", transition: "all 0.15s",
                      }}
                      title="同一企業の求人を1社あたり3件に絞る"
                    >
                      {groupByCompany ? "✓ " : ""}1社3件まで
                    </button>
                  )}
                  <div style={{ width: 1, height: 20, background: "var(--line)" }} />
                  <span aria-live="polite" aria-atomic="true" style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500, whiteSpace: "nowrap" }}>
                    <strong style={{ color: "var(--ink)", fontWeight: 800, fontFamily: "Inter, sans-serif", fontSize: 16 }}>{filteredForDisplay.length}</strong>
                    <span style={{ marginLeft: 2 }}>件</span>
                    {(hasFilter || q) && (
                      <span style={{ fontSize: 11, color: "var(--success)", marginLeft: 4, fontWeight: 600 }}>● 絞り込み中</span>
                    )}
                  </span>
                </div>
              </div>

          {paged.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "48px 24px", background: "#fff",
              borderRadius: 16, border: "1px solid var(--line)", marginTop: 20,
            }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <h3 style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>条件に合う求人が見つかりませんでした</h3>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-mute)", marginBottom: 20 }}>フィルター条件を変えるか、企業のカジュアル面談で直接聞いてみましょう</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button type="button" onClick={() => router.replace("/jobs")} style={{
                  padding: "10px 24px", borderRadius: 8, background: "var(--royal)",
                  color: "#fff", border: "none", fontSize: "var(--text-base)", fontWeight: 600, cursor: "pointer",
                }}>
                  すべてリセット
                </button>
                <Link href="/companies" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "10px 20px", borderRadius: 8,
                  background: "linear-gradient(135deg, var(--royal), var(--accent))",
                  color: "#fff", fontSize: "var(--text-sm)", fontWeight: 600, textDecoration: "none",
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  企業を見る
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* リスト表示（デスクトップ・モバイル共通） */}
              <div className="jobs-list-desktop">
                {paged.map((job) => (
                  <JobListCard
                    key={job.id}
                    job={job}
                    companyMap={companyMap}
                    initialBookmarked={bookmarkedIds.has(job.id)}
                    alumni={alumniMap[job.company_id] ?? []}
                    isApplied={appliedJobIds.has(job.id)}
                    onHover={handleHover}
                  />
                ))}
              </div>
              {/* ⑧ グルーピングで省略された件数の案内 */}
              {groupByCompany && hiddenByGrouping > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  marginBottom: 12, padding: "9px 16px",
                  background: "var(--royal-50)", borderRadius: 10,
                  border: "1px solid var(--royal-100)",
                  fontSize: 12, color: "var(--royal)", fontWeight: 600,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  1社あたり最大3件表示中。同じ企業の求人が{hiddenByGrouping}件非表示になっています。
                  <button type="button" onClick={() => setGroupByCompany(false)} style={{
                    background: "none", border: "none", color: "var(--royal)", fontWeight: 700, fontSize: 12,
                    cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "inherit",
                  }}>すべて表示</button>
                </div>
              )}
              {/* ⑤ 表示件数 + もっと見るボタン */}
              <div style={{ textAlign: "center", marginTop: 8, marginBottom: 4, fontSize: 12, color: "var(--ink-mute)" }}>
                {paged.length}件を表示（全{filteredForDisplay.length}件）
              </div>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setDisplayCount((d) => d + PER_PAGE)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    margin: "16px auto 0",
                    padding: "12px 32px", borderRadius: 999,
                    border: "1.5px solid var(--royal)",
                    background: "#fff", color: "var(--royal)",
                    fontSize: 14, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                    boxShadow: "0 2px 8px rgba(0,35,102,0.1)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--royal)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)"; }}
                >
                  もっと見る
                  <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 500 }}>（残り{remainingCount}件）</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
              )}

            </>
          )}
            </main>
          </div>{/* jobs-layout end */}
        </div>
      </div>{/* bg end */}

      {/* ⑥ ホバープレビューパネル（デスクトップのみ） */}
      <JobPreviewPanel job={hoveredJob} companyMap={companyMap} />

      <style>{`
        /* ── Job card hover ── */
        .job-card-link:hover {
          box-shadow: 0 12px 36px rgba(0,35,102,0.18), 0 2px 8px rgba(0,35,102,0.08) !important;
          transform: translateY(-5px) !important;
        }
        .job-card-link .job-card-cta-overlay {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: 20px 16px 14px;
          background: linear-gradient(to top, rgba(0,35,102,0.85) 0%, rgba(0,35,102,0) 100%);
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          text-align: right;
          opacity: 0;
          transition: opacity 0.22s ease;
          border-radius: 0 0 18px 18px;
          pointer-events: none;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          gap: 4px;
        }
        .job-card-link:hover .job-card-cta-overlay {
          opacity: 1;
        }
        .job-card-link:active {
          box-shadow: 0 4px 12px rgba(15,23,42,0.10) !important;
          transform: translateY(-2px) !important;
          transition-duration: 0.06s !important;
        }
        /* ⑩ リストカードのhover: 全体がクリック可能と分かるよう強調 */
        .job-list-card-link:hover {
          box-shadow: 0 6px 24px rgba(0,35,102,0.15) !important;
          transform: translateY(-2px) !important;
          border-color: var(--royal-100) !important;
          border-left-color: var(--royal) !important;
        }
        .job-list-card-link:hover .job-list-card-cta {
          color: #f97316 !important;
          text-decoration: underline;
        }
        .job-list-card-link:active {
          transform: translateY(0) !important;
          transition-duration: 0.08s !important;
        }
        .job-search-input:focus {
          box-shadow: 0 0 0 3px rgba(0,35,102,0.12) !important;
        }

        /* ── Single-column layout ── */
        .jobs-layout {
          display: flex;
          flex-direction: column;
        }
        /* filter bar: always visible */
        .jobs-mobile-filterbar { display: block; }
        /* list: always visible on desktop */
        .jobs-list-desktop {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        /* desktop grid mode */
        .jobs-grid-desktop {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        @media (max-width: 1023px) {
          .jobs-grid-desktop { grid-template-columns: repeat(2, 1fr); }
        }
        /* ⑩ モバイルでもリストビューを表示（グリッドなし） */
        @media (max-width: 767px) {
          .jobs-grid-desktop { display: none; }
          .jobs-view-toggle { display: none !important; }
        }
        /* company name hover */
        .company-name-link:hover {
          text-decoration: underline;
        }
        /* ⑥ Preview panel — desktop only */
        .job-preview-panel { display: none; }
        @media (min-width: 1280px) {
          .job-preview-panel { display: block; animation: fadeInUp 0.18s ease; }
        }
      `}</style>
    </>
  );
}
