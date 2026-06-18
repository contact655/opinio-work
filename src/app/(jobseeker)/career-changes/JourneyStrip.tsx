"use client";

import Link from "next/link";
import { useState } from "react";
import type { JourneyStep } from "./mockData";

const ROLE_COLORS: Record<string, { accent: string; bg: string; text: string }> = {
  営業: { accent: "#2563EB", bg: "#EFF6FF", text: "#1E40AF" },
  マーケティング: { accent: "#D97706", bg: "#FFFBEB", text: "#92400E" },
  CS: { accent: "#059669", bg: "#ECFDF5", text: "#065F46" },
  "プロダクト": { accent: "#7C3AED", bg: "#F3E8FF", text: "#5B21B6" },
  テクニカル: { accent: "#0369A1", bg: "#F0F9FF", text: "#075985" },
  事業開発: { accent: "#EA580C", bg: "#FFF7ED", text: "#9A3412" },
};

function getColor(roleCategory: string) {
  return ROLE_COLORS[roleCategory] ?? { accent: "#475569", bg: "#F8FAFC", text: "#334155" };
}

export function JourneyStrip({
  steps,
  currentSlug,
}: {
  steps: JourneyStep[];
  currentSlug: string;
}) {
  const [activeIndex, setActiveIndex] = useState(
    steps.findIndex((s) => s.slug === currentSlug)
  );

  const active = steps[activeIndex];
  const col = active ? getColor(active.roleCategory) : getColor("営業");

  return (
    <div style={{
      background: "#fff", borderRadius: 14,
      border: "1px solid var(--line)", padding: "24px 28px",
      marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "linear-gradient(135deg, #001233, #002366)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", margin: 0 }}>
            キャリアジャーニー
          </h3>
          <p style={{ fontSize: 11, color: "var(--ink-mute)", margin: 0 }}>
            この方の転職ストーリーを時系列で見る
          </p>
        </div>
      </div>

      {/* Steps strip */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
        {steps.map((step, i) => {
          const isCurrent = step.slug === currentSlug;
          const isActive = i === activeIndex;
          const c = getColor(step.roleCategory);
          const isAvailable = !step.comingSoon && !!step.slug;

          const card = (
            <div
              key={i}
              onClick={() => setActiveIndex(i)}
              style={{
                minWidth: 160, maxWidth: 200, flex: "1 1 160px",
                borderRadius: 10, padding: "14px 14px 12px",
                border: isActive
                  ? `2px solid ${c.accent}`
                  : step.comingSoon
                    ? "1.5px dashed #CBD5E1"
                    : "1.5px solid var(--line)",
                background: isActive ? c.bg : step.comingSoon ? "#FAFAFA" : "#fff",
                cursor: step.comingSoon ? "default" : "pointer",
                position: "relative",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              {/* Step number + badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
                  color: step.comingSoon ? "#94A3B8" : isActive ? c.text : "var(--ink-mute)",
                  fontFamily: "Inter, sans-serif",
                }}>
                  STEP {String(i + 1).padStart(2, "0")}
                </span>
                {isCurrent && (
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    background: c.accent, color: "#fff",
                    borderRadius: 100, padding: "2px 7px",
                    letterSpacing: "0.04em",
                  }}>
                    読み中
                  </span>
                )}
                {step.comingSoon && (
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    background: "#E2E8F0", color: "#94A3B8",
                    borderRadius: 100, padding: "2px 7px",
                  }}>
                    準備中
                  </span>
                )}
              </div>

              {/* Companies */}
              <div style={{ marginBottom: 6 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: step.comingSoon ? "#94A3B8" : "var(--ink)",
                  lineHeight: 1.4, marginBottom: 2,
                }}>
                  {step.fromCompany}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={step.comingSoon ? "#CBD5E1" : c.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                  <div style={{
                    fontSize: 11, fontWeight: 800,
                    color: step.comingSoon ? "#94A3B8" : c.text,
                    lineHeight: 1.4,
                  }}>
                    {step.toCompany}
                  </div>
                </div>
              </div>

              {/* Meta */}
              {!step.comingSoon && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 9, fontWeight: 600,
                    color: c.text, background: c.bg,
                    borderRadius: 100, padding: "2px 7px",
                    border: `1px solid ${c.accent}30`,
                  }}>
                    {step.roleCategory}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 600, fontFamily: "Inter, sans-serif",
                    color: "var(--ink-mute)", background: "var(--bg-tint)",
                    borderRadius: 100, padding: "2px 7px",
                  }}>
                    {step.ageAtChange}歳
                  </span>
                  {step.salaryChange && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, fontFamily: "Inter, sans-serif",
                      color: step.salaryChange.startsWith("+") ? "#059669" : "var(--ink-mute)",
                      background: step.salaryChange.startsWith("+") ? "#ECFDF5" : "var(--bg-tint)",
                      borderRadius: 100, padding: "2px 7px",
                    }}>
                      {step.salaryChange}
                    </span>
                  )}
                </div>
              )}

              {step.comingSoon && (
                <p style={{ fontSize: 10, color: "#94A3B8", margin: 0 }}>近日公開予定</p>
              )}
            </div>
          );

          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 0, flex: "1 1 160px", minWidth: 0 }}>
              {isAvailable ? (
                <Link href={`/career-changes/${step.slug}`} style={{ textDecoration: "none", flex: 1 }}>
                  {card}
                </Link>
              ) : (
                <div style={{ flex: 1 }}>{card}</div>
              )}
              {i < steps.length - 1 && (
                <div style={{
                  flexShrink: 0, width: 20, display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail box for selected step */}
      {active && !active.comingSoon && (
        <div style={{
          marginTop: 16,
          padding: "14px 16px",
          borderRadius: 8,
          background: col.bg,
          border: `1px solid ${col.accent}30`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: col.text }}>
                {active.fromCompany} → {active.toCompany}
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: 8 }}>
                {active.role} / {active.ageAtChange}歳のとき
              </span>
            </div>
            {active.slug && active.slug !== currentSlug && (
              <Link href={`/career-changes/${active.slug}`} style={{
                fontSize: 11, fontWeight: 700, color: col.text,
                background: "#fff", border: `1px solid ${col.accent}`,
                borderRadius: 6, padding: "5px 12px",
                textDecoration: "none",
              }}>
                この転職ストーリーを読む →
              </Link>
            )}
            {active.slug === currentSlug && (
              <span style={{ fontSize: 11, color: col.text, fontWeight: 600 }}>
                ← 現在読んでいるストーリー
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
