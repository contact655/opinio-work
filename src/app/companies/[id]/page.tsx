import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/common";
import { Footer } from "@/components/common";
import { MOCK_COMPANIES, formatUpdated, type Company } from "../mockCompanies";
import { getCompanyDetail, type CompanyDetail, type MemberRow, type InterviewCard, type ArticleItem } from "./mockDetailData";

// ─── Constants ────────────────────────────────────────────────────────────────

const AV_GRADIENTS = [
  "",
  "linear-gradient(135deg, #002366, #3B5FD9)",
  "linear-gradient(135deg, #F472B6, #DB2777)",
  "linear-gradient(135deg, #34D399, #059669)",
  "linear-gradient(135deg, #FBBF24, #D97706)",
  "linear-gradient(135deg, #818CF8, #6366F1)",
  "linear-gradient(135deg, #A78BFA, #7C3AED)",
  "linear-gradient(135deg, #22D3EE, #0891B2)",
  "linear-gradient(135deg, #F87171, #DC2626)",
];

const PHOTO_GRADIENTS = [
  "",
  "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
  "linear-gradient(135deg, #DB2777 0%, #BE185D 100%)",
  "linear-gradient(135deg, #059669 0%, #047857 100%)",
  "linear-gradient(135deg, #1E40AF 0%, #1E3A8A 100%)",
  "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)",
  "linear-gradient(135deg, #D97706 0%, #B45309 100%)",
  "linear-gradient(135deg, #0891B2 0%, #0E7490 100%)",
  "linear-gradient(135deg, #64748B 0%, #475569 100%)",
];

const FRESHNESS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  interview: { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0", label: "編集部取材" },
  survey:    { bg: "#EFF3FC", color: "#002366", border: "#DCE5F7", label: "企業アンケート" },
  article:   { bg: "#FEF3C7", color: "#B45309", border: "#FDE68A", label: "特集記事" },
  sns:       { bg: "#FCE7F3", color: "#DB2777", border: "#FBCFE8", label: "企業発信" },
};

const SOURCE_STYLE: Record<string, { bg: string; color: string }> = {
  note:    { bg: "#E0F7F3", color: "#0F766E" },
  x:       { bg: "#F1F5F9", color: "#0F172A" },
  youtube: { bg: "#FEE2E2", color: "#991B1B" },
  blog:    { bg: "#EFF3FC", color: "#002366" },
  press:   { bg: "#FED7AA", color: "#9A3412" },
  podcast: { bg: "#F3E8FF", color: "#7C3AED" },
};

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const company = MOCK_COMPANIES.find((c) => c.id === params.id);
  if (!company) return { title: "企業が見つかりません" };
  return {
    title: `${company.name} — 企業情報 | Opinio`,
    description: company.tagline,
    openGraph: {
      title: `${company.name} | Opinio`,
      description: company.tagline,
      url: `https://opinio.work/companies/${company.id}`,
    },
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Breadcrumb({ company }: { company: Company }) {
  return (
    <nav style={{
      background: "var(--bg-tint)", borderBottom: "1px solid var(--line)",
      fontSize: 12, color: "var(--ink-mute)",
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }} className="px-5 py-3 md:px-12">
        <Link href="/" style={{ color: "var(--ink-mute)" }}>Opinio</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <Link href="/companies" style={{ color: "var(--ink-mute)" }}>企業を知る</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "var(--ink-soft)" }}>{company.name}</span>
      </div>
    </nav>
  );
}

function Hero({ company, detail }: { company: Company; detail: CompanyDetail }) {
  const initial = company.name.charAt(0).toUpperCase();
  const freshLabel = formatUpdated(company.updated_days_ago);
  const isFresh = company.updated_days_ago <= 7;

  return (
    <section style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }} className="px-5 py-8 md:px-12">
        <div style={{ display: "flex", gap: 32, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
          {/* Left: logo + info */}
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            <div style={{
              width: 88, height: 88, borderRadius: 16, flexShrink: 0,
              background: company.gradient,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 36, fontWeight: 700, fontFamily: "Inter, sans-serif",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            }}>
              {initial}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 6, fontWeight: 500 }}>
                {company.industry}
              </div>
              <h1 style={{
                fontFamily: '"Noto Serif JP", serif', fontWeight: 700,
                fontSize: "clamp(22px,2.5vw,30px)", color: "var(--ink)",
                marginBottom: 6, letterSpacing: "0.01em",
              }}>
                {company.name}
              </h1>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 14 }}>
                {company.tagline}
              </p>
              {/* Feature badges */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {company.job_count > 0 && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "5px 11px", background: "var(--success-soft)", color: "var(--success)",
                    border: "1px solid #A7F3D0", borderRadius: 100, fontSize: 11, fontWeight: 600,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 6px rgba(5,150,105,0.6)" }} className="animate-blink-dot" />
                    採用中 {company.job_count}件
                  </span>
                )}
                {isFresh && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "5px 11px", background: "var(--royal-50)", color: "var(--royal)",
                    border: "1px solid var(--royal-100)", borderRadius: 100, fontSize: 11, fontWeight: 600,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    {freshLabel}
                  </span>
                )}
                {company.accepting_casual_meetings && (
                  <span style={{
                    padding: "5px 11px", background: "var(--success-soft)", color: "var(--success)",
                    border: "1px solid #A7F3D0", borderRadius: 100, fontSize: 11, fontWeight: 600,
                  }}>
                    カジュアル面談歓迎
                  </span>
                )}
                {company.phase && (
                  <span style={{
                    padding: "5px 11px", background: "var(--bg-tint)", color: "var(--ink-soft)",
                    border: "1px solid var(--line)", borderRadius: 100, fontSize: 11, fontWeight: 500,
                  }}>
                    {company.phase}
                  </span>
                )}
                {company.is_editors_pick && (
                  <span style={{
                    padding: "5px 11px", background: "var(--purple-soft, #F3E8FF)", color: "var(--purple)",
                    border: "1px solid #E9D5FF", borderRadius: 100, fontSize: 11, fontWeight: 600,
                  }}>
                    ★ Editor&apos;s Pick
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: action buttons */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignSelf: "flex-start" }}>
            {["♡", "+", "⤷"].map((icon, i) => (
              <button key={i} style={{
                width: 40, height: 40, border: "1px solid var(--line)", background: "#fff",
                borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--ink-soft)", cursor: "pointer", fontSize: 16,
              }}>
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Hero stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16,
          paddingTop: 24, marginTop: 24, borderTop: "1px solid var(--line-soft)",
        }} className="[grid-template-columns:repeat(2,1fr)] sm:[grid-template-columns:repeat(4,1fr)]">
          {[
            {
              icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>,
              label: "社員数", value: company.employee_count.toLocaleString(), unit: "名", sub: "直近公表値",
            },
            { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>,
              label: "事業ステージ", value: company.phase, unit: "", sub: "直近公表値", isText: true },
            { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
              label: "設立", value: detail.established, unit: "", sub: "", isText: true },
            { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>,
              label: "募集中の求人", value: String(company.job_count), unit: "件", sub: "現在公開中" },
          ].map(({ icon, label, value, unit, sub, isText }) => (
            <div key={label} style={{ padding: "6px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-mute)", fontWeight: 500, marginBottom: 6 }}>
                <span style={{ color: "var(--royal)" }}>{icon}</span>
                {label}
              </div>
              <div style={{
                fontFamily: isText ? undefined : "Inter, sans-serif",
                fontSize: isText ? 16 : 22, fontWeight: 700,
                color: "var(--ink)", lineHeight: 1.2, marginBottom: 4,
              }}>
                {value}
                {unit && <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 500, marginLeft: 2 }}>{unit}</span>}
              </div>
              {sub && <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TabsBar({ company, detail }: { company: Company; detail: CompanyDetail }) {
  const tabs = [
    { label: "概要", active: true },
    { label: "求人", count: company.job_count },
    { label: "現役社員", count: detail.current.reduce((s, r) => s + r.count, 0), color: "var(--success)" },
    { label: "OBOG", count: detail.alumni.reduce((s, r) => s + r.count, 0), color: "var(--purple)" },
    { label: "インタビュー", count: detail.interviews.length },
    { label: "取材レポート", count: detail.articles.length },
  ];

  return (
    <nav style={{
      position: "sticky", top: 64, zIndex: 50,
      background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--line)",
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", overflowX: "auto" }} className="px-5 md:px-12">
        <div style={{ display: "flex", gap: 4 }}>
          {tabs.map(({ label, count, active, color }) => (
            <button key={label} style={{
              padding: "14px 18px", background: "none", border: "none",
              fontFamily: "inherit", fontSize: 13,
              fontWeight: active ? 700 : 500,
              color: active ? "var(--royal)" : (color ?? "var(--ink-mute)"),
              cursor: "pointer", whiteSpace: "nowrap",
              borderBottom: active ? "2px solid var(--royal)" : "2px solid transparent",
              transition: "all 0.2s",
            }}>
              {label}
              {count !== undefined && (
                <span style={{
                  display: "inline-block", marginLeft: 4,
                  fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700,
                  color: color ?? "var(--royal)",
                }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

function SecTitle({ icon, children, iconColor = "default" }: {
  icon: React.ReactNode; children: React.ReactNode; iconColor?: "default" | "green" | "purple" | "warm" | "pink";
}) {
  const iconBg: Record<string, string> = {
    default: "var(--royal-50)", green: "var(--success-soft, #ECFDF5)",
    purple: "var(--purple-soft, #F3E8FF)", warm: "var(--warm-soft, #FEF3C7)", pink: "var(--pink-soft, #FCE7F3)",
  };
  const iconFg: Record<string, string> = {
    default: "var(--royal)", green: "var(--success)",
    purple: "var(--purple)", warm: "#B45309", pink: "var(--pink, #DB2777)",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: '"Noto Serif JP", serif', fontWeight: 500, fontSize: 20, color: "var(--ink)", letterSpacing: "0.02em" }}>
      <span style={{
        width: 28, height: 28, borderRadius: 7,
        background: iconBg[iconColor], color: iconFg[iconColor],
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {icon}
      </span>
      {children}
    </div>
  );
}

function FreshnessTimeline({ detail }: { detail: CompanyDetail }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, var(--royal-50) 0%, #fff 100%)",
      border: "1px solid var(--royal-100)", borderRadius: 16, padding: "20px 24px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 13, fontWeight: 700, color: "var(--royal)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        情報の鮮度
      </div>
      <div style={{ position: "relative", paddingLeft: 8 }}>
        {detail.freshness.map((item, i) => {
          const s = FRESHNESS_STYLE[item.type] ?? FRESHNESS_STYLE.article;
          const isLast = i === detail.freshness.length - 1;
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: 16, position: "relative", paddingBottom: isLast ? 0 : 18 }}>
              {!isLast && (
                <div style={{ position: "absolute", left: 7, top: 22, bottom: -2, borderLeft: "2px dotted var(--royal-100)" }} />
              )}
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", border: "3px solid var(--royal)", marginTop: 4, zIndex: 1 }} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>{item.date}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                    {s.label}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>{item.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OpinionSection({ company, detail }: { company: Company; detail: CompanyDetail }) {
  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "28px 32px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <SecTitle icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>}>
          Opinioの見解
        </SecTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--ink-mute)" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5}><path d="M20 6L9 17l-5-5"/></svg>
          {detail.opinion_date}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="[grid-template-columns:1fr] sm:[grid-template-columns:1fr_1fr]">
        <div style={{ padding: 20, borderRadius: 12, background: "var(--success-soft, #ECFDF5)", border: "1px solid #A7F3D0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--success)", marginBottom: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            フィットしやすい点
          </div>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {detail.opinion_fit.map((item, i) => (
              <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={3} style={{ flexShrink: 0, marginTop: 3 }}><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ padding: 20, borderRadius: 12, background: "var(--warm-soft, #FEF3C7)", border: "1px solid #FDE68A" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#B45309", marginBottom: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
            注意したい点
          </div>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {detail.opinion_care.map((item, i) => (
              <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth={3} style={{ flexShrink: 0, marginTop: 3 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: "14px 18px", background: "#fff", border: "1px solid var(--line)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--ink)", display: "block", fontSize: 14, marginBottom: 2 }}>この見解、実際のところどうなのか。</strong>
          {company.name}で働いていた/いる先輩に、カジュアルに話を聞けます。
        </div>
        <Link href="/mentors" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "10px 20px", background: "var(--royal)", color: "#fff",
          borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none",
        }}>
          先輩に相談する →
        </Link>
      </div>
    </section>
  );
}

function AboutSection({ company, detail }: { company: Company; detail: CompanyDetail }) {
  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "28px 32px", marginBottom: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <SecTitle icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>}>
          企業について
        </SecTitle>
      </div>

      {/* Mission */}
      <div style={{ padding: 24, background: "linear-gradient(135deg, var(--royal-50) 0%, #fff 100%)", border: "1px solid var(--royal-100)", borderRadius: 12, marginBottom: 20 }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "var(--accent)", marginBottom: 10 }}>MISSION</div>
        <div style={{ fontFamily: '"Noto Serif JP", serif', fontSize: 22, fontWeight: 500, color: "var(--royal)", lineHeight: 1.5, letterSpacing: "0.02em" }}>
          {detail.mission}
        </div>
      </div>

      {/* Office photo placeholder */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, height: 240, marginBottom: 10 }} className="[grid-template-columns:1fr] sm:[grid-template-columns:2fr_1fr] [height:auto]">
        <div style={{
          borderRadius: 12, background: company.gradient, position: "relative",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 8, minHeight: 160,
        }}>
          <span style={{ position: "absolute", top: 12, left: 12, background: "rgba(255,255,255,0.95)", color: "var(--ink)", fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 100, letterSpacing: "0.05em" }}>
            Opinio編集部 撮影
          </span>
          <div style={{ color: "rgba(255,255,255,0.95)", fontFamily: '"Noto Serif JP", serif', fontWeight: 500, fontStyle: "italic", fontSize: 20, textAlign: "center", lineHeight: 1.4 }}>
            Working at {company.name}
          </div>
          <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "rgba(255,255,255,0.85)", textAlign: "center" }}>
            {detail.hq.split(" ")[0].toUpperCase()}
          </div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 16px", background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%)", color: "#fff", fontSize: 12, fontWeight: 500, borderRadius: "0 0 12px 12px" }}>
            メインオフィス
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 10 }}>
          <div style={{ borderRadius: 12, background: "linear-gradient(135deg, #1E40AF, #1E3A8A)", position: "relative", minHeight: 80 }}>
            <span style={{ position: "absolute", top: 8, left: 8, background: "rgba(255,255,255,0.95)", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 100 }}>OFFICE</span>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 12px", background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%)", color: "#fff", fontSize: 11, borderRadius: "0 0 12px 12px" }}>エントランス</div>
          </div>
          <div style={{ borderRadius: 12, background: "linear-gradient(135deg, #059669, #047857)", position: "relative", minHeight: 80 }}>
            <span style={{ position: "absolute", top: 8, left: 8, background: "rgba(255,255,255,0.95)", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 100 }}>EVENT</span>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 12px", background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%)", color: "#fff", fontSize: 11, borderRadius: "0 0 12px 12px" }}>全社イベントスペース</div>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        2026.04 Opinio編集部 訪問取材時に撮影
      </div>

      <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9 }}>
        {detail.about}
      </p>
    </section>
  );
}

function WorkStyleSection({ company, detail }: { company: Company; detail: CompanyDetail }) {
  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "28px 32px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <SecTitle iconColor="warm" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 4v4M16 4v4"/></svg>}>
          働き方の選択肢
        </SecTitle>
        <div style={{ fontSize: 11, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5}><path d="M20 6L9 17l-5-5"/></svg>
          企業アンケート 4月回答
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 18, lineHeight: 1.7 }}>
        <strong style={{ color: "var(--ink)" }}>企業が「対応している」と申告した働き方</strong>を表示しています。
        実際のリモート頻度・残業時間・柔軟性は、現役社員のインタビュー記事でご確認ください。
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }} className="[grid-template-columns:1fr] sm:[grid-template-columns:1fr_1fr]">
        <div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Remote / Location
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {detail.work_location.map(({ label, note }, i) => (
              <div key={i}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", background: "var(--success-soft, #ECFDF5)",
                  border: "1px solid #A7F3D0", borderRadius: 100, fontSize: 13,
                  color: "var(--success)", fontWeight: 600,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M20 6L9 17l-5-5"/></svg>
                  {label}
                </span>
                {note && <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6, paddingLeft: 14 }}>{note}</div>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Work Style
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {detail.work_style.map(({ label, note }, i) => (
              <div key={i}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", background: "var(--success-soft, #ECFDF5)",
                  border: "1px solid #A7F3D0", borderRadius: 100, fontSize: 13,
                  color: "var(--success)", fontWeight: 600,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M20 6L9 17l-5-5"/></svg>
                  {label}
                </span>
                {note && <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6, paddingLeft: 14 }}>{note}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 16, padding: "12px 14px", background: "var(--bg-tint)", borderRadius: 8, display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.7 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <div>
          実際のリモート頻度や残業時間は部署・職種によって異なります。
          <strong style={{ color: "var(--royal)" }}>「先輩への相談」</strong>で、あなたが受ける可能性のあるポジションの実態をご確認ください。
        </div>
      </div>
    </section>
  );
}

function JobsSection({ company, detail }: { company: Company; detail: CompanyDetail }) {
  if (detail.jobs.length === 0) {
    return (
      <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "28px 32px", marginBottom: 20 }}>
        <SecTitle icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>}>
          募集中の求人
        </SecTitle>
        <p style={{ marginTop: 20, fontSize: 14, color: "var(--ink-mute)", textAlign: "center", padding: "32px 0" }}>
          現在、公開中の求人はありません。
        </p>
      </section>
    );
  }

  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "28px 32px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <SecTitle icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>}>
          募集中の求人
          <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, fontFamily: "Inter, sans-serif" }}>· {company.job_count}件</span>
        </SecTitle>
        <Link href={`/jobs?company=${company.id}`} style={{ color: "var(--royal)", fontSize: 13, fontWeight: 500 }}>すべて見る →</Link>
      </div>

      {detail.jobs.map((cat) => (
        <div key={cat.cat} style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "10px 16px", background: "var(--royal-50)", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--royal)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              {cat.cat}
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "var(--royal)", background: "#fff", padding: "2px 10px", borderRadius: 100, fontWeight: 700 }}>{cat.total}件</span>
            </div>
            <Link href={`/jobs?company=${company.id}`} style={{ fontSize: 12, color: "var(--royal)", fontWeight: 500 }}>すべて見る →</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cat.items.map((job, i) => (
              <Link key={i} href={`/jobs`} style={{
                display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16,
                padding: "14px 18px", border: "1px solid var(--line)", borderRadius: 10,
                cursor: "pointer", background: "#fff", textDecoration: "none", alignItems: "center",
              }} className="job-item-link">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>{job.title}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {job.is_new && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "var(--success-soft, #ECFDF5)", color: "var(--success)", fontWeight: 700, border: "1px solid #A7F3D0" }}>新着</span>}
                    {job.tags.map((tag) => (
                      <span key={tag} style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 4,
                        background: tag.includes("リモート") ? "var(--royal-50)" : "var(--bg-tint)",
                        color: tag.includes("リモート") ? "var(--royal)" : "var(--ink-soft)",
                        border: `1px solid ${tag.includes("リモート") ? "var(--royal-100)" : "var(--line)"}`,
                        fontWeight: 500,
                      }}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700, color: "var(--royal)", flexShrink: 0, textAlign: "right" }}>{job.salary}</div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <Link href={`/jobs?company=${company.id}`} style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "10px 24px", background: "#fff", color: "var(--royal)",
          border: "1.5px solid var(--royal)", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none",
        }}>
          {company.job_count}件すべての求人を見る →
        </Link>
      </div>
    </section>
  );
}

function MembersSection({ rows, type, count }: { rows: MemberRow[]; type: "current" | "alumni"; count: number }) {
  const isCurrent = type === "current";
  const colorScheme = isCurrent
    ? { titleColor: "var(--success)", bg: "var(--success-soft, #ECFDF5)", border: "1px solid #A7F3D0", countClass: "current", ringColor: "none" }
    : { titleColor: "var(--purple)", bg: "var(--purple-soft, #F3E8FF)", border: "1px solid #E9D5FF", countClass: "alumni", ringColor: "none" };

  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "28px 32px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <SecTitle iconColor={isCurrent ? "green" : "purple"} icon={
          isCurrent
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
        }>
          {isCurrent ? "現役社員" : "OBOG（卒業生）"}
          <span style={{ fontSize: 14, color: colorScheme.titleColor, fontWeight: 700, fontFamily: "Inter, sans-serif", marginLeft: 4 }}>{count}名</span>
        </SecTitle>
        <div style={{ fontSize: 11, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5}><path d="M20 6L9 17l-5-5"/></svg>
          OPINIOアカウントと紐づけ
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 18 }}>
        {isCurrent
          ? "現在在籍中の社員のうち、OPINIOアカウント登録者です。職種別の内訳をご覧ください。"
          : "退職した卒業生のうち、OPINIOアカウント登録者です。メンター登録済みの方には相談予約できます。"}
      </p>

      {rows.length > 0 ? (
        <>
          <div style={{ background: colorScheme.bg, border: colorScheme.border, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
            {rows.map((row, ri) => (
              <div key={ri} style={{
                display: "grid", gridTemplateColumns: "110px 1fr auto", gap: 16, alignItems: "center",
                padding: "14px 18px", background: "rgba(255,255,255,0.4)",
                borderBottom: ri < rows.length - 1 ? `1px solid ${isCurrent ? "rgba(167,243,208,0.5)" : "rgba(233,213,255,0.5)"}` : "none",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{row.dept}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  {row.initials.map((init, idx) => (
                    <div key={idx} style={{
                      width: 32, height: 32, borderRadius: "50%", background: AV_GRADIENTS[(idx % 8) + 1],
                      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 600, fontSize: 12, cursor: "pointer", flexShrink: 0,
                      ...(row.mentor_flags[idx] ? { boxShadow: "0 0 0 2px var(--royal), 0 0 0 3px #fff" } : {}),
                    }}>
                      {init}
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "var(--ink-soft)", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap", minWidth: 80 }}>
                  <strong style={{ fontSize: 18, fontWeight: 700, color: isCurrent ? "var(--success)" : "var(--purple)" }}>{row.count}</strong>名
                  <span style={{ display: "block", fontSize: 10, color: "var(--ink-mute)", marginTop: 2 }}>
                    {row.mentors > 0 ? <>うち <strong style={{ color: "var(--royal)", fontSize: 11 }}>{row.mentors}</strong> メンター</> : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 11, color: "var(--ink-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: AV_GRADIENTS[1] }} />
              一般社員
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: AV_GRADIENTS[1], boxShadow: "0 0 0 1.5px var(--royal), 0 0 0 2.5px #fff" }} />
              メンター登録済み（相談可能）
            </div>
          </div>
        </>
      ) : (
        <p style={{ fontSize: 14, color: "var(--ink-mute)", textAlign: "center", padding: "24px 0" }}>
          {isCurrent ? "現在、登録中の社員はいません。" : "現在、登録中のOBOGはいません。"}
        </p>
      )}
    </section>
  );
}

function InterviewsSection({ interviews }: { interviews: InterviewCard[] }) {
  if (interviews.length === 0) return null;

  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "28px 32px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <SecTitle icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>}>
          Opinio編集部のインタビュー
          <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, fontFamily: "Inter, sans-serif" }}>· {interviews.length}本</span>
        </SecTitle>
        <a href="#" style={{ color: "var(--royal)", fontSize: 13, fontWeight: 500 }}>すべて見る →</a>
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20 }}>編集部が現役社員・卒業生の皆さんに取材したインタビュー記事です。</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="[grid-template-columns:1fr] sm:[grid-template-columns:repeat(2,1fr)]">
        {interviews.map((iv, i) => (
          <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 12, background: "#fff", overflow: "hidden", cursor: "pointer" }}>
            {/* Photo header */}
            <div style={{ height: 100, background: PHOTO_GRADIENTS[iv.photo], position: "relative" }}>
              {!iv.is_current && (
                <span style={{ position: "absolute", top: 12, right: 12, padding: "4px 12px", borderRadius: 100, fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.95)", color: "var(--purple)" }}>
                  現在はOBOG
                </span>
              )}
            </div>
            <div style={{ padding: "0 18px 18px" }}>
              {/* Avatar + name */}
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", background: AV_GRADIENTS[iv.ac],
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 600, fontSize: 18, flexShrink: 0,
                  border: "3px solid #fff", marginTop: -24, boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}>
                  {iv.initial}
                </div>
                <div style={{ flex: 1, paddingTop: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{iv.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>{iv.role} · {iv.tenure}</div>
                  <span style={{
                    display: "inline-block", marginTop: 6, fontSize: 10, fontWeight: 700,
                    padding: "3px 10px", borderRadius: 100, border: "1px solid",
                    ...(iv.is_current
                      ? { background: "var(--success-soft, #ECFDF5)", color: "var(--success)", borderColor: "#A7F3D0" }
                      : { background: "var(--purple-soft, #F3E8FF)", color: "var(--purple)", borderColor: "#E9D5FF" }),
                  }}>
                    {iv.status_label ?? "現在も在籍中"}
                  </span>
                </div>
              </div>
              {/* Career */}
              <div style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.7, padding: "10px 12px", background: "var(--bg-tint)", borderRadius: 8, marginTop: 12 }}>
                {iv.career.split(" → ").map((part, pi, arr) => (
                  <span key={pi}>
                    {pi === arr.length - 1 ? <strong style={{ color: "var(--ink)" }}>{part}</strong> : part}
                    {pi < arr.length - 1 && <span style={{ color: "var(--royal)", margin: "0 4px", fontFamily: "Inter, sans-serif" }}>→</span>}
                  </span>
                ))}
              </div>
              {/* Interview preview */}
              <div style={{ marginTop: 12, padding: 14, background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 10 }}>
                <div style={{ fontFamily: '"Noto Serif JP", serif', fontSize: 14, fontWeight: 500, color: "var(--ink)", lineHeight: 1.5, marginBottom: 10, letterSpacing: "0.01em" }}>
                  {iv.catch}
                </div>
                <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 8, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                  Interview by Opinio編集部 · {iv.date} 取材
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--royal)" }}>
                  インタビュー全文を読む
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ArticlesSection({ articles }: { articles: ArticleItem[] }) {
  if (articles.length === 0) return null;
  const THUMB_GRADIENTS = [
    "linear-gradient(135deg, var(--royal), var(--accent))",
    "linear-gradient(135deg, var(--success), #047857)",
    "linear-gradient(135deg, var(--warm, #F59E0B), #D97706)",
  ];

  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "28px 32px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <SecTitle icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/></svg>}>
          Opinio編集部の取材レポート
          <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, fontFamily: "Inter, sans-serif" }}>· {articles.length}本</span>
        </SecTitle>
        <a href="#" style={{ color: "var(--royal)", fontSize: 13, fontWeight: 500 }}>すべて見る →</a>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {articles.map((a, i) => (
          <div key={i} style={{
            display: "flex", gap: 16, padding: "14px 16px",
            border: "1px solid var(--line)", borderRadius: 10, cursor: "pointer", background: "#fff",
          }}>
            <div style={{
              width: 88, height: 68, borderRadius: 6, flexShrink: 0,
              background: THUMB_GRADIENTS[(a.thumb - 1) % 3],
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "var(--ink-mute)", marginBottom: 5, fontWeight: 600 }}>
                <span style={{
                  padding: "2px 7px", borderRadius: 4,
                  background: a.type === "interview" ? "var(--success-soft, #ECFDF5)" : "var(--warm-soft, #FEF3C7)",
                  color: a.type === "interview" ? "var(--success)" : "#B45309",
                }}>
                  {a.type === "interview" ? "編集部取材" : "特集記事"}
                </span>
                <span>{a.date}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.5, marginBottom: 4 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {a.excerpt}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RelatedSection({ related }: { related: string[] }) {
  const relatedCompanies = related
    .map((id) => MOCK_COMPANIES.find((c) => c.id === id))
    .filter(Boolean) as Company[];

  if (relatedCompanies.length === 0) return null;

  const REASONS: Record<string, string> = {
    smarthr: "HR Techで急拡大中、組織カルチャーが近い",
    freee: "FinTech SaaSで、バックオフィス領域で競合・補完関係",
    sansan: "同じデータビジネスSaaSで、事業ドメインが近い",
    layerx: "急成長スタートアップで、経営直下の裁量が大きい",
    "money-forward": "FinTech上場企業で、CFO層・FP&A人材の需要が高い",
    ubie: "HealthTech×AIで、テクノロジー活用領域が近い",
    "hubspot-japan": "外資SaaSで、少数精鋭チームのカルチャーが近い",
    "salesforce-japan": "エンタープライズSaaSで、大規模組織営業の経験を積める",
    "datadog-japan": "クラウドインフラSaaSで、エンジニア採用に強い",
    "notion-japan": "外資SaaSで、プロダクトドリブンのカルチャーが近い",
    kubell: "中小企業向けSaaSで、事業規模・顧客層が近い",
    "pksha-technology": "AI×SaaSで、技術投資の姿勢が近い",
  };

  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "28px 32px", marginBottom: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <SecTitle icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg>}>
          こんな企業も見られています
        </SecTitle>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }} className="[grid-template-columns:1fr] sm:[grid-template-columns:repeat(2,1fr)] lg:[grid-template-columns:repeat(3,1fr)]">
        {relatedCompanies.map((c) => (
          <Link key={c.id} href={`/companies/${c.id}`} style={{ padding: 14, border: "1px solid var(--line)", borderRadius: 10, background: "#fff", textDecoration: "none", display: "block", transition: "all 0.2s" }} className="related-card-link">
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 7, background: c.gradient, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {c.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>{c.name}</div>
                <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>{c.phase}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              {REASONS[c.id] ?? `${c.industry}領域で類似した事業モデル`}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Sidebar({ company, detail }: { company: Company; detail: CompanyDetail }) {
  return (
    <aside style={{ position: "sticky", top: 132, alignSelf: "start", display: "flex", flexDirection: "column", gap: 16 }} className="hidden lg:flex">
      {/* CTA */}
      <div style={{
        background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
        color: "#fff", padding: 22, borderRadius: 16,
        boxShadow: "0 12px 32px rgba(0,35,102,0.2)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.8, marginBottom: 4, letterSpacing: "0.08em" }}>
          {company.name}へ、一歩
        </div>
        <div style={{ fontFamily: '"Noto Serif JP", serif', fontSize: 18, fontWeight: 500, marginBottom: 14, lineHeight: 1.5 }}>
          {company.job_count}件の求人を、<br />見てみませんか？
        </div>
        <Link href={`/jobs?company=${company.id}`} style={{
          display: "block", width: "100%", padding: 12, background: "#fff", color: "var(--royal)",
          borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", textAlign: "center", textDecoration: "none",
        }}>
          求人を見る →
        </Link>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={{
            flex: 1, padding: 10, background: "rgba(255,255,255,0.1)", color: "#fff",
            border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8,
            fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            この企業を追う
          </button>
          <Link href={`/companies/${company.id}/casual-meeting`} style={{
            flex: 1, padding: 10, background: "rgba(255,255,255,0.1)", color: "#fff",
            border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8,
            fontSize: 12, fontWeight: 600, textDecoration: "none", textAlign: "center",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            面談を申し込む
          </Link>
        </div>
      </div>

      {/* Mentors */}
      {(detail.mentor_current + detail.mentor_alumni) > 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} strokeLinecap="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/></svg>
              話を聞ける先輩
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
              <strong style={{ color: "var(--success)" }}>{detail.mentor_current + detail.mentor_alumni}名</strong>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 12, lineHeight: 1.6 }}>
            メンター登録済みの先輩のみが、ご相談を受け付けています。
          </div>
          <div style={{ display: "flex", marginBottom: 12 }}>
            {detail.mentor_avatars.slice(0, 5).map((init, i) => (
              <div key={i} style={{
                width: 32, height: 32, borderRadius: "50%", background: AV_GRADIENTS[(i % 7) + 1],
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 600, marginLeft: i === 0 ? 0 : -6, border: "2px solid #fff",
              }}>
                {init}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 14, fontSize: 11, color: "var(--ink-soft)", fontWeight: 500 }}>
            <span><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--success)", marginRight: 4, verticalAlign: "middle" }} />現役 {detail.mentor_current}</span>
            <span><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--purple)", marginRight: 4, verticalAlign: "middle" }} />OBOG {detail.mentor_alumni}</span>
          </div>
          <button style={{
            width: "100%", padding: 10, background: "var(--royal-50)", color: "var(--royal)",
            border: "1px solid var(--royal-100)", borderRadius: 8, fontFamily: "inherit",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            先輩に話を聞く →
          </button>
        </div>
      )}

      {/* Company Info */}
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-mute)", marginBottom: 14, textTransform: "uppercase" }}>
          Company Info
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { key: "業界", value: company.industry },
            { key: "事業ステージ", value: company.phase },
            { key: "所在地", value: detail.hq },
            { key: "設立", value: detail.established },
            { key: "資本金", value: detail.capital },
            { key: "代表者", value: detail.ceo },
            { key: "公式サイト", value: detail.url, isLink: true },
          ].map(({ key, value, isLink }) => (
            <div key={key} style={{ display: "grid", gridTemplateColumns: "85px 1fr", gap: 12, fontSize: 13, alignItems: "flex-start" }}>
              <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>{key}</span>
              {isLink ? (
                <a href={`https://${value}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", textDecoration: "underline", fontWeight: 500 }}>
                  {value} →
                </a>
              ) : (
                <span style={{ color: "var(--ink)", fontWeight: 500 }}>{value}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const company = MOCK_COMPANIES.find((c) => c.id === params.id);
  if (!company) return notFound();

  const detail = getCompanyDetail(company);
  const currentCount = detail.current.reduce((s, r) => s + r.count, 0);
  const alumniCount = detail.alumni.reduce((s, r) => s + r.count, 0);

  return (
    <>
      <Header />
      <Breadcrumb company={company} />
      <Hero company={company} detail={detail} />
      <TabsBar company={company} detail={detail} />

      {/* Main layout */}
      <div style={{ background: "var(--bg-tint)", minHeight: "60vh" }}>
        <div
          style={{ maxWidth: 1400, margin: "0 auto" }}
          className="px-5 md:px-12 py-7 grid gap-7 [grid-template-columns:1fr] lg:[grid-template-columns:1fr_320px]"
        >
          <main>
            <FreshnessTimeline detail={detail} />
            <OpinionSection company={company} detail={detail} />
            <AboutSection company={company} detail={detail} />
            <WorkStyleSection company={company} detail={detail} />
            <JobsSection company={company} detail={detail} />
            <MembersSection rows={detail.current} type="current" count={currentCount} />
            <MembersSection rows={detail.alumni} type="alumni" count={alumniCount} />
            <InterviewsSection interviews={detail.interviews} />
            <ArticlesSection articles={detail.articles} />
            <RelatedSection related={detail.related} />
          </main>

          <Sidebar company={company} detail={detail} />
        </div>
      </div>

      <Footer />

      <style>{`
        .job-item-link:hover {
          border-color: var(--royal) !important;
          background: var(--royal-50) !important;
        }
        .related-card-link:hover {
          border-color: var(--royal-100) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(15,23,42,0.06);
        }
      `}</style>
    </>
  );
}
