"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { CompanyForCarousel } from "@/types/genre";
import type { MemberPreview } from "./CompanyCardCompact";

// Funding stage badge config (same as CompanyCardCompact)
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

const AVATAR_COLORS = [
  { bg: "#d8e6ff", text: "#1e63d8" },
  { bg: "#e8dcf5", text: "#6b3b9e" },
  { bg: "#d4f0e3", text: "#1f7a48" },
  { bg: "#fce8b8", text: "#8b5e0f" },
];

type Props = {
  company: CompanyForCarousel;
  members?: MemberPreview[];
};

export function CompanyCardList({ company, members }: Props) {
  const ph = getPlaceholderColor(company.name);
  const initial = company.logo_letter ?? company.name.slice(0, 1);
  const stageCfg = getStageCfg(company.funding_stage);

  return (
    <>
      <style>{`
        .company-list-card:hover {
          box-shadow: 0 4px 16px rgba(0,35,102,0.12) !important;
          transform: translateY(-1px);
        }
      `}</style>
      <Link
        href={`/companies/${company.id}`}
        className="company-list-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 18px",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid var(--line)",
          boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
          textDecoration: "none",
          color: "inherit",
          transition: "box-shadow 0.18s, transform 0.18s",
        }}
      >
        {/* Logo area: 52x52 rounded square */}
        <div style={{
          width: 52, height: 52, borderRadius: 10, flexShrink: 0,
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
              sizes="52px"
            />
          ) : (
            <span style={{ fontSize: 22, fontWeight: 700, color: ph.text }}>
              {initial}
            </span>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: name + tags */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              {company.name}
            </span>
            {company.industry && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                background: "var(--royal-50)", color: "var(--royal)",
                border: "1px solid var(--royal-100)",
              }}>
                {company.industry}
              </span>
            )}
            {stageCfg && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                background: stageCfg.bg, color: stageCfg.color,
              }}>
                {stageCfg.label}
              </span>
            )}
            {company.accepting_casual_meetings && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                background: "#fff7ed", color: "#c2410c",
                border: "1px solid #fed7aa",
              }}>
                面談OK
              </span>
            )}
          </div>

          {/* Row 2: tagline */}
          {company.tagline && (
            <div style={{
              fontSize: 12, color: "var(--ink-soft)", marginTop: 3,
              overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
            }}>
              {company.tagline}
            </div>
          )}

          {/* Row 3: meta chips + member avatars */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
            {company.location && (
              <span style={{ fontSize: 11, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth={2} strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {company.location}
              </span>
            )}
            {company.employee_count && (
              <span style={{ fontSize: 11, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#639922" strokeWidth={2} strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                {company.employee_count}
              </span>
            )}
            {/* Member avatars */}
            {members && members.length > 0 && (
              <div style={{ display: "flex", alignItems: "center" }}>
                {members.slice(0, 4).map((m, i) => {
                  const ac = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  return (
                    <div key={m.id} style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: ac.bg, color: ac.text,
                      fontSize: 8, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: "2px solid #fff",
                      marginLeft: i > 0 ? -5 : 0,
                      zIndex: (members.length - i),
                      position: "relative", flexShrink: 0,
                    }}>
                      {m.name.charAt(0)}
                    </div>
                  );
                })}
                {members.length > 4 && (
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: "var(--line)", color: "var(--ink-mute)",
                    fontSize: 8, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid #fff",
                    marginLeft: -5, zIndex: 0, position: "relative", flexShrink: 0,
                  }}>
                    +{members.length - 4}
                  </div>
                )}
                <span style={{ marginLeft: 5, fontSize: 10, color: "var(--ink-mute)" }}>在籍</span>
              </div>
            )}
          </div>
        </div>

        {/* Right side: CTA buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          {company.accepting_casual_meetings && (
            <a
              href={`/companies/${company.id}/casual-meeting`}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                color: "#fff", textDecoration: "none", whiteSpace: "nowrap",
              }}
              onClick={e => e.stopPropagation()}
            >
              話を聞く →
            </a>
          )}
          {company.job_count > 0 && (
            <a
              href={`/companies/${company.id}#jobs`}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                background: "var(--royal-50)", color: "var(--royal)",
                border: "1px solid var(--royal-100)", textDecoration: "none", whiteSpace: "nowrap",
              }}
              onClick={e => e.stopPropagation()}
            >
              求人 {company.job_count}件
            </a>
          )}
        </div>
      </Link>
    </>
  );
}
