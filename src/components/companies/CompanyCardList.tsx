"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { CompanyForCarousel } from "@/types/genre";
import type { MemberPreview } from "./CompanyCardCompact";

// カードビューと同じ STAGE_CONFIG
const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  "pre-seed":  { label: "プレシード", color: "#78350f", bg: "#fff7ed" },
  seed:        { label: "シード",     color: "#78350f", bg: "#fff7ed" },
  "series-a":  { label: "Series A",  color: "#1e40af", bg: "#dbeafe" },
  "series-b":  { label: "Series B",  color: "#5b21b6", bg: "#ede9fe" },
  "series-c":  { label: "Series C",  color: "#065f46", bg: "#d1fae5" },
  "series_c":  { label: "Series C",  color: "#065f46", bg: "#d1fae5" },
  "series-d":  { label: "Series D+", color: "#064e3b", bg: "#ccfbf1" },
  growth:      { label: "成長期",    color: "#065f46", bg: "#d1fae5" },
  listed:      { label: "上場",      color: "#14532d", bg: "#dcfce7" },
  "上場":      { label: "上場",      color: "#14532d", bg: "#dcfce7" },
  unicorn:     { label: "ユニコーン", color: "#6d28d9", bg: "#ede9fe" },
  ipo:         { label: "IPO準備",   color: "#9a3412", bg: "#ffedd5" },
};

function getStageCfg(stage: string | null) {
  if (!stage) return null;
  const key = stage.toLowerCase().replace(/\s+/g, "-");
  return STAGE_CONFIG[key] ?? STAGE_CONFIG[stage] ?? { label: stage, color: "#4a5260", bg: "#f1f5f9" };
}

/** 法人名サフィックス除去 */
function cleanEnName(nameEn: string | null | undefined): string | null {
  if (!nameEn) return null;
  const cleaned = nameEn
    .replace(/\s+Japan\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s*,\s*Inc\.?$/i, "")
    .replace(/\s+Inc\.?$/i, "")
    .replace(/\s+Corp\.?$/i, "")
    .trim();
  return cleaned || null;
}

type Props = {
  company: CompanyForCarousel;
  members?: MemberPreview[];
  compact?: boolean;
};

export function CompanyCardList({ company, members, compact }: Props) {
  const initial = company.logo_letter ?? company.name.slice(0, 1);
  const stageCfg = getStageCfg(company.funding_stage);
  const memberCount = company.current_member_count ?? (members?.length ?? 0);
  const obogCount = company.obog_count ?? 0;
  const displayName = cleanEnName(company.name_en) ?? company.name;
  const isEnName = !!cleanEnName(company.name_en);
  const headerGradient =
    company.logo_gradient ??
    "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)";

  return (
    <>
      <style>{`
        .company-list-card { transition: box-shadow 0.18s, border-color 0.18s; }
        .company-list-card:hover { box-shadow: 0 4px 24px rgba(0,35,102,0.12) !important; border-color: var(--royal-100) !important; }
        .company-list-card:hover .clc-name { color: var(--royal) !important; }
        .clc-stat-divider { width: 1px; height: 36px; background: var(--line); flex-shrink: 0; }
        @media (max-width: 767px) {
          .clc-stats { display: none !important; }
          .clc-stat-divider { display: none !important; }
          .clc-cta { display: none !important; }
        }
      `}</style>
      <Link
        href={`/companies/${company.id}`}
        className="company-list-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: compact ? "16px 20px" : "18px 24px",
          background: "#fff",
          borderRadius: 14,
          border: "1px solid var(--line)",
          boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {/* ── ロゴ（カードビューと同方式） ── */}
        <div style={{
          width: compact ? 64 : 72,
          height: compact ? 64 : 72,
          borderRadius: 12,
          flexShrink: 0,
          background: company.logo_url ? "#f5f7fa" : headerGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}>
          {company.logo_url ? (
            <Image
              src={company.logo_url}
              alt={`${company.name}のロゴ`}
              fill
              style={{ objectFit: "contain", padding: "12%" }}
              sizes="72px"
            />
          ) : (
            <span style={{
              fontSize: compact ? 24 : 28,
              fontWeight: 800,
              color: "rgba(255,255,255,0.88)",
              fontFamily: "Inter, sans-serif",
              letterSpacing: "-0.03em",
              userSelect: "none",
            }}>
              {initial}
            </span>
          )}
        </div>

        {/* ── 企業情報 ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* バッジ行 */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
            {company.industry && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)",
              }}>{company.industry}</span>
            )}
            {stageCfg && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                background: stageCfg.bg, color: stageCfg.color,
              }}>{stageCfg.label}</span>
            )}
            {company.accepting_casual_meetings && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa",
              }}>面談OK</span>
            )}
          </div>

          {/* 会社名 */}
          <div style={{ marginBottom: 4 }}>
            <span className="clc-name" style={{
              fontSize: compact ? 16 : 17,
              fontWeight: 800,
              color: "var(--ink)",
              fontFamily: isEnName ? "Inter, sans-serif" : "var(--font-noto-sans)",
              letterSpacing: isEnName ? "-0.02em" : "0",
              transition: "color 0.15s",
            }}>
              {displayName}
            </span>
            {isEnName && (
              <span style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: 6 }}>
                {company.name}
              </span>
            )}
          </div>

          {/* タグライン */}
          {company.tagline && (
            <div style={{
              fontSize: 13,
              color: "var(--ink-soft)",
              marginBottom: 6,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}>
              {company.tagline}
            </div>
          )}

          {/* 所在地 + 従業員数 + (compact時) 求人バッジ */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {company.location && (
              <span style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth={2} strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {company.location}
              </span>
            )}
            {company.employee_count && (
              <span style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2} strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                約{company.employee_count}名
              </span>
            )}
            {/* compact時: 求人件数バッジ */}
            {compact && company.job_count > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                padding: "2px 8px", borderRadius: 100,
                background: "var(--royal-50)", color: "var(--royal)",
                border: "1px solid var(--royal-100)",
                display: "inline-flex", alignItems: "center", gap: 3,
              }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--royal)", display: "inline-block" }} />
                求人 {company.job_count}件
              </span>
            )}
          </div>
        </div>

        {/* ── スタット列（リストビューのみ） ── */}
        {!compact && (
          <div className="clc-stats" style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
            <StatCol label="求人" value={company.job_count} unit="件" highlight={company.job_count > 0} />
          </div>
        )}

        {/* ── CTA（リストビューのみ） ── */}
        {!compact && (
          <div className="clc-cta" style={{ flexShrink: 0 }}>
            {company.accepting_casual_meetings ? (
              <a
                href={`/companies/${company.id}/casual-meeting`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "10px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                  color: "#fff", textDecoration: "none", whiteSpace: "nowrap",
                  boxShadow: "0 2px 8px rgba(245,158,11,0.30)",
                }}
                onClick={e => e.stopPropagation()}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                話を聞く
              </a>
            ) : company.job_count > 0 ? (
              <a
                href={`/companies/${company.id}#jobs`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "10px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                  background: "linear-gradient(135deg, var(--royal), var(--accent))",
                  color: "#fff", textDecoration: "none", whiteSpace: "nowrap",
                  boxShadow: "0 2px 8px rgba(0,35,102,0.20)",
                }}
                onClick={e => e.stopPropagation()}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3h-8l-2 4h12l-2-4z"/>
                </svg>
                求人 {company.job_count}件
              </a>
            ) : (
              <a
                href={`/companies/${company.id}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "10px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                  background: "var(--royal-50)", color: "var(--royal)",
                  border: "1px solid var(--royal-100)", textDecoration: "none", whiteSpace: "nowrap",
                }}
                onClick={e => e.stopPropagation()}
              >
                詳細を見る →
              </a>
            )}
          </div>
        )}
      </Link>
    </>
  );
}

function StatCol({ label, value, unit, highlight }: { label: string; value: number; unit: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        <span style={{
          fontSize: 20, fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          color: highlight ? "var(--royal)" : "var(--ink)",
        }}>{value}</span>
        <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{unit}</span>
      </div>
      <div style={{ fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}
