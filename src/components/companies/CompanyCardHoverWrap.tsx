"use client";
import { useState } from "react";
import Link from "next/link";
import { CompanyCardCompact } from "./CompanyCardCompact";
import type { MemberPreview } from "./CompanyCardCompact";
import type { CompanyForCarousel } from "@/types/genre";

type Props = { company: CompanyForCarousel; members?: MemberPreview[] };

const WORK_STYLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  "フルリモート": { label: "フルリモート", color: "#065f46", bg: "#d1fae5" },
  "ハイブリッド": { label: "ハイブリッド", color: "#1e40af", bg: "#dbeafe" },
  "出社": { label: "出社中心", color: "#4b5563", bg: "#f3f4f6" },
};

export function CompanyCardHoverWrap({ company, members }: Props) {
  const [hovered, setHovered] = useState(false);

  const workStyle = company.remote_work_status
    ? WORK_STYLE_LABELS[company.remote_work_status] ?? null
    : null;

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CompanyCardCompact company={company} compact members={members} />

      {/* Hover preview pane */}
      {hovered && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: 0, right: 0,
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "12px 14px",
          boxShadow: "0 8px 32px rgba(0,35,102,0.14), 0 2px 8px rgba(0,35,102,0.06)",
          zIndex: 50,
          pointerEvents: "auto",
          animation: "fadeInUp 0.12s ease",
        }}>
          {/* Company name */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
            {company.name}
          </div>
          {/* Tags row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {workStyle && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                background: workStyle.bg, color: workStyle.color,
              }}>{workStyle.label}</span>
            )}
            {company.funding_stage && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                background: "var(--royal-50)", color: "var(--royal)",
              }}>{company.funding_stage}</span>
            )}
            {company.accepting_casual_meetings && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                background: "#fff7ed", color: "#c2410c",
              }}>面談OK</span>
            )}
          </div>
          {/* Tagline */}
          {company.tagline && (
            <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.5, marginBottom: 8 }}>
              {company.tagline}
            </div>
          )}
          {/* Stats */}
          <div style={{ fontSize: 11, color: "var(--ink-mute)", display: "flex", gap: 10 }}>
            {company.employee_count && <span>👥 {company.employee_count}</span>}
            {company.job_count > 0 && <span style={{ color: "var(--royal)", fontWeight: 600 }}>● 求人 {company.job_count}件</span>}
          </div>
          {/* CTA buttons */}
          <div style={{ display: "flex", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
            {company.accepting_casual_meetings && (
              <a
                href={`/companies/${company.id}/casual-meeting`}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 5, padding: "7px 0", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                  color: "#fff", textDecoration: "none",
                }}
                onClick={e => e.stopPropagation()}
              >
                💬 話を聞く
              </a>
            )}
            {company.job_count > 0 && (
              <a
                href={`/companies/${company.id}#jobs`}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 5, padding: "7px 0", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  background: "var(--royal-50)", color: "var(--royal)",
                  border: "1px solid var(--royal-100)", textDecoration: "none",
                }}
                onClick={e => e.stopPropagation()}
              >
                📋 求人 {company.job_count}件
              </a>
            )}
            {!company.accepting_casual_meetings && company.job_count === 0 && (
              <Link
                href={`/companies/${company.id}`}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 5, padding: "7px 0", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  background: "var(--royal-50)", color: "var(--royal)",
                  border: "1px solid var(--royal-100)", textDecoration: "none",
                }}
                onClick={e => e.stopPropagation()}
              >
                詳しく見る →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
