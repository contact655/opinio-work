"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { CompanyForCarousel } from "@/types/genre";
import type { MemberPreview } from "./CompanyCardCompact";

// Funding stage badge config
const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  "pre-seed":  { label: "Pre-Seed",  color: "#6b5b2e", bg: "#fef9e7" },
  seed:        { label: "Seed",      color: "#6b5b2e", bg: "#fef9e7" },
  "series-a":  { label: "Series A",  color: "#1e63d8", bg: "#dbeafe" },
  "series-b":  { label: "Series B",  color: "#6b3b9e", bg: "#ede9fe" },
  "series-c":  { label: "Series C",  color: "#0f766e", bg: "#d1fae5" },
  "series-d":  { label: "Series D+", color: "#0f766e", bg: "#d1fae5" },
  growth:      { label: "成長期",    color: "#0f766e", bg: "#d1fae5" },
  listed:      { label: "上場",      color: "#1f7a48", bg: "#d4f0e3" },
  ipo:         { label: "IPO準備",   color: "#b45309", bg: "#fef3c7" },
};

function getStageCfg(stage: string | null) {
  if (!stage) return null;
  const key = stage.toLowerCase().replace(/\s+/g, "-");
  return STAGE_CONFIG[key] ?? { label: stage, color: "#4a5260", bg: "#f1f5f9" };
}

const PLACEHOLDER_COLORS = [
  { bg: "#d4f0e3", text: "#1f7a48" },
  { bg: "#fce8b8", text: "#8b5e0f" },
  { bg: "#fcd5dc", text: "#a8324a" },
  { bg: "#d8e6ff", text: "#1e63d8" },
  { bg: "#e8dcf5", text: "#6b3b9e" },
  { bg: "#f5f7fa", text: "#5b6471" },
];

function getPlaceholderColor(name: string) {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length];
}

/** 法人名サフィックス除去（"Salesforce Japan Co., Ltd." → "Salesforce"） */
function cleanEnName(nameEn: string | null | undefined): string | null {
  if (!nameEn) return null;
  const cleaned = nameEn
    .replace(/\s+Japan\s+Co\.,?\s*Ltd\.?$/i, '')
    .replace(/\s+Co\.,?\s*Ltd\.?$/i, '')
    .replace(/\s*,\s*Inc\.?$/i, '')
    .replace(/\s+Inc\.?$/i, '')
    .replace(/\s+Corp\.?$/i, '')
    .trim();
  return cleaned || null;
}

type Props = {
  company: CompanyForCarousel;
  members?: MemberPreview[];
  compact?: boolean; // リスト２列表示：stats非表示・CTAボタン省略
};

export function CompanyCardList({ company, members, compact }: Props) {
  const ph = getPlaceholderColor(company.name);
  const initial = company.logo_letter ?? company.name.slice(0, 1);
  const stageCfg = getStageCfg(company.funding_stage);
  const memberCount = company.current_member_count ?? (members?.length ?? 0);
  const obogCount = company.obog_count ?? 0;

  return (
    <>
      <style>{`
        .company-list-card:hover { box-shadow: 0 4px 20px rgba(0,35,102,0.10) !important; }
        .company-list-card:hover .clc-name { color: var(--royal) !important; }
        .clc-stat-divider { width: 1px; height: 32px; background: var(--line); }
        @media (max-width: 767px) {
          .clc-stats { display: none !important; }
          .clc-stat-divider { display: none !important; }
        }
      `}</style>
      <Link
        href={`/companies/${company.id}`}
        className="company-list-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "16px 20px",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid var(--line)",
          boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
          textDecoration: "none",
          color: "inherit",
          transition: "box-shadow 0.18s",
        }}
      >
        {/* ── ロゴ ── */}
        <div style={{
          width: 56, height: 56, borderRadius: 10, flexShrink: 0,
          background: company.logo_url ? "#f5f7fa" : ph.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", position: "relative",
        }}>
          {company.logo_url ? (
            <Image
              src={company.logo_url}
              alt={`${company.name}のロゴ`}
              fill
              style={{ objectFit: "contain", padding: "10%" }}
              sizes="56px"
            />
          ) : (
            <span style={{ fontSize: 22, fontWeight: 700, color: ph.text }}>{initial}</span>
          )}
        </div>

        {/* ── 企業情報 ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 会社名 + バッジ */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span className="clc-name" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", transition: "color 0.15s" }}>
              {company.name}
            </span>
            {cleanEnName(company.name_en) && (
              <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", fontWeight: 400 }}>
                {cleanEnName(company.name_en)}
              </span>
            )}
            {company.industry && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 100,
                background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)",
              }}>{company.industry}</span>
            )}
            {stageCfg && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                background: stageCfg.bg, color: stageCfg.color,
              }}>{stageCfg.label}</span>
            )}
            {company.accepting_casual_meetings && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa",
              }}>面談OK</span>
            )}
          </div>
          {/* タグライン */}
          {company.tagline && (
            <div style={{
              fontSize: 12.5, color: "var(--ink-soft)", marginTop: 3,
              overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
            }}>
              {company.tagline}
            </div>
          )}
          {/* 所在地 + 従業員数 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
            {company.location && (
              <span style={{ fontSize: 11, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 2 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth={2} strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {company.location}
              </span>
            )}
            {company.employee_count && (
              <span style={{ fontSize: 11, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 2 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2} strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                {company.employee_count}名規模
              </span>
            )}
          </div>
        </div>

        {/* ── スタット列（OpenWork 参考） ── */}
        {!compact && (
          <div className="clc-stats" style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
            <StatCol label="現役社員" value={memberCount} unit="名" />
            <div className="clc-stat-divider" />
            <StatCol label="OB・OG" value={obogCount} unit="名" />
            <div className="clc-stat-divider" />
            <StatCol label="求人" value={company.job_count} unit="件" highlight={company.job_count > 0} />
          </div>
        )}

        {/* ── CTA ── */}
        {!compact && (
          <div style={{ flexShrink: 0 }}>
            {company.accepting_casual_meetings ? (
              <a
                href={`/companies/${company.id}/casual-meeting`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "8px 18px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                  color: "#fff", textDecoration: "none", whiteSpace: "nowrap",
                }}
                onClick={e => e.stopPropagation()}
              >
                話を聞く →
              </a>
            ) : (
              <a
                href={`/companies/${company.id}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "8px 18px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
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
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "0 20px", gap: 2,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        <span style={{
          fontSize: 18, fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          color: highlight ? "var(--royal)" : "var(--ink)",
        }}>{value}</span>
        <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{unit}</span>
      </div>
      <div style={{ fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}
