"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import type { Job } from "@/app/jobs/mockJobData";
import { showToast } from "@/lib/toast";
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
  if (min && max) return `${min}〜${max}万円`;
  if (max) return `〜${max}万円`;
  return `${min}万円〜`;
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
  const isFresh = job.updated_days_ago <= 7;
  const label = freshLabel(job.updated_days_ago);
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
      prefetch={true}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        border: "none",
        borderRadius: 18,
        padding: "20px 20px 16px",
        textDecoration: "none",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(15,23,42,0.05), 0 6px 20px rgba(15,23,42,0.07)",
        transition: "box-shadow 0.24s cubic-bezier(0.22,1,0.36,1), transform 0.24s cubic-bezier(0.22,1,0.36,1)",
        willChange: "transform",
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

      {/* HOT badge */}
      {job.urgency === "hot" && (
        <span style={{
          position: "absolute",
          top: 10,
          left: 10,
          display: "inline-flex", alignItems: "center", gap: 3,
          padding: "2px 7px", borderRadius: 4,
          background: "#FEE2E2", color: "#DC2626",
          fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
          fontFamily: "Inter, sans-serif",
          border: "1px solid #FECACA",
          zIndex: 2,
        }}>
          🔥 HOT
        </span>
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
              fontSize: 15,
              fontWeight: 700,
              color: "var(--ink)",
              lineHeight: 1.4,
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
              style={{
                fontSize: 12,
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

      {/* 勤務地 + リモート区分（1行目に明示） */}
      {(job.location || job.work_style) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 10, flexWrap: "wrap" as const,
        }}>
          {job.location && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 12, color: "var(--ink-soft)", fontWeight: 500,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {job.location.split("・")[0]}
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
        type="button"
        onClick={() => onPage(current - 1)}
        disabled={current === 1}
        aria-label="前のページへ"
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
          type="button"
          key={p}
          onClick={() => onPage(p)}
          aria-label={`${p}ページ目`}
          aria-current={p === current ? "page" : undefined}
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
        type="button"
        onClick={() => onPage(current + 1)}
        disabled={current === total}
        aria-label="次のページへ"
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
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (v: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
  listStyle?: boolean;
  colorStyle?: boolean;
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
          fontSize: 13, fontWeight: isActive ? 600 : 400,
          cursor: "pointer", whiteSpace: "nowrap",
          transition: "all 0.12s",
          fontFamily: "inherit",
        }}
      >
        {isActive ? activeLabel : label}
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
                      fontSize: 13, fontWeight: sel ? 700 : 500,
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
                      fontSize: 13, fontWeight: sel ? 700 : 400,
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
                      fontSize: 13, fontWeight: sel ? 700 : 400,
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

// ─── Sidebar filter (desktop only) ────────────────────────────────────────────

function SidebarFilter({
  parentRoles, category, work_style, salary, prefecture,
  availablePrefectures, q, setQ, setParam, hasFilter,
  onReset,
}: {
  parentRoles: { id: string; name: string }[];
  category: string;
  work_style: string;
  salary: string;
  prefecture: string;
  availablePrefectures: string[];
  q: string;
  setQ: (v: string) => void;
  setParam: (key: string, value: string) => void;
  hasFilter: boolean;
  onReset: () => void;
}) {
  const WORK_STYLES = [
    { value: "フルリモート", label: "🏠 フルリモート" },
    { value: "ハイブリッド", label: "🔀 ハイブリッド" },
    { value: "出社",         label: "🏢 出社" },
  ];
  const sectionTitle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
    textTransform: "uppercase", color: "var(--ink-mute)",
    fontFamily: "Inter, sans-serif", marginBottom: 8,
  };
  const pillBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center",
    padding: "5px 12px", borderRadius: 999, fontSize: 12,
    border: "1.5px solid var(--line)", background: "#fff",
    color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit",
    transition: "all 0.1s", fontWeight: 500,
  };
  const pillActive: React.CSSProperties = {
    ...pillBase, background: "var(--royal)", borderColor: "var(--royal)",
    color: "#fff", fontWeight: 700,
  };

  return (
    <aside style={{
      position: "sticky", top: 88,
      display: "flex", flexDirection: "column", gap: 24,
      background: "#fff", borderRadius: 16, padding: "20px 18px",
      border: "1px solid var(--line)",
      alignSelf: "flex-start",
      maxHeight: "calc(100vh - 108px)", overflowY: "auto",
    }}>
      {/* キーワード */}
      <div>
        <div style={sectionTitle}>キーワード</div>
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          border: "1.5px solid var(--line)", borderRadius: 8, padding: "8px 12px",
          background: "#fff",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2.2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="職種・企業名で検索"
            style={{ border: "none", outline: "none", fontSize: 13, flex: 1, background: "transparent", color: "var(--ink)", fontFamily: "inherit" }}
          />
          {q && <button type="button" onClick={() => setQ("")} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: 0 }}>×</button>}
        </div>
      </div>

      {/* 職種 */}
      <div>
        <div style={sectionTitle}>職種カテゴリ</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {parentRoles.map((r) => {
            const active = category === r.id;
            const rc = getRoleColor(r.name);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setParam("category", active ? "" : r.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", borderRadius: 8, border: "none",
                  background: active ? rc.bg : "transparent",
                  cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: active ? rc.color : "#cbd5e1", flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: active ? rc.color : "var(--ink)" }}>
                  {r.name}
                </span>
                {active && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={rc.color} strokeWidth={2.5} strokeLinecap="round" style={{ marginLeft: "auto" }}><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 勤務形態 */}
      <div>
        <div style={sectionTitle}>勤務形態</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {WORK_STYLES.map(({ value, label }) => (
            <button key={value} type="button"
              onClick={() => setParam("work_style", work_style === value ? "" : value)}
              style={work_style === value ? pillActive : pillBase}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 年収 */}
      <div>
        <div style={sectionTitle}>年収下限</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SALARY_PILL_TIERS.map(({ value, label }) => (
            <button key={value} type="button"
              onClick={() => setParam("salary", salary === value ? "" : value)}
              style={salary === value ? pillActive : pillBase}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 地域 */}
      {availablePrefectures.length > 0 && (
        <div>
          <div style={sectionTitle}>都道府県</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {availablePrefectures.map((p) => (
              <button key={p} type="button"
                onClick={() => setParam("prefecture", prefecture === p ? "" : p)}
                style={{
                  padding: "6px 10px", borderRadius: 6, border: "none",
                  background: prefecture === p ? "var(--royal-50)" : "transparent",
                  color: prefecture === p ? "var(--royal)" : "var(--ink)",
                  fontSize: 13, fontWeight: prefecture === p ? 700 : 400,
                  cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                }}
              >
                {prefecture === p ? "✓ " : ""}{p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* リセット */}
      {(hasFilter || q) && (
        <button type="button" onClick={onReset}
          style={{
            padding: "9px 0", borderRadius: 8, border: "1px solid var(--line)",
            background: "var(--bg-tint)", color: "var(--ink-soft)",
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          ✕ フィルターをリセット
        </button>
      )}
    </aside>
  );
}

// ─── Horizontal list card (desktop Green style) ───────────────────────────────

function JobListCard({
  job, companyMap, initialBookmarked = false,
}: {
  job: Job;
  companyMap: Map<string, Company>;
  initialBookmarked?: boolean;
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
  const isFresh = job.updated_days_ago <= 7;
  const deptStyle = getDeptStyle(job.dept);

  return (
    <div style={{ position: "relative" }}>
      {/* ブックマークボタン */}
      <button
        type="button"
        onClick={handleBookmark}
        aria-label={bookmarked ? "ブックマーク解除" : "ブックマーク追加"}
        style={{
          position: "absolute", top: 16, right: 16, zIndex: 10,
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
        background: "#fff", borderRadius: 14,
        padding: "18px 20px 16px",
        textDecoration: "none",
        border: "1px solid var(--line)",
        transition: "box-shadow 0.2s, transform 0.2s",
        paddingRight: 56,
      }}>
        {/* Logo */}
        <div style={{
          width: 52, height: 52, borderRadius: 10, flexShrink: 0,
          background: company.logo_url ? "#f8fafc" : company.gradient,
          border: company.logo_url ? "1px solid var(--line)" : "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 18, fontWeight: 700, overflow: "hidden",
        }}>
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.name} width={52} height={52} style={{ objectFit: "contain" }} />
          ) : logoLetter}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.35 }}>
              {job.role}
            </span>
            {isFresh && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                background: "var(--success-soft)", color: "var(--success)",
                border: "1px solid #A7F3D0",
              }}>NEW</span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600 }}>{company.name}</span>
            {job.location && (
              <>
                <span style={{ fontSize: 10, color: "var(--line)" }}>·</span>
                <span style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 3 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {job.location.split("・")[0]}
                </span>
              </>
            )}
            {job.work_style && (
              <>
                <span style={{ fontSize: 10, color: "var(--line)" }}>·</span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: job.work_style.includes("リモート") ? "var(--success)" : "var(--ink-soft)",
                }}>
                  {job.work_style}
                </span>
              </>
            )}
          </div>

          {job.highlight && (
            <p style={{
              fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.65, margin: "0 0 8px",
              display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {job.highlight}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {job.dept && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                background: deptStyle.bg, color: deptStyle.color, border: `1px solid ${deptStyle.border}`,
              }}>
                {job.dept}
              </span>
            )}
            <span style={{
              fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif",
              color: (job.salary_min || job.salary_max) ? "var(--success)" : "var(--ink-mute)",
            }}>
              {formatSalary(job.salary_min, job.salary_max)}
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
        .filter((c) => normalizeIndustry(c.industry) === industry)
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

  const hasFilter = !!(category || dept || work_style || salary || industry || prefecture);

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
          <div style={{ padding: "0 0 14px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

            {/* 検索インプット — 企業側と同スタイル */}
            <div
              role="search"
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#fff",
                border: "1.5px solid #e6e9ef",
                borderRadius: 999,
                padding: "0 14px",
                transition: "border-color 0.15s, box-shadow 0.15s",
                flex: "1 1 220px",
                minWidth: 0,
              }}
              onFocus={() => {}}
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
                  flex: 1,
                  border: "none",
                  outline: "none",
                  fontSize: 13.5,
                  color: "var(--ink)",
                  background: "transparent",
                  padding: "9px 0",
                  minWidth: 0,
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
                <button type="button" onClick={() => setQ("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#8b95a3", fontSize: 14, padding: "2px", lineHeight: 1, flexShrink: 0 }}>×</button>
              )}
            </div>

            {/* 職種 chip */}
            <FilterChip
              label="職種"
              value={category}
              options={parentRoles.map((r) => ({ value: r.id, label: r.name }))}
              onSelect={(v) => { setParam("category", v ?? ""); setOpenChip(null); }}
              isOpen={openChip === "category"}
              onToggle={() => setOpenChip(openChip === "category" ? null : "category")}
              colorStyle
            />

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
            />

            {/* 年収 chip */}
            <FilterChip
              label="年収"
              value={salary}
              options={SALARY_PILL_TIERS.map((t) => ({ value: t.value, label: t.label }))}
              onSelect={(v) => { setParam("salary", v ?? ""); setOpenChip(null); }}
              isOpen={openChip === "salary"}
              onToggle={() => setOpenChip(openChip === "salary" ? null : "salary")}
            />

            {/* 地域 chip */}
            {availablePrefectures.length > 0 && (
              <FilterChip
                label="地域"
                value={prefecture}
                options={availablePrefectures.map((p) => ({ value: p, label: p }))}
                onSelect={(v) => { setParam("prefecture", v ?? ""); setOpenChip(null); }}
                isOpen={openChip === "prefecture"}
                onToggle={() => setOpenChip(openChip === "prefecture" ? null : "prefecture")}
                listStyle
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
        </div>
      </div>

      {/* Main content */}
      <div style={{ background: "#f0f4f8" }}>
        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          className="px-5 py-6 md:px-12 md:py-8"
        >
          <div className="jobs-layout">
            {/* ─ Desktop Sidebar ─ */}
            <div className="jobs-sidebar-col">
              <SidebarFilter
                parentRoles={parentRoles}
                category={category}
                work_style={work_style}
                salary={salary}
                prefecture={prefecture}
                availablePrefectures={availablePrefectures}
                q={q}
                setQ={setQ}
                setParam={setParam}
                hasFilter={hasFilter}
                onReset={() => { setQ(""); router.replace("/jobs"); }}
              />
            </div>

            {/* ─ Results column ─ */}
            <main style={{ minWidth: 0 }}>
              {/* 件数・並び順 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span aria-live="polite" aria-atomic="true" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <strong style={{ color: "var(--royal)", fontSize: 18, fontFamily: "Inter, sans-serif", fontWeight: 800 }}>{filtered.length}</strong>
                  <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>件の求人</span>
                  {(hasFilter || q) && (
                    <span style={{ fontSize: 12, color: "var(--ink-mute)", marginLeft: 4 }}>（絞り込み中）</span>
                  )}
                </span>
                <select
                  value={sort}
                  onChange={(e) => setParam("sort", e.target.value)}
                  aria-label="並び順"
                  style={{
                    padding: "6px 26px 6px 10px",
                    border: "1.5px solid var(--line)",
                    borderRadius: 8,
                    background: "#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b95a3' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\") no-repeat right 8px center",
                    fontSize: 12.5, color: "var(--ink-soft)", cursor: "pointer",
                    outline: "none", fontFamily: "inherit",
                    appearance: "none" as const, WebkitAppearance: "none" as const,
                  }}
                >
                  <option value="updated">新着順</option>
                  <option value="salary">年収順</option>
                </select>
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
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>条件に合う求人が見つかりませんでした</h3>
              <p style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 20 }}>フィルター条件を変えるか、企業のカジュアル面談で直接聞いてみましょう</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button type="button" onClick={() => router.replace("/jobs")} style={{
                  padding: "10px 24px", borderRadius: 8, background: "var(--royal)",
                  color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}>
                  すべてリセット
                </button>
                <Link href="/companies" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "10px 20px", borderRadius: 8,
                  background: "linear-gradient(135deg, var(--royal), var(--accent))",
                  color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none",
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
              {/* デスクトップ: 横長リスト / モバイル: グリッド */}
              <div className="jobs-list-desktop">
                {paged.map((job) => (
                  <JobListCard key={job.id} job={job} companyMap={companyMap} initialBookmarked={bookmarkedIds.has(job.id)} />
                ))}
              </div>
              <div className="jobs-grid-mobile">
                {paged.map((job) => (
                  <JobCard key={job.id} job={job} companyMap={companyMap} initialBookmarked={bookmarkedIds.has(job.id)} />
                ))}
              </div>
              <Pagination
                current={safePage}
                total={totalPages}
                onPage={goPage}
              />

              {/* ── カジュアル面談 CTA ── */}
              <div style={{
                marginTop: 48, padding: "28px 32px",
                background: "linear-gradient(135deg, #001A4D 0%, var(--royal) 60%, #1D4ED8 100%)",
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
                  気になる求人を見つけたら、<br />その企業の現役社員に話を聞いてみよう。
                </h3>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.75, marginBottom: 22, maxWidth: 480 }}>
                  「応募前にもっとリアルな声を聞きたい」なら、企業ページからカジュアル面談を申し込めます。営業される心配ゼロ・完全無料。
                </p>
                <Link href="/companies" style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 28px",
                  background: "rgba(255,255,255,0.15)",
                  color: "#fff", borderRadius: 8, textDecoration: "none",
                  fontSize: 14, fontWeight: 700,
                  border: "1px solid rgba(255,255,255,0.3)",
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  カジュアル面談できる企業を見る
                </Link>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 12 }}>
                  OPINIO編集部が取材・審査した企業のみ掲載
                </p>
              </div>
            </>
          )}
            </main>
          </div>{/* jobs-layout end */}
        </div>
      </div>{/* bg end */}

      <style>{`
        /* ── Job card hover ── */
        .job-card-link:hover {
          box-shadow: 0 12px 36px rgba(0,35,102,0.18), 0 2px 8px rgba(0,35,102,0.08) !important;
          transform: translateY(-5px) !important;
        }
        .job-card-link:active {
          box-shadow: 0 4px 12px rgba(15,23,42,0.10) !important;
          transform: translateY(-2px) !important;
          transition-duration: 0.06s !important;
        }
        .job-list-card-link:hover {
          box-shadow: 0 4px 20px rgba(0,35,102,0.12) !important;
          transform: translateY(-2px) !important;
          border-color: var(--royal-100) !important;
        }
        .job-search-input:focus {
          box-shadow: 0 0 0 3px rgba(0,35,102,0.12) !important;
        }

        /* ── 2-column layout: sidebar + results ── */
        .jobs-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        /* sidebar col hidden on mobile */
        .jobs-sidebar-col { display: none; }
        /* list hidden on mobile, grid shown */
        .jobs-list-desktop { display: none; }
        .jobs-grid-mobile {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }
        /* mobile filter bar: shown on mobile */
        .jobs-mobile-filterbar { display: block; }

        @media (min-width: 640px) {
          .jobs-grid-mobile { grid-template-columns: repeat(2, 1fr); }
        }

        @media (min-width: 1024px) {
          .jobs-layout {
            grid-template-columns: 240px 1fr;
            gap: 24px;
          }
          /* show sidebar, hide mobile filter bar */
          .jobs-sidebar-col { display: block; }
          .jobs-mobile-filterbar { display: none !important; }
          /* show list, hide grid */
          .jobs-list-desktop {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .jobs-grid-mobile { display: none; }
        }
      `}</style>
    </>
  );
}
