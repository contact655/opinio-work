"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { CompanyLogo } from "@/components/jobseeker/CompanyLogo";
import type { CompanyListRow } from "@/lib/supabase/queries";
import { extractPrefecture, PREFECTURES } from "@/lib/utils/location";
import { showToast } from "@/lib/toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type LayoutMode = "card" | "list";

// ─── Constants ────────────────────────────────────────────────────────────────

const PER_PAGE_CARD = 12;
const PER_PAGE_OTHER = 15;

const INDUSTRY_OPTIONS = [
  { value: "", label: "すべての業種" },
  { value: "SaaS", label: "SaaS" },
  { value: "FinTech", label: "FinTech" },
  { value: "HR Tech", label: "HR Tech" },
  { value: "AI", label: "AI / LLM" },
  { value: "ヘルス", label: "HealthTech" },
  { value: "EC", label: "EC・クラウド" },
];

const REMOTE_OPTIONS = [
  { value: "", label: "すべての働き方" },
  { value: "full_remote", label: "フルリモート" },
  { value: "hybrid", label: "ハイブリッド" },
];

const PHASE_OPTIONS = [
  { value: "", label: "すべてのフェーズ" },
  { value: "seed", label: "シード" },
  { value: "series-a", label: "Series A" },
  { value: "series-b", label: "Series B" },
  { value: "series-c", label: "Series C" },
  { value: "listed", label: "上場" },
  { value: "unicorn", label: "ユニコーン" },
  { value: "ipo", label: "IPO準備" },
  { value: "growth", label: "成長期" },
];

// ─── Badge configs ────────────────────────────────────────────────────────────

const PHASE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  seed:     { label: "シード",    color: "#78350f", bg: "#fff7ed" },
  "series-a": { label: "Series A", color: "#1e40af", bg: "#dbeafe" },
  "series-b": { label: "Series B", color: "#5b21b6", bg: "#ede9fe" },
  "series-c": { label: "Series C", color: "#065f46", bg: "#d1fae5" },
  "series-d": { label: "Series D+", color: "#064e3b", bg: "#ccfbf1" },
  listed:   { label: "上場",      color: "#14532d", bg: "#dcfce7" },
  "上場":   { label: "上場",      color: "#14532d", bg: "#dcfce7" },
  unicorn:  { label: "ユニコーン", color: "#6d28d9", bg: "#ede9fe" },
  ipo:      { label: "IPO準備",  color: "#9a3412", bg: "#ffedd5" },
  growth:   { label: "成長期",   color: "#065f46", bg: "#d1fae5" },
};

const INDUSTRY_BADGE: Record<string, { color: string; bg: string }> = {
  "HR Tech":   { color: "#1e40af", bg: "#dbeafe" },
  "FinTech":   { color: "#065f46", bg: "#d1fae5" },
  "FinTech/SaaS": { color: "#065f46", bg: "#d1fae5" },
  "CRM":       { color: "var(--royal)", bg: "#eff3fc" },
  "AI Tech":   { color: "#6d28d9", bg: "#ede9fe" },
  "AI":        { color: "#6d28d9", bg: "#ede9fe" },
  "Sales Tech": { color: "#0f766e", bg: "#ccfbf1" },
  "セキュリティ": { color: "#9a3412", bg: "#ffedd5" },
  "Cloud/SaaS": { color: "var(--royal)", bg: "#eff3fc" },
  "SaaS":      { color: "var(--royal)", bg: "#eff3fc" },
};

function getIndustryBadge(industry: string): { color: string; bg: string } {
  for (const key of Object.keys(INDUSTRY_BADGE)) {
    if (industry.includes(key)) return INDUSTRY_BADGE[key];
  }
  return { color: "#4a5260", bg: "#f1f5f9" };
}

function getPhaseBadge(phase: string): { label: string; color: string; bg: string } | null {
  const key = phase.toLowerCase().replace(/\s+/g, "-");
  if (PHASE_BADGE[key]) return PHASE_BADGE[key];
  if (PHASE_BADGE[phase]) return PHASE_BADGE[phase];
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** 日本語法人名からブランド名（株式会社などを除去）を返す */
function getJaDisplayName(name: string): string {
  return name
    .replace(/^(株式会社|合同会社|有限会社|一般社団法人|一般財団法人)\s*/g, "")
    .replace(/\s*(株式会社|合同会社|有限会社)$/g, "")
    .trim() || name;
}

function extractNum(s: string): number {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function isForeignCompany(c: CompanyListRow): boolean {
  return (
    c.name.includes(" Japan") ||
    (!!c.name_en &&
      !c.name.includes("株式会社") &&
      !c.name.includes("合同会社") &&
      !c.name.includes("有限会社"))
  );
}

function filterSelectStyle(active: boolean, width = 110): React.CSSProperties {
  return {
    height: 38,
    width,
    padding: "0 var(--space-2)",
    border: `1px solid ${active ? "var(--royal)" : "var(--line)"}`,
    borderRadius: 8,
    fontSize: "var(--text-sm)",
    color: active ? "var(--royal)" : "var(--ink-soft)",
    background: "#fff",
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
    outline: "none",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

// ─── CompanyCardCard (4列グリッド) ────────────────────────────────────────────

function CompanyCardCard({
  company,
  bookmarked,
  onBookmark,
}: {
  company: CompanyListRow;
  bookmarked: boolean;
  onBookmark: (id: string, add: boolean) => void;
}) {
  const enName = cleanEnName(company.name_en);
  const fallbackGradient = "linear-gradient(135deg, #001233 0%, var(--royal) 60%, #1a3569 100%)";
  const industryBadge = getIndustryBadge(company.industry);
  const phaseBadge = getPhaseBadge(company.phase);

  function handleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onBookmark(company.id, !bookmarked);
  }

  return (
    <Link
      href={`/companies/${company.id}`}
      prefetch={true}
      style={{ textDecoration: "none", display: "block", height: "100%" }}
    >
      <article
        className="company-card"
        style={{
          background: "#fff",
          border: `1px solid ${company.accepting_casual_meetings ? "#A7F3D0" : "var(--line)"}`,
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          boxSizing: "border-box",
          transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
          cursor: "pointer",
        }}
      >
        {/* ── Brand color header 160px ── */}
        <div
          style={{
            position: "relative",
            height: 160,
            flexShrink: 0,
            background: company.cover_photo_url ? undefined : fallbackGradient,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {company.cover_photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.cover_photo_url}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
            />
          )}

          {/* Logo centered */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              background: "#fff",
              borderRadius: 12,
              padding: 4,
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            }}
          >
            <CompanyLogo
              name={company.name}
              logoUrl={company.logo_url}
              logoLetter={company.logo_letter}
              logoGradient={company.logo_gradient}
              size={46}
              borderRadius={8}
            />
          </div>

          {/* 面談受付中 badge top-left */}
          {company.accepting_casual_meetings && (
            <span
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 100,
                background: "rgba(255,255,255,0.92)",
                color: "var(--success)",
                backdropFilter: "blur(4px)",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--success)",
                  flexShrink: 0,
                  animation: "pulseDot 1.8s ease-in-out infinite",
                }}
              />
              面談受付中
            </span>
          )}

          {/* Bookmark button bottom-right */}
          <button
            type="button"
            onClick={handleBookmark}
            aria-label={bookmarked ? "ブックマーク解除" : "ブックマーク"}
            aria-pressed={bookmarked}
            style={{
              position: "absolute",
              bottom: 10,
              right: 10,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.92)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(4px)",
              transition: "transform 0.15s",
              zIndex: 2,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, color: bookmarked ? "#e11d48" : "#94a3b8" }}>
              {bookmarked ? "♥" : "♡"}
            </span>
          </button>
        </div>

        {/* ── Body ── */}
        <div
          style={{
            padding: "14px 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flex: 1,
          }}
        >
          {/* Industry + Phase badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 100,
                color: industryBadge.color,
                background: industryBadge.bg,
              }}
            >
              {company.industry}
            </span>
            {phaseBadge && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 100,
                  color: phaseBadge.color,
                  background: phaseBadge.bg,
                }}
              >
                {phaseBadge.label}
              </span>
            )}
            {company.member_count > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 100,
                  color: "var(--royal)",
                  background: "var(--royal-50)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                👤 {company.member_count}名登録中
              </span>
            )}
          </div>

          {/* Company name */}
          {(() => {
            const displayName = enName ?? getJaDisplayName(company.name);
            const hasSubName = !!enName || displayName !== company.name;
            return (
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--ink)",
                    lineHeight: 1.35,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {displayName}
                </div>
                {hasSubName && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--ink-mute)",
                      lineHeight: 1.4,
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {company.name}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Tagline */}
          {company.tagline ? (
            <p
              style={
                {
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: "var(--ink)",
                  flex: 1,
                  margin: 0,
                  fontWeight: 500,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                } as React.CSSProperties
              }
            >
              {company.tagline}
            </p>
          ) : <div style={{ flex: 1 }} />}

          {/* Salary */}
          {company.avg_salary && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--success)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 11 }}>💴</span>
              {company.avg_salary}
            </div>
          )}

          {/* Location + employees */}
          <div
            style={{
              fontSize: 11,
              color: "var(--ink-mute)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>📍</span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {extractPrefecture(company.location) || company.location}
            </span>
            {company.employee_count && (
              <>
                <span style={{ color: "var(--line)" }}>·</span>
                <span style={{ whiteSpace: "nowrap" }}>{company.employee_count}</span>
              </>
            )}
          </div>

          {/* CTA button */}
          {company.accepting_casual_meetings && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 0",
                borderRadius: 9,
                background: "linear-gradient(135deg, #f59e0b, #ea580c)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: "nowrap",
                width: "100%",
                boxShadow: "0 3px 8px rgba(234,88,12,0.3)",
                letterSpacing: "0.01em",
                marginTop: 4,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              話を聞く
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}

// ─── CompanyCardList (リストモード・1列) ──────────────────────────────────────

function CompanyCardList({ company }: { company: CompanyListRow }) {
  const fallbackGradient = "linear-gradient(135deg, #001233 0%, var(--royal) 60%, #1a3569 100%)";
  const industryBadge = getIndustryBadge(company.industry);
  const phaseBadge = getPhaseBadge(company.phase);
  const daysSinceUpdate = (() => {
    if (!company.updated_at) return 99;
    const diff = (Date.now() - new Date(company.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return Math.floor(diff);
  })();
  const isRecentlyUpdated = daysSinceUpdate <= 7;

  return (
    <Link href={`/companies/${company.id}`} prefetch={true} style={{ textDecoration: "none", display: "block" }}>
      <article
        className="company-card"
        style={{
          background: "#fff",
          border: `1px solid ${company.accepting_casual_meetings ? "#A7F3D0" : "var(--line)"}`,
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
          cursor: "pointer",
          boxSizing: "border-box",
        }}
      >
        {/* Cover / Gradient side strip */}
        <div
          style={{
            width: 100,
            flexShrink: 0,
            background: company.cover_photo_url ? undefined : fallbackGradient,
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {company.cover_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.cover_photo_url}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
            />
          ) : (
            <CompanyLogo
              name={company.name}
              logoUrl={company.logo_url}
              logoLetter={company.logo_letter}
              logoGradient={company.logo_gradient}
              size={40}
              borderRadius={8}
            />
          )}
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            padding: "14px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            minWidth: 0,
          }}
        >
          {/* Name + badges */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {cleanEnName(company.name_en) ?? getJaDisplayName(company.name)}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 100,
                color: industryBadge.color,
                background: industryBadge.bg,
                whiteSpace: "nowrap",
              }}
            >
              {company.industry}
            </span>
            {phaseBadge && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 100,
                  color: phaseBadge.color,
                  background: phaseBadge.bg,
                  whiteSpace: "nowrap",
                }}
              >
                {phaseBadge.label}
              </span>
            )}
            {isRecentlyUpdated && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 7px",
                  borderRadius: 100,
                  background: "#f0fdf4",
                  color: "#15803d",
                  border: "1px solid #bbf7d0",
                  whiteSpace: "nowrap",
                }}
              >
                {daysSinceUpdate === 0 ? "今日更新" : `${daysSinceUpdate}日前更新`}
              </span>
            )}
            {company.accepting_casual_meetings && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 100,
                  background: "var(--success-soft)",
                  color: "var(--success)",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "var(--success)",
                    animation: "pulseDot 1.8s ease-in-out infinite",
                  }}
                />
                面談受付中
              </span>
            )}
          </div>

          {/* Tagline */}
          {company.tagline && (
            <p
              style={
                {
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--ink)",
                  margin: 0,
                  fontWeight: 500,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                } as React.CSSProperties
              }
            >
              {company.tagline}
            </p>
          )}

          {/* Company features tags */}
          {company.company_features && company.company_features.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {company.company_features.slice(0, 5).map((feat) => (
                <span
                  key={feat}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 100,
                    background: "var(--royal-50)",
                    color: "var(--royal)",
                    border: "1px solid var(--royal-100)",
                    whiteSpace: "nowrap",
                  }}
                >
                  #{feat}
                </span>
              ))}
            </div>
          )}

          {/* Bottom row: location + salary + job count + CTA */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginTop: "auto",
            }}
          >
            {/* Location + employees */}
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-mute)",
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
              }}
            >
              <span>📍</span>
              {extractPrefecture(company.location) || company.location}
              {company.employee_count && (
                <span style={{ marginLeft: 4 }}>· {company.employee_count}</span>
              )}
            </span>

            {/* Salary */}
            {company.avg_salary && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--success)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 10 }}>💴</span>
                {company.avg_salary}
              </span>
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Job count badge — right-aligned */}
            {company.job_count > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 100,
                  background: "var(--success-soft)",
                  color: "var(--success)",
                  border: "1px solid #A7F3D0",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3h-8l-2 4h12l-2-4z"/>
                </svg>
                募集中 {company.job_count}件
              </span>
            )}

            {/* CTA button */}
            {company.accepting_casual_meetings ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 18px",
                  borderRadius: 9,
                  background: "linear-gradient(135deg, #f59e0b, #ea580c)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  boxShadow: "0 3px 8px rgba(234,88,12,0.3)",
                  letterSpacing: "0.01em",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                話を聞く
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "5px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  color: "var(--ink-mute)",
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                企業詳細 →
              </span>
            )}
          </div>
        </div>

        {/* Right panel: stats + compare */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "space-between",
            padding: "14px 16px",
            gap: 8,
            borderLeft: "1px solid var(--line-soft)",
            minWidth: 120,
          }}
          className="list-card-right-panel"
        >
          {/* Job count stat */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--success)", fontFamily: "Inter, sans-serif", lineHeight: 1.1 }}>
              {company.job_count > 0 ? company.job_count : "—"}
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 2, fontWeight: 500 }}>
              募集中
            </div>
          </div>

          {/* Compare button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // compare toggle (dispatch custom event for CompareBar)
              const stored = JSON.parse(localStorage.getItem("compare-companies") ?? "[]") as string[];
              const isIn = stored.includes(company.id);
              const updated = isIn ? stored.filter((id) => id !== company.id) : [...stored, company.id].slice(0, 3);
              localStorage.setItem("compare-companies", JSON.stringify(updated));
              window.dispatchEvent(new CustomEvent("compare-update", { detail: updated }));
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: 7,
              border: "1px solid var(--line)",
              background: "#fff",
              color: "var(--ink-soft)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M18 20V10M12 20V4M6 20v-6"/>
            </svg>
            比較
          </button>
        </div>
      </article>
    </Link>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (total <= 1) return null;

  const btnBase: React.CSSProperties = {
    height: 38,
    borderRadius: 8,
    border: "1px solid var(--line)",
    background: "#fff",
    fontSize: "var(--text-sm)",
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
    transition: "border-color 0.1s, background 0.1s, color 0.1s",
  };

  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", paddingTop: 48 }}>
      <button
        type="button"
        onClick={() => onChange(current - 1)}
        disabled={current <= 1}
        aria-label="前のページへ"
        style={{
          ...btnBase,
          minWidth: 80,
          color: "var(--ink-soft)",
          opacity: current <= 1 ? 0.4 : 1,
          cursor: current <= 1 ? "default" : "pointer",
        }}
      >
        ← 前へ
      </button>

      {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
        <button
          type="button"
          key={p}
          onClick={() => onChange(p)}
          aria-label={`${p}ページ目`}
          aria-current={p === current ? "page" : undefined}
          style={{
            ...btnBase,
            minWidth: 38,
            background: p === current ? "var(--royal)" : "#fff",
            border: `1px solid ${p === current ? "var(--royal)" : "var(--line)"}`,
            color: p === current ? "#fff" : "var(--ink-soft)",
          }}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChange(current + 1)}
        disabled={current >= total}
        aria-label="次のページへ"
        style={{
          ...btnBase,
          minWidth: 80,
          color: "var(--ink-soft)",
          opacity: current >= total ? 0.4 : 1,
          cursor: current >= total ? "default" : "pointer",
        }}
      >
        次へ →
      </button>
    </div>
  );
}

// ─── Layout icon components ───────────────────────────────────────────────────


function IconGrid({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="8" height="18" /><rect x="13" y="3" width="8" height="18" />
    </svg>
  );
}

function IconList({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function CompaniesClient({ companies }: { companies: CompanyListRow[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL-driven filter state
  const industry = searchParams.get("industry") ?? "";
  const remote = searchParams.get("remote") ?? "";
  const prefecture = searchParams.get("prefecture") ?? "";
  const phase = searchParams.get("phase") ?? "";
  const hiring = searchParams.get("hiring") === "1";
  const sort = searchParams.get("sort") ?? "newest";
  const foreign = searchParams.get("foreign") === "1";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  // Local state
  const [q, setQ] = useState("");
  const viewParam = searchParams.get("view");
  const [layout, setLayout] = useState<LayoutMode>(
    viewParam === "list" ? "list" : "card"
  );

  // Bookmark state
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const bookmarkingRef = useRef<Set<string>>(new Set());

  // Scroll shadow for sticky filter bar
  const [filterBarScrolled, setFilterBarScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setFilterBarScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Load initial bookmarks
  useEffect(() => {
    fetch("/api/bookmarks?target_type=company")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (Array.isArray(data)) {
          setBookmarkedIds(new Set(data.map((b: { target_id: string }) => b.target_id)));
        }
      })
      .catch(() => {/* ignore */});
  }, []);

  // Secondary filter visibility (都道府県のみ — リモートは常時表示に格上げ)
  const hasSecondaryFilter = !!prefecture;
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const secondaryVisible = showMoreFilters || hasSecondaryFilter;

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    // 廃止されたソート値（startup / phase 等）を除去
    const validSorts = new Set(["newest", "jobs"]);
    const s = params.get("sort");
    if (s && !validSorts.has(s)) params.delete("sort");
    router.replace(`/companies?${params.toString()}`);
  }

  function changeLayout(mode: LayoutMode) {
    setLayout(mode);
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "card") params.delete("view");
    else params.set("view", mode);
    router.replace(`/companies?${params.toString()}`);
  }

  function goPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete("page");
    else params.set("page", String(p));
    router.replace(`/companies?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Available prefectures from actual data
  const availablePrefectures = useMemo(() => {
    const prefSet = new Set<string>();
    companies.forEach((c) => {
      const p = extractPrefecture(c.location);
      if (p) prefSet.add(p);
    });
    return PREFECTURES.filter((p) => prefSet.has(p));
  }, [companies]);

  // フィルター件数計算（全件ベース）
  const phaseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of companies) {
      const key = c.phase.toLowerCase().replace(/\s+/g, "-");
      counts[key] = (counts[key] ?? 0) + 1;
      // 日本語キーでも対応
      if (c.phase) counts[c.phase] = (counts[c.phase] ?? 0) + 1;
    }
    return counts;
  }, [companies]);

  const industryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of companies) {
      for (const opt of INDUSTRY_OPTIONS) {
        if (opt.value && c.industry.toLowerCase().includes(opt.value.toLowerCase())) {
          counts[opt.value] = (counts[opt.value] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [companies]);

  // Filter + sort pipeline
  const filtered = useMemo(() => {
    let list = [...companies];

    if (q.trim()) {
      const lq = q.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(lq) ||
          (c.name_en?.toLowerCase().includes(lq) ?? false) ||
          c.tagline.toLowerCase().includes(lq)
      );
    }

    if (industry) {
      list = list.filter((c) => c.industry.toLowerCase().includes(industry.toLowerCase()));
    }

    if (phase) {
      list = list.filter((c) => c.phase.toLowerCase().includes(phase.toLowerCase()));
    }

    if (remote) {
      list = list.filter(
        (c) => c.remote_work_status?.toLowerCase().includes(remote.toLowerCase()) ?? false
      );
    }

    if (prefecture) {
      list = list.filter((c) => extractPrefecture(c.location) === prefecture);
    }

    if (hiring) {
      list = list.filter((c) => c.accepting_casual_meetings);
    }

    if (foreign) {
      list = list.filter((c) => isForeignCompany(c));
    }

    if (sort === "hiring") {
      list = [...list].sort((a, b) => b.job_count - a.job_count);
    } else if (sort === "employees") {
      list = [...list].sort((a, b) => extractNum(b.employee_count) - extractNum(a.employee_count));
    }
    // "newest": DB のデフォルト順（updated_at DESC）をそのまま維持

    return list;
  }, [companies, q, industry, phase, remote, prefecture, hiring, foreign, sort]);

  const perPage = layout === "card" ? PER_PAGE_CARD : PER_PAGE_OTHER;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const hasFilters = !!(industry || phase || remote || prefecture || hiring || foreign || q.trim());

  // Bookmark handler
  const handleBookmark = useCallback(
    async (id: string, add: boolean) => {
      if (bookmarkingRef.current.has(id)) return;
      bookmarkingRef.current.add(id);

      // Optimistic update
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (add) next.add(id);
        else next.delete(id);
        return next;
      });

      const company = companies.find((c) => c.id === id);
      if (add && company) {
        showToast(`${company.name} を気になりリストに追加しました ♥`);
      }

      try {
        const res = await fetch("/api/bookmarks", {
          method: add ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_type: "company", target_id: id }),
        });
        if (res.status === 401) {
          router.push(`/auth?next=/companies`);
          return;
        }
        if (!res.ok) throw new Error("bookmark failed");
      } catch {
        // Revert on error
        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          if (add) next.delete(id);
          else next.add(id);
          return next;
        });
      } finally {
        bookmarkingRef.current.delete(id);
      }
    },
    [companies, router]
  );

  // Sort pills config
  const SORT_PILLS = [
    { value: "newest", label: "新着順" },
    { value: "hiring", label: "募集中あり" },
    { value: "employees", label: "社員数順" },
    { value: "phase", label: "フェーズ順" },
  ] as const;

  const LAYOUT_BTNS: { mode: LayoutMode; label: string; Icon: React.FC<{ size?: number }> }[] = [
    { mode: "card", label: "カード", Icon: IconGrid },
    { mode: "list", label: "リスト", Icon: IconList },
  ];

  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      {/* ── Page hero ─────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, #001233 0%, var(--royal) 55%, #1a3569 100%)",
          padding: "40px 0 36px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", right: -80, top: -120, width: 440, height: 440, borderRadius: "50%", background: "rgba(59,95,217,0.12)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: -60, bottom: -80, width: 280, height: 280, borderRadius: "50%", background: "rgba(245,158,11,0.06)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)", marginBottom: "var(--space-3)", textTransform: "uppercase" }}>
            COMPANIES
          </div>
          <h1
            style={{
              fontFamily: "var(--font-noto-serif)",
              fontSize: "clamp(24px, 3.5vw, 34px)",
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.35,
              marginBottom: "var(--space-4)",
            }}
          >
            IT/SaaS 企業を探す
          </h1>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 13px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
              {companies.length}社掲載中
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 13px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" /></svg>
              編集部が取材・審査済み
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 13px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.18)" }}>
              全社カジュアル面談受付中
            </span>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            {[
              { icon: "👥", label: "現役社員に相談できる" },
              { icon: "🎓", label: "OB・OGの話が聞ける" },
              { icon: "💬", label: "在籍ユーザーにDMできる" },
            ].map(({ icon, label }) => (
              <span
                key={label}
                style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.7)", display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <span>{icon}</span>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick filter chips ────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "10px 48px" }} className="px-5 md:px-12">
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, marginRight: 4 }}>クイック絞り込み:</span>
          {[
            { label: "🌐 外資系", active: foreign, onClick: () => setParam("foreign", foreign ? "" : "1"), activeColor: "#6d28d9", activeBg: "#ede9fe", activeBorder: "#c4b5fd" },
            { label: "📈 上場企業", active: phase === "listed" || phase === "上場", onClick: () => setParam("phase", (phase === "listed" || phase === "上場") ? "" : "listed"), activeColor: "#14532d", activeBg: "#dcfce7", activeBorder: "#86efac" },
            { label: "💼 募集中", active: hiring, onClick: () => setParam("hiring", hiring ? "" : "1"), activeColor: "var(--royal)", activeBg: "var(--royal-50)", activeBorder: "var(--royal-100)" },
          ].map(({ label, active, onClick, activeColor, activeBg, activeBorder }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 14px", borderRadius: 999, cursor: "pointer",
                fontSize: 12, fontWeight: active ? 700 : 500,
                border: `1.5px solid ${active ? activeBorder : "var(--line)"}`,
                background: active ? activeBg : "var(--bg-tint)",
                color: active ? activeColor : "var(--ink-soft)",
                transition: "all 0.15s",
              }}
            >
              {label}
              {active && <span style={{ fontSize: 10, fontWeight: 800 }}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sticky filter bar ─────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid var(--line)",
          padding: "var(--space-2) 48px",
          position: "sticky",
          top: 60,
          zIndex: 50,
          boxShadow: filterBarScrolled ? "0 4px 12px rgba(0,35,102,0.07)" : "none",
          transition: "box-shadow 0.2s ease",
        }}
        className="px-5 md:px-12"
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
        {/* ── 行1: フィルター + ビュー切替 ── */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap", overflowX: "auto" }}>
          {/* Search input */}
          <div role="search" style={{ position: "relative", flex: "0 0 200px" }}>
            <input
              type="search"
              aria-label="企業名・キーワードで検索"
              placeholder="企業名・キーワードで検索..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                width: "100%",
                height: 38,
                padding: q ? "0 32px 0 12px" : "0 12px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontSize: "var(--text-sm)",
                color: "var(--ink)",
                outline: "none",
                background: "#fff",
                boxSizing: "border-box",
              }}
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="検索をクリア"
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--ink-mute)",
                  fontSize: "var(--text-md)",
                  lineHeight: 1,
                  padding: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* 面談受付中 pill */}
          <button
            type="button"
            onClick={() => setParam("hiring", hiring ? "" : "1")}
            aria-pressed={hiring}
            style={{
              height: 38,
              padding: "0 14px",
              borderRadius: 8,
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              border: `1px solid ${hiring ? "var(--royal)" : "var(--line)"}`,
              background: hiring ? "var(--royal)" : "#fff",
              color: hiring ? "#fff" : "var(--ink-soft)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            面談受付中
          </button>

          {/* 外資系 pill（リモートselectを除去した分のスペースに配置） */}
          <button
            type="button"
            onClick={() => setParam("foreign", foreign ? "" : "1")}
            aria-pressed={foreign}
            style={{
              height: 38,
              padding: "0 12px",
              borderRadius: 8,
              fontSize: "var(--text-sm)",
              fontWeight: foreign ? 700 : 500,
              border: `1px solid ${foreign ? "#6d28d9" : "var(--line)"}`,
              background: foreign ? "#ede9fe" : "#fff",
              color: foreign ? "#6d28d9" : "var(--ink-soft)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            🌐 外資系
          </button>

          {/* フェーズ select（件数付き） */}
          <select
            value={phase}
            onChange={(e) => setParam("phase", e.target.value)}
            style={filterSelectStyle(!!phase, 120)}
            aria-label="フェーズで絞り込み"
          >
            {PHASE_OPTIONS.map((o) => {
              const cnt = o.value
                ? (phaseCounts[o.value] ?? phaseCounts[o.value.toLowerCase().replace(/\s+/g, "-")] ?? 0)
                : companies.length;
              return (
                <option key={o.value} value={o.value}>
                  {o.label}{o.value && cnt > 0 ? ` (${cnt})` : ""}
                </option>
              );
            })}
          </select>

          {/* 業種 select（件数付き） */}
          <select
            value={industry}
            onChange={(e) => setParam("industry", e.target.value)}
            style={filterSelectStyle(!!industry, 100)}
            aria-label="業種で絞り込み"
          >
            {INDUSTRY_OPTIONS.map((o) => {
              const cnt = o.value ? (industryCounts[o.value] ?? 0) : companies.length;
              return (
                <option key={o.value} value={o.value}>
                  {o.label}{o.value && cnt > 0 ? ` (${cnt})` : ""}
                </option>
              );
            })}
          </select>

          {/* リモート select は jobs ページで表示 — companies ではスペース確保のため非表示 */}

          {/* 詳細フィルター toggle（都道府県のみ） */}
          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            style={{
              height: 38,
              padding: "0 12px",
              borderRadius: 8,
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              border: `1px solid ${hasSecondaryFilter ? "var(--royal)" : "var(--line)"}`,
              background: hasSecondaryFilter ? "var(--royal-50)" : "#fff",
              color: hasSecondaryFilter ? "var(--royal)" : "var(--ink-mute)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            都道府県
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              style={{ transition: "transform 0.2s", transform: secondaryVisible ? "rotate(180deg)" : "none" }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {secondaryVisible && (
            <select
              value={prefecture}
              onChange={(e) => setParam("prefecture", e.target.value)}
              style={filterSelectStyle(!!prefecture)}
              aria-label="都道府県で絞り込み"
            >
              <option value="">すべての都道府県</option>
              {availablePrefectures.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}

          {/* Layout toggle — 行1の右端 */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
            {LAYOUT_BTNS.map(({ mode, label, Icon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => changeLayout(mode)}
                aria-label={label}
                aria-pressed={layout === mode}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "0 10px",
                  height: 34,
                  border: `1px solid ${layout === mode ? "var(--royal)" : "var(--line)"}`,
                  borderRadius: 8,
                  background: layout === mode ? "var(--royal-50)" : "#fff",
                  color: layout === mode ? "var(--royal)" : "var(--ink-mute)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontWeight: layout === mode ? 700 : 500,
                }}
              >
                <Icon size={14} />
                <span style={{ fontSize: 11 }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── 行2: ソート専用行 ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 2 }}>
          <span style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap", fontWeight: 500, marginRight: 4 }}>
            並び替え:
          </span>
          {SORT_PILLS.map((pill) => (
            <button
              key={pill.value}
              type="button"
              onClick={() => setParam("sort", pill.value === "newest" ? "" : pill.value)}
              aria-pressed={sort === pill.value}
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: sort === pill.value ? 700 : 500,
                border: `1px solid ${sort === pill.value ? "var(--royal)" : "var(--line)"}`,
                background: sort === pill.value ? "var(--royal)" : "#fff",
                color: sort === pill.value ? "#fff" : "var(--ink-mute)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>

        </div>
      </div>

      {/* ── Active filter chips ───────────────────────────────────────────── */}
      {hasFilters && (
        <div
          style={{
            background: "#fff",
            borderBottom: "1px solid var(--line-soft)",
            padding: "8px 48px",
          }}
          className="px-5 md:px-12"
        >
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, marginRight: 2 }}>絞り込み:</span>
            {q && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>
                &ldquo;{q}&rdquo;
                <button type="button" onClick={() => setQ("")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, lineHeight: 1, color: "var(--royal)", padding: 0, fontWeight: 700 }}>×</button>
              </span>
            )}
            {phase && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>
                {PHASE_OPTIONS.find((o) => o.value === phase)?.label ?? phase}
                <button type="button" onClick={() => setParam("phase", "")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, lineHeight: 1, color: "var(--royal)", padding: 0, fontWeight: 700 }}>×</button>
              </span>
            )}
            {industry && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>
                {INDUSTRY_OPTIONS.find((o) => o.value === industry)?.label ?? industry}
                <button type="button" onClick={() => setParam("industry", "")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, lineHeight: 1, color: "var(--royal)", padding: 0, fontWeight: 700 }}>×</button>
              </span>
            )}
            {remote && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "#d1fae5", color: "#065f46", border: "1px solid #a7f3d0" }}>
                {REMOTE_OPTIONS.find((o) => o.value === remote)?.label ?? remote}
                <button type="button" onClick={() => setParam("remote", "")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, lineHeight: 1, color: "#065f46", padding: 0, fontWeight: 700 }}>×</button>
              </span>
            )}
            {prefecture && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>
                📍 {prefecture}
                <button type="button" onClick={() => setParam("prefecture", "")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, lineHeight: 1, color: "var(--royal)", padding: 0, fontWeight: 700 }}>×</button>
              </span>
            )}
            {hiring && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "#d1fae5", color: "#065f46", border: "1px solid #a7f3d0" }}>
                面談受付中
                <button type="button" onClick={() => setParam("hiring", "")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, lineHeight: 1, color: "#065f46", padding: 0, fontWeight: 700 }}>×</button>
              </span>
            )}
            {foreign && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "#ede9fe", color: "#6d28d9", border: "1px solid #c4b5fd" }}>
                🌐 外資系
                <button type="button" onClick={() => setParam("foreign", "")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, lineHeight: 1, color: "#6d28d9", padding: 0, fontWeight: 700 }}>×</button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Result area ───────────────────────────────────────────────────── */}
      <div
        style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--space-8) 48px 64px" }}
        className="px-5 md:px-12"
      >
        {/* Count + clear filters */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span
              aria-live="polite"
              aria-atomic="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: hasFilters ? "5px 14px" : "0",
                borderRadius: 100,
                background: hasFilters ? "var(--royal-50)" : "transparent",
                border: hasFilters ? "1px solid var(--royal-100)" : "none",
                transition: "all 0.2s",
              }}
            >
              <strong style={{ fontSize: "var(--text-lg)", color: "var(--royal)", fontFamily: "Inter, sans-serif", lineHeight: 1 }}>
                {filtered.length}
              </strong>
              <span style={{ fontSize: "var(--text-base)", color: hasFilters ? "var(--royal)" : "var(--ink-soft)" }}>
                {hasFilters ? "社 該当" : "社が該当"}
              </span>
            </span>
            {hasFilters && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 100,
                  background: "var(--royal)",
                  color: "#fff",
                  letterSpacing: "0.03em",
                }}
              >
                フィルター適用中
              </span>
            )}
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                router.replace("/companies");
              }}
              style={{
                fontSize: 12,
                color: "var(--ink-mute)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              クリア
            </button>
          )}
        </div>

        {/* Company grid / list */}
        {paged.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "64px 0",
              background: "#fff",
              borderRadius: 16,
              border: "1px solid var(--line)",
              marginTop: "var(--space-4)",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--royal-50)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <h3
              style={{
                fontSize: "var(--text-md)",
                fontWeight: 700,
                color: "var(--ink)",
                marginBottom: "var(--space-2)",
              }}
            >
              条件に合う企業が見つかりませんでした
            </h3>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--ink-mute)",
                marginBottom: "var(--space-4)",
              }}
            >
              フィルター条件を変えてみてください
            </p>
            <button
              type="button"
              onClick={() => {
                setQ("");
                router.replace("/companies");
              }}
              style={{
                padding: "var(--space-2) var(--space-6)",
                borderRadius: 8,
                background: "var(--royal)",
                color: "#fff",
                border: "none",
                fontSize: "var(--text-base)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              すべてリセット
            </button>
          </div>
        ) : layout === "card" ? (
          /* Card mode: 4-column grid */
          <div
            style={{
              display: "grid",
              gap: 20,
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            }}
          >
            {paged.map((c) => (
              <CompanyCardCard
                key={c.id}
                company={c}
                bookmarked={bookmarkedIds.has(c.id)}
                onBookmark={handleBookmark}
              />
            ))}
          </div>
        ) : (
          /* List mode: 1-column */
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {paged.map((c) => (
              <CompanyCardList key={c.id} company={c} />
            ))}
          </div>
        )}

        {/* 表示件数インジケーター */}
        {filtered.length > perPage && (
          <div style={{ textAlign: "center", marginBottom: 10, fontSize: 12, color: "var(--ink-mute)" }}>
            {((safePage - 1) * perPage + 1)}〜{Math.min(safePage * perPage, filtered.length)}社を表示（全{filtered.length}社）
          </div>
        )}

        {/* Pagination */}
        <Pagination current={safePage} total={totalPages} onChange={goPage} />
      </div>

      <style>{`
        .company-card:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 8px 24px rgba(0,35,102,0.10);
          transform: translateY(-2px);
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }
        @media (max-width: 640px) {
          .list-card-right-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}
