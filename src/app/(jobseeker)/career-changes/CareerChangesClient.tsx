"use client";

import Link from "next/link";
import { useState } from "react";
import type { CareerChangeStory } from "./mockData";

const ROLE_FILTERS = ["すべて", "営業", "マーケティング", "CS", "PM・プロダクト", "テクニカル", "事業開発"];

const ROLE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  営業:         { bg: "var(--royal-50)",   color: "var(--royal)",   border: "var(--royal-100)" },
  マーケティング: { bg: "var(--warm-soft)",  color: "#92400E",        border: "#FDE68A" },
  CS:           { bg: "var(--success-soft)", color: "var(--success)", border: "#A7F3D0" },
  プロダクト:    { bg: "var(--purple-soft)", color: "var(--purple)",  border: "#DDD6FE" },
  テクニカル:    { bg: "#EFF6FF",           color: "#1D4ED8",        border: "#BFDBFE" },
  事業開発:      { bg: "#FFF7ED",           color: "#C2410C",        border: "#FED7AA" },
};

const ROLE_CATEGORY_MAP: Record<string, string> = {
  "PM・プロダクト": "プロダクト",
};

export function CareerChangesClient({ stories }: { stories: CareerChangeStory[] }) {
  const [activeFilter, setActiveFilter] = useState("すべて");

  const filtered = activeFilter === "すべて"
    ? stories
    : stories.filter((s) => {
        const mapped = ROLE_CATEGORY_MAP[activeFilter] ?? activeFilter;
        return s.roleCategory === activeFilter || s.roleCategory === mapped;
      });

  const countByRole = (filter: string) => {
    if (filter === "すべて") return stories.length;
    const mapped = ROLE_CATEGORY_MAP[filter] ?? filter;
    return stories.filter((s) => s.roleCategory === filter || s.roleCategory === mapped).length;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
        padding: "52px 24px 44px",
      }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.12)", borderRadius: 100,
            padding: "4px 14px", marginBottom: 16,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.1em" }}>
              CAREER CHANGE STORIES
            </span>
          </div>
          <h1 style={{
            fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 800,
            color: "#fff", fontFamily: "var(--font-noto-serif)",
            lineHeight: 1.35, marginBottom: 14,
          }}>
            転職ストーリー
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.85, maxWidth: 540 }}>
            IT/SaaS業界への転職を経験した方々のリアルなストーリー。
            転職のきっかけ・選考プロセス・入社後のギャップまで、OPINIOのアドバイザーが詳しく解説します。
          </p>

          {/* Stats */}
          <div style={{ display: "flex", gap: 36, marginTop: 32, flexWrap: "wrap" }}>
            {[
              { num: `${stories.length}件`, label: "掲載ストーリー" },
              { num: "6社→6社", label: "転職前後の企業" },
              { num: "平均+148万円", label: "年収変化の中央値" },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif", lineHeight: 1 }}>{s.num}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 5, letterSpacing: "0.04em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        background: "#fff", borderBottom: "1px solid var(--line)",
        padding: "0 24px", position: "sticky", top: 0, zIndex: 20,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", gap: 4, overflowX: "auto", padding: "12px 0" }}>
          {ROLE_FILTERS.map((f) => {
            const active = f === activeFilter;
            const count = countByRole(f);
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                style={{
                  padding: "6px 14px", borderRadius: 100, border: "1.5px solid",
                  borderColor: active ? "var(--royal)" : "var(--line)",
                  background: active ? "var(--royal)" : "#fff",
                  color: active ? "#fff" : "var(--ink-soft)",
                  fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.12s",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                {f}
                {f !== "すべて" && count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    background: active ? "rgba(255,255,255,0.25)" : "var(--royal-50)",
                    color: active ? "#fff" : "var(--royal)",
                    borderRadius: 100, padding: "0px 6px", lineHeight: "16px",
                    minWidth: 16, textAlign: "center",
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stories list */}
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 24px 80px" }}>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20 }}>
          {filtered.length}件のストーリー
          {activeFilter !== "すべて" && (
            <button onClick={() => setActiveFilter("すべて")} style={{
              marginLeft: 8, fontSize: 11, color: "var(--royal)", background: "none",
              border: "none", cursor: "pointer", textDecoration: "underline", padding: 0,
            }}>
              すべて表示
            </button>
          )}
        </p>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--ink-mute)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <p style={{ fontSize: 14 }}>該当するストーリーは現在準備中です</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map((story) => {
              const roleStyle = ROLE_COLORS[story.roleCategory] ?? ROLE_COLORS["事業開発"];
              return (
                <Link key={story.slug} href={`/career-changes/${story.slug}`} style={{ textDecoration: "none" }}>
                  <article className="career-story-card" style={{
                    background: "#fff", borderRadius: 14,
                    border: "1px solid var(--line)",
                    padding: "20px 24px",
                    transition: "box-shadow 0.15s, transform 0.15s",
                    cursor: "pointer",
                  }}>
                    {/* Top row: From → To + salary */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                      <CompanyBadge name={story.fromCompany} industry={story.fromIndustry} variant="from" />
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </div>
                      <CompanyBadge name={story.toCompany} industry={story.toIndustry} variant="to" />

                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        {/* Role badge */}
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          background: roleStyle.bg, color: roleStyle.color,
                          border: `1px solid ${roleStyle.border}`,
                          borderRadius: 100, padding: "2px 9px",
                        }}>
                          {story.roleCategory}
                        </span>
                        {/* Salary badge */}
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          color: story.salaryChange.startsWith("+") ? "var(--success)" : "var(--ink-soft)",
                          background: story.salaryChange.startsWith("+") ? "var(--success-soft)" : "var(--bg-tint)",
                          borderRadius: 100, padding: "3px 10px",
                          fontFamily: "Inter, sans-serif",
                        }}>
                          {story.salaryChange}
                        </span>
                      </div>
                    </div>

                    {/* Headline */}
                    <h2 style={{
                      fontSize: 15, fontWeight: 700, color: "var(--ink)",
                      lineHeight: 1.55, marginBottom: 8,
                      fontFamily: "var(--font-noto-serif)",
                    }}>
                      {story.headline}
                    </h2>

                    {/* Excerpt */}
                    <p style={{
                      fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.75,
                      marginBottom: 14,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>
                      {story.excerpt}
                    </p>

                    {/* Footer */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {story.tags.slice(0, 3).map((tag) => (
                          <span key={tag} style={{
                            fontSize: 10, fontWeight: 600, color: "var(--ink-mute)",
                            background: "var(--bg-tint)", border: "1px solid var(--line)",
                            borderRadius: 100, padding: "2px 8px",
                          }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: "50%",
                            background: "linear-gradient(135deg, var(--royal), var(--accent))",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                          }}>
                            {story.authorName.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}>{story.authorName}</div>
                            <div style={{ fontSize: 10, color: "var(--ink-mute)", lineHeight: 1.2 }}>キャリアアドバイザー</div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: "var(--royal)",
                          display: "flex", alignItems: "center", gap: 3,
                        }}>
                          読む
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div style={{
          marginTop: 48, padding: "32px 28px",
          background: "linear-gradient(135deg, var(--royal-50), #ece8ff)",
          borderRadius: 16, textAlign: "center",
          border: "1px solid var(--royal-100)",
        }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--royal)", marginBottom: 8 }}>
            同じ転職を考えていますか？
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.75, marginBottom: 24, maxWidth: 440, margin: "0 auto 24px" }}>
            ストーリーに登場するような転職パスについて、
            アドバイザーに直接相談できます。完全無料・登録不要。
          </p>
          <Link href="/career-consultation" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px 26px", background: "var(--royal)", color: "#fff",
            borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none",
          }}>
            アドバイザーに無料相談する
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
          <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 12 }}>✓ 登録不要 &nbsp;✓ 完全無料 &nbsp;✓ 3営業日以内に返信</p>
        </div>
      </div>

      <style>{`
        .career-story-card:hover {
          box-shadow: 0 6px 24px rgba(0,35,102,0.1);
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}

function CompanyBadge({
  name,
  industry,
  variant,
}: {
  name: string;
  industry: string;
  variant: "from" | "to";
}) {
  const short = name
    .replace(/^(株式会社|合同会社|有限会社)/, "")
    .replace(/(株式会社|合同会社|有限会社)$/, "");
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 1,
      padding: "6px 12px", borderRadius: 8,
      background: variant === "to" ? "var(--royal-50)" : "var(--bg-tint)",
      border: `1.5px solid ${variant === "to" ? "var(--royal-100)" : "var(--line)"}`,
    }}>
      <span style={{
        fontSize: 13, fontWeight: 800,
        color: variant === "to" ? "var(--royal)" : "var(--ink)",
        whiteSpace: "nowrap", lineHeight: 1.3,
      }}>
        {short}
      </span>
      <span style={{ fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
        {industry}
      </span>
    </div>
  );
}
