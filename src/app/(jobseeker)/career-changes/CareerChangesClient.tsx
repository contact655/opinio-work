"use client";

import Link from "next/link";
import { useState } from "react";
import type { CareerChangeStory } from "./mockData";

const ROLE_FILTERS = ["すべて", "営業", "マーケティング", "CS", "PM・プロダクト", "テクニカル", "事業開発"];

const ROLE_COLORS: Record<string, { accent: string; bg: string; text: string; soft: string }> = {
  営業:           { accent: "#2563EB", bg: "#EFF6FF", text: "#1D4ED8", soft: "#BFDBFE" },
  マーケティング:  { accent: "#D97706", bg: "#FFFBEB", text: "#92400E", soft: "#FDE68A" },
  CS:             { accent: "#059669", bg: "#ECFDF5", text: "#065F46", soft: "#A7F3D0" },
  プロダクト:     { accent: "#7C3AED", bg: "#F5F3FF", text: "#5B21B6", soft: "#DDD6FE" },
  テクニカル:     { accent: "#0284C7", bg: "#F0F9FF", text: "#0369A1", soft: "#BAE6FD" },
  事業開発:       { accent: "#EA580C", bg: "#FFF7ED", text: "#9A3412", soft: "#FED7AA" },
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
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, #002875 55%, #1a3a7a 100%)",
        padding: "56px 24px 52px",
        position: "relative", overflow: "hidden",
      }}>
        {/* decorative circles */}
        <div style={{
          position: "absolute", right: -60, top: -60,
          width: 320, height: 320, borderRadius: "50%",
          background: "rgba(255,255,255,0.03)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", right: 80, bottom: -80,
          width: 200, height: 200, borderRadius: "50%",
          background: "rgba(255,255,255,0.025)", pointerEvents: "none",
        }} />

        <div style={{ maxWidth: 900, margin: "0 auto", position: "relative" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.13)", borderRadius: 100,
            padding: "4px 14px", marginBottom: 18,
            border: "1px solid rgba(255,255,255,0.15)",
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.9)", letterSpacing: "0.12em" }}>
              CAREER CHANGE STORIES
            </span>
          </div>
          <h1 style={{
            fontSize: "clamp(28px, 4.5vw, 42px)", fontWeight: 900,
            color: "#fff", fontFamily: "var(--font-noto-serif)",
            lineHeight: 1.3, marginBottom: 16,
          }}>
            転職ストーリー
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.9, maxWidth: 500 }}>
            IT/SaaS業界への転職を経験した先輩たちのリアルなストーリー。
            転職のきっかけから選考対策・入社後のギャップまで、アドバイザーが詳しく解説。
          </p>

          {/* Stats row */}
          <div style={{
            display: "flex", gap: 0, marginTop: 36,
            background: "rgba(255,255,255,0.08)", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)",
            overflow: "hidden", maxWidth: 540,
          }}>
            {[
              { num: `${stories.length}`, unit: "件", label: "掲載ストーリー" },
              { num: "6", unit: "社→6社", label: "転職前後の企業" },
              { num: "+148", unit: "万円", label: "平均年収変化" },
            ].map((s, i) => (
              <div key={s.label} style={{
                flex: 1, padding: "16px 18px",
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.1)" : "none",
              }}>
                <div style={{ fontFamily: "Inter, sans-serif", lineHeight: 1 }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>{s.num}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginLeft: 2 }}>{s.unit}</span>
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 5, letterSpacing: "0.04em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #E5E9F0",
        padding: "0 24px",
        position: "sticky", top: 0, zIndex: 20,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", gap: 4, overflowX: "auto", padding: "11px 0" }}>
          {ROLE_FILTERS.map((f) => {
            const active = f === activeFilter;
            const count = countByRole(f);
            const rc = ROLE_COLORS[f];
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                style={{
                  padding: "7px 14px", borderRadius: 100,
                  border: `1.5px solid ${active ? (rc?.accent ?? "var(--royal)") : "#E5E9F0"}`,
                  background: active ? (rc?.accent ?? "var(--royal)") : "#fff",
                  color: active ? "#fff" : "#64748B",
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
                    background: active ? "rgba(255,255,255,0.25)" : "#F1F5F9",
                    color: active ? "#fff" : "#94A3B8",
                    borderRadius: 100, padding: "0 6px", lineHeight: "16px",
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <p style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>
            {filtered.length}件のストーリー
          </p>
          {activeFilter !== "すべて" && (
            <button onClick={() => setActiveFilter("すべて")} style={{
              fontSize: 11, color: "var(--royal)", background: "none",
              border: "none", cursor: "pointer", fontWeight: 600, padding: 0,
            }}>
              ← すべて表示
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{
            background: "#fff", borderRadius: 16, padding: "60px 24px",
            textAlign: "center", color: "#94A3B8", border: "1px solid #E5E9F0",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
            <p style={{ fontSize: 14 }}>該当するストーリーは現在準備中です</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((story, idx) => {
              const rc = ROLE_COLORS[story.roleCategory] ?? ROLE_COLORS["事業開発"];
              const salaryPositive = story.salaryChange.startsWith("+");
              return (
                <Link key={story.slug} href={`/career-changes/${story.slug}`} style={{ textDecoration: "none" }}>
                  <article className="story-card" style={{
                    background: "#fff", borderRadius: 14,
                    border: "1px solid #E5E9F0",
                    borderLeft: `4px solid ${rc.accent}`,
                    overflow: "hidden",
                    transition: "box-shadow 0.15s, transform 0.15s",
                    cursor: "pointer",
                  }}>
                    {/* Card top: transition bar */}
                    <div style={{
                      padding: "18px 22px 14px",
                      background: "#FAFBFD",
                      borderBottom: "1px solid #EEF1F7",
                      display: "flex", alignItems: "center", gap: 0,
                    }}>
                      {/* Serial */}
                      <span style={{
                        fontSize: 11, fontWeight: 800,
                        color: "#C4CFDF", fontFamily: "Inter, sans-serif",
                        marginRight: 14, flexShrink: 0, letterSpacing: "0.04em",
                      }}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>

                      {/* From company */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#334155", lineHeight: 1.2, whiteSpace: "nowrap" }}>
                          {story.fromCompany.replace(/^(株式会社|合同会社|有限会社)/, "").replace(/(株式会社|合同会社|有限会社)$/, "")}
                        </span>
                        <span style={{ fontSize: 10, color: "#94A3B8", whiteSpace: "nowrap" }}>{story.fromIndustry}</span>
                      </div>

                      {/* Arrow + salary */}
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        gap: 3, padding: "0 12px", flexShrink: 0,
                      }}>
                        <svg width="24" height="14" viewBox="0 0 32 14" fill="none">
                          <path d="M0 7h28M22 1l8 6-8 6" stroke={rc.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span style={{
                          fontSize: 11, fontWeight: 800,
                          color: salaryPositive ? "#059669" : "#64748B",
                          fontFamily: "Inter, sans-serif",
                          background: salaryPositive ? "#ECFDF5" : "#F8FAFC",
                          borderRadius: 100, padding: "2px 8px",
                          border: `1px solid ${salaryPositive ? "#A7F3D0" : "#E2E8F0"}`,
                          whiteSpace: "nowrap",
                        }}>
                          {story.salaryChange}
                        </span>
                      </div>

                      {/* To company */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: rc.text, lineHeight: 1.2, whiteSpace: "nowrap" }}>
                          {story.toCompany.replace(/^(株式会社|合同会社|有限会社)/, "").replace(/(株式会社|合同会社|有限会社)$/, "")}
                        </span>
                        <span style={{ fontSize: 10, color: "#94A3B8", whiteSpace: "nowrap" }}>{story.toIndustry}</span>
                      </div>

                      {/* Spacer + role badge */}
                      <div style={{ marginLeft: "auto", paddingLeft: 12, flexShrink: 0 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          fontSize: 10, fontWeight: 800,
                          background: rc.bg, color: rc.text,
                          border: `1px solid ${rc.soft}`,
                          borderRadius: 100, padding: "3px 10px",
                          letterSpacing: "0.03em",
                        }}>
                          {story.roleCategory}
                        </span>
                      </div>
                    </div>

                    {/* Card body */}
                    <div style={{ padding: "18px 22px 16px" }}>
                      {/* Meta chips */}
                      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: "#64748B",
                          background: "#F1F5F9", borderRadius: 100, padding: "2px 8px",
                        }}>
                          {story.ageAtChange}歳
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: "#64748B",
                          background: "#F1F5F9", borderRadius: 100, padding: "2px 8px",
                        }}>
                          前職{story.yearsAtFrom}年
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: "#64748B",
                          background: "#F1F5F9", borderRadius: 100, padding: "2px 8px",
                        }}>
                          {story.role}
                        </span>
                      </div>

                      {/* Headline */}
                      <h2 style={{
                        fontSize: 15, fontWeight: 800, color: "#0F172A",
                        lineHeight: 1.6, marginBottom: 9,
                        fontFamily: "var(--font-noto-serif)",
                      }}>
                        {story.headline}
                      </h2>

                      {/* Excerpt */}
                      <p style={{
                        fontSize: 13, color: "#64748B", lineHeight: 1.8,
                        marginBottom: 16,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        {story.excerpt}
                      </p>

                      {/* Footer */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {story.tags.slice(0, 3).map((tag) => (
                            <span key={tag} style={{
                              fontSize: 10, fontWeight: 600, color: "#94A3B8",
                              background: "#F8FAFC", border: "1px solid #E2E8F0",
                              borderRadius: 100, padding: "2px 8px",
                            }}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: "50%",
                              background: `linear-gradient(135deg, ${rc.accent}, ${rc.text})`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0,
                            }}>
                              {story.authorName.charAt(0)}
                            </div>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", lineHeight: 1.2 }}>{story.authorName}</div>
                              <div style={{ fontSize: 9, color: "#94A3B8", lineHeight: 1.2 }}>キャリアアドバイザー</div>
                            </div>
                          </div>
                          <span style={{
                            fontSize: 12, fontWeight: 800,
                            color: rc.text,
                            display: "flex", alignItems: "center", gap: 3,
                            background: rc.bg, borderRadius: 100, padding: "5px 12px",
                            border: `1px solid ${rc.soft}`,
                          }}>
                            読む
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                          </span>
                        </div>
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
          marginTop: 48, padding: "36px 32px",
          background: "linear-gradient(135deg, #001233 0%, #002875 100%)",
          borderRadius: 18, textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", right: -40, top: -40,
            width: 200, height: 200, borderRadius: "50%",
            background: "rgba(255,255,255,0.04)", pointerEvents: "none",
          }} />
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", marginBottom: 10 }}>
            CAREER CONSULTATION
          </p>
          <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 8, fontFamily: "var(--font-noto-serif)" }}>
            同じ転職を考えていますか？
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.8, marginBottom: 28, maxWidth: 400, margin: "0 auto 28px" }}>
            ストーリーに登場するような転職パスについて、アドバイザーに直接相談できます。
          </p>
          <Link href="/career-consultation" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "13px 30px", background: "var(--warm)", color: "#fff",
            borderRadius: 10, fontSize: 14, fontWeight: 800, textDecoration: "none",
            boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
          }}>
            無料でアドバイザーに相談する
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 14 }}>
            ✓ 登録不要 &nbsp;·&nbsp; ✓ 完全無料 &nbsp;·&nbsp; ✓ 3営業日以内に返信
          </p>
        </div>
      </div>

      <style>{`
        .story-card:hover {
          box-shadow: 0 8px 28px rgba(0, 35, 102, 0.12);
          transform: translateY(-2px);
        }
        @media (max-width: 600px) {
          .story-card-header-from { font-size: 12px !important; }
        }
      `}</style>
    </div>
  );
}
