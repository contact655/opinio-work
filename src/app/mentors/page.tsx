import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Header } from "@/components/common";
import { Footer } from "@/components/common";
import {
  MOCK_MENTORS,
  filterMentors,
  type Mentor,
} from "./mockMentorData";
import MentorFilterBar from "./MentorFilterBar";

export const metadata: Metadata = {
  title: "先輩に相談する — Opinio",
  description:
    "LayerX・SmartHR・Ubie・Notionなど、IT/SaaS業界の先輩社員・元社員に直接キャリア相談。PdM・エンジニア・営業・CSのメンターが揃っています。",
};

// ─── Mentor Card ──────────────────────────────────────────────────────────────

function MentorCard({ mentor }: { mentor: Mentor }) {
  return (
    <article style={{
      display: "flex", flexDirection: "column",
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 16,
      padding: "22px 22px 20px",
      transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
    }}
      className="mentor-card"
    >
      {/* Head: avatar + name/role */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
        {/* Avatar with mentor ring */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: mentor.gradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 18, fontWeight: 700,
            boxShadow: "0 0 0 2.5px var(--royal), 0 0 0 5px rgba(0,35,102,0.12)",
          }}>
            {mentor.initial}
          </div>
          {/* Mentor ring badge */}
          <div style={{
            position: "absolute", bottom: -2, right: -2,
            width: 18, height: 18, borderRadius: "50%",
            background: "var(--royal)",
            border: "2px solid #fff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>
            {mentor.name}さん
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--ink)" }}>{mentor.current_company}</strong>
            {" · "}
            {mentor.current_role}
          </div>
        </div>
      </div>

      {/* Career chain */}
      <div style={{
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4,
        fontSize: 11.5, color: "var(--ink-mute)",
        marginBottom: 12, lineHeight: 1.6,
      }}>
        {mentor.career_chain.map((step, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {i > 0 && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} style={{ flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
            <span style={{
              color: step.is_current ? "var(--royal)" : "var(--ink-mute)",
              fontWeight: step.is_current ? 700 : 400,
            }}>
              {step.label}
            </span>
          </span>
        ))}
      </div>

      {/* Company logos (career history) */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        marginBottom: 14,
        background: "var(--bg-tint)", borderRadius: 8,
        padding: "8px 10px",
      }}>
        <span style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 600, marginRight: 2 }}>在籍</span>
        {mentor.company_logos.map((logo, i) => (
          <div key={i} title={logo.name} style={{
            width: 28, height: 28, borderRadius: 6,
            background: logo.gradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 11, fontWeight: 700,
            border: "1.5px solid #fff",
            boxShadow: "0 2px 6px rgba(15,23,42,0.1)",
            cursor: "default",
          }}>
            {logo.initial}
          </div>
        ))}
      </div>

      {/* Theme tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
        {mentor.themes.map((theme) => (
          <span key={theme} style={{
            fontSize: 10.5, padding: "4px 10px", borderRadius: 100,
            background: "#fff", border: "1px solid var(--royal-100)",
            color: "var(--royal)", fontWeight: 600,
          }}>
            {theme}
          </span>
        ))}
      </div>

      {/* CTA */}
      <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid var(--line-soft, #F1F5F9)" }}>
        <Link
          href={`/mentors/${mentor.id}/reserve`}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            width: "100%", padding: "10px",
            background: "var(--royal-50)", color: "var(--royal)",
            border: "1px solid var(--royal-100)",
            borderRadius: 8, textDecoration: "none",
            fontSize: 13, fontWeight: 700,
            transition: "background 0.2s, color 0.2s",
          }}
          className="mentor-cta"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          話を聞く（30分）
        </Link>
      </div>
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SearchParams = { [key: string]: string | string[] | undefined };

export default function MentorsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = {
    dept:     typeof searchParams.dept     === "string" ? searchParams.dept     : undefined,
    industry: typeof searchParams.industry === "string" ? searchParams.industry : undefined,
    theme:    typeof searchParams.theme    === "string" ? searchParams.theme    : undefined,
    sort:     typeof searchParams.sort     === "string" ? searchParams.sort     : undefined,
  };

  const mentors = filterMentors(MOCK_MENTORS, params);

  return (
    <>
      <Header />

      {/* Breadcrumb */}
      <div style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5 }}>
            <Link href="/" style={{ color: "var(--ink-mute)" }}>Opinio</Link>
            <span>/</span>
            <span style={{ color: "var(--ink-soft)" }}>先輩に相談</span>
          </div>
        </div>
      </div>

      {/* Page top — centered hero */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "48px 0 40px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }} className="px-5">
          {/* Stats row */}
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { value: MOCK_MENTORS.length, label: "名のメンター" },
              { value: "12", label: "社の掲載企業" },
              { value: "30", label: "分の無料相談" },
            ].map(({ value, label }) => (
              <div key={label} style={{
                display: "flex", alignItems: "baseline", gap: 3,
                fontSize: 12, color: "var(--ink-mute)",
              }}>
                <span style={{
                  fontFamily: "Inter, sans-serif", fontSize: 22, fontWeight: 700, color: "var(--royal)",
                }}>
                  {value}
                </span>
                {label}
              </div>
            ))}
          </div>

          <h1 style={{
            fontFamily: '"Noto Serif JP", serif',
            fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 500,
            color: "var(--ink)", letterSpacing: "0.04em",
            marginBottom: 24, lineHeight: 1.4,
          }}>
            先輩に、相談する。
          </h1>

          {/* Avatar preview row */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0, marginBottom: 20 }}>
            {MOCK_MENTORS.slice(0, 8).map((m, i) => (
              <div key={m.id} style={{
                width: 40, height: 40, borderRadius: "50%",
                background: m.gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 13, fontWeight: 700,
                border: "2.5px solid #fff",
                marginLeft: i === 0 ? 0 : -10,
                boxShadow: "0 0 0 2px var(--royal), 0 0 0 4px rgba(0,35,102,0.1)",
                position: "relative", zIndex: 10 - i,
              }}>
                {m.initial}
              </div>
            ))}
            {MOCK_MENTORS.length > 8 && (
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "var(--bg-tint)", border: "2px solid var(--line)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "var(--ink-mute)",
                marginLeft: -10, position: "relative", zIndex: 1,
              }}>
                +{MOCK_MENTORS.length - 8}
              </div>
            )}
          </div>

          {/* Static search bar (display only) */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "var(--bg-tint)", border: "1.5px solid var(--line)",
            borderRadius: 12, padding: "14px 18px",
            boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <span style={{
              flex: 1, fontSize: 14, color: "var(--ink-mute)",
              textAlign: "left" as const,
            }}>
              PdMからCPOになった人に話を聞きたい
            </span>
            <button style={{
              padding: "7px 16px", background: "var(--royal)", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: "pointer", flexShrink: 0,
            }}>
              検索
            </button>
          </div>

          <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.7 }}>
            メンターは Opinio 編集部が個別に声がけした方々です。申請フォームはありません。
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <Suspense fallback={<div style={{ height: 52, background: "#fff", borderBottom: "1px solid var(--line)" }} />}>
        <MentorFilterBar total={mentors.length} />
      </Suspense>

      {/* Grid */}
      <main style={{ background: "var(--bg-tint)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }} className="px-5 py-8 md:px-12 md:py-10">
          {mentors.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--ink-mute)" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
              <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--ink-soft)" }}>
                条件に合うメンターが見つかりませんでした
              </p>
              <p style={{ fontSize: 14 }}>フィルターを変更してみてください</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {mentors.map((mentor) => (
                <MentorCard key={mentor.id} mentor={mentor} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      <style>{`
        .mentor-card:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 16px 40px rgba(15,23,42,0.08) !important;
          transform: translateY(-2px) !important;
        }
        .mentor-cta:hover {
          background: var(--royal) !important;
          color: #fff !important;
        }
      `}</style>
    </>
  );
}
