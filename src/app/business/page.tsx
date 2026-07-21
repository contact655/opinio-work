import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { BusinessHeader } from "@/components/business/BusinessHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 600;

export const metadata: Metadata = {
  title: { absolute: "IT/SaaS採用プラットフォーム | OPINIO for Business" },
  description:
    "スカウトしない採用を。IT/SaaS業界に特化した即戦力人材が、次のキャリアを探しています。メンター介在で本気度の高い応募だけが届く採用プラットフォーム。",
  alternates: { canonical: "/business" },
  openGraph: {
    title: "IT/SaaS採用プラットフォーム | OPINIO for Business",
    description: "業界特化の即戦力人材プラットフォーム。スカウト送信不要で、IT/SaaS経験者から直接コンタクトが届きます。",
    type: "website",
    url: "https://opinio.jp/business",
    images: [{ url: "https://opinio.jp/api/og?title=OPINIO+for+Business&subtitle=%E3%82%B9%E3%82%AB%E3%82%A6%E3%83%88%E3%81%97%E3%81%AA%E3%81%84%E3%80%81%E6%8E%A1%E7%94%A8%E3%82%92%E3%80%82", width: 1200, height: 630 }],
  },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "inline-block", fontSize: 11, fontWeight: 700,
      letterSpacing: "0.1em", textTransform: "uppercase" as const,
      color: "var(--royal)", marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

function CrossItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ color: "var(--ink-mute)", marginTop: 1, flexShrink: 0 }}>✕</span>
      <span style={{ fontSize: 14, color: "var(--ink-mute)", lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details style={{
      background: "#fff", borderRadius: 12,
      border: "1px solid var(--line)", overflow: "hidden",
    }}>
      <summary style={{
        padding: "20px 24px", fontSize: 15, fontWeight: 700, color: "var(--ink)",
        display: "flex", gap: 10, alignItems: "flex-start",
        cursor: "pointer", listStyle: "none", userSelect: "none",
      }}>
        <span style={{ color: "var(--royal)", flexShrink: 0 }}>Q.</span>
        <span style={{ flex: 1 }}>{q}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2, opacity: 0.4 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </summary>
      <div style={{
        padding: "16px 24px 20px 60px", fontSize: 14, color: "var(--ink-soft)",
        lineHeight: 1.8, borderTop: "1px solid var(--line-soft)",
      }}>
        {a}
      </div>
    </details>
  );
}

function MidCtaBanner({ href, label, sub, variant = "royal" }: { href: string; label: string; sub: string; variant?: "royal" | "warm" }) {
  const isWarm = variant === "warm";
  return (
    <div style={{
      padding: "28px 32px",
      background: isWarm
        ? "linear-gradient(135deg, #FFF7E0 0%, #FFFBEB 100%)"
        : "linear-gradient(135deg, var(--royal-50) 0%, #f0f4ff 100%)",
      border: isWarm ? "1.5px solid #FDE68A" : "1.5px solid var(--royal-100)",
      borderRadius: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 13, color: isWarm ? "#92400E" : "var(--ink-soft)" }}>{sub}</div>
      </div>
      <Link href={href} style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "13px 26px",
        background: isWarm ? "#D97706" : "var(--royal)", color: "#fff",
        borderRadius: 9, fontSize: 13, fontWeight: 700,
        textDecoration: "none", whiteSpace: "nowrap",
        boxShadow: isWarm ? "0 3px 12px rgba(217,119,6,0.30)" : "0 3px 10px rgba(0,35,102,0.2)",
        flexShrink: 0,
      }}>
        企業を新規登録
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </Link>
    </div>
  );
}

export default async function ForCompaniesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let bizCtaHref = "/biz/auth?mode=signup";
  if (user) {
    const { data: memberships } = await supabase
      .from("ow_company_admins").select("id").limit(1);
    bizCtaHref = (memberships?.length ?? 0) > 0 ? "/biz/dashboard" : "/biz/companies/add/new";
  }

  const sectionStyle = (bg = "#fff"): React.CSSProperties => ({
    background: bg, padding: "80px 24px",
  });
  const innerStyle: React.CSSProperties = { maxWidth: 900, margin: "0 auto" };

  return (
    <>
      <BusinessHeader />
      <main style={{ paddingTop: 60 }}>

        {/* ─── 01 TALENT ─── */}
        <section id="talent" style={{ background: "var(--bg-tint)", borderTop: "1px solid var(--line)", padding: "80px 24px" }}>
          <div style={innerStyle}>
            <SectionLabel>01 / TALENT</SectionLabel>
            <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px, 3.5vw, 32px)", fontWeight: 500, color: "var(--ink)", marginBottom: 16, lineHeight: 1.3 }}>
              即戦力が、もう登録しています。
            </h2>
            <p style={{ fontSize: 16, color: "var(--ink-soft)", lineHeight: 1.85, marginBottom: 48, maxWidth: 600 }}>
              業界をリードする企業で実績を積んだ IT/SaaSの即戦力人材が、次のキャリアを探しています。<br />
              業界知識ゼロから教育する必要はありません。
            </p>

            {/* Logo strip */}
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 11, fontWeight: 700, color: "var(--ink-mute)",
                letterSpacing: "0.1em", textTransform: "uppercase" as const,
                padding: "4px 12px", background: "#fff",
                border: "1px solid var(--line)", borderRadius: 100,
              }}>登録人材の出身企業（一部）</span>
            </div>
            <p style={{ textAlign: "center", fontSize: 13, color: "var(--ink-soft)", marginBottom: 20, lineHeight: 1.7 }}>
              これらの企業で活躍した人材が、OPINIOに登録しています。
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 52 }}>
              {[
                { name: "Salesforce",    initial: "SF",  iconBg: "#E0EEFF", iconColor: "#0070D2" },
                { name: "リクルート",     initial: "R",   iconBg: "#FEF3C7", iconColor: "#92400E" },
                { name: "SmartHR",       initial: "SHR", iconBg: "#E8F0FA", iconColor: "#0055BB" },
                { name: "freee",         initial: "f",   iconBg: "#E6F5E8", iconColor: "#1A7A1A" },
                { name: "Sansan",        initial: "S",   iconBg: "#E8EFF7", iconColor: "#003566" },
                { name: "LayerX",        initial: "LX",  iconBg: "#EBEBEB", iconColor: "#191919" },
                { name: "Money Forward", initial: "MF",  iconBg: "#E8EDF8", iconColor: "#003CA6" },
                { name: "Ubie",          initial: "U",   iconBg: "#E0F5F2", iconColor: "#007A6A" },
              ].map(({ name, initial, iconBg, iconColor }) => (
                <div key={name} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 18px",
                  background: "#fff", border: "1px solid var(--line)", borderRadius: 12,
                  fontSize: 14, fontWeight: 600, color: "var(--ink)",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: iconBg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: initial.length > 1 ? 9 : 13, fontWeight: 800, color: iconColor,
                    flexShrink: 0, letterSpacing: "-0.02em",
                  }}>{initial}</div>
                  {name}
                </div>
              ))}
            </div>

            {/* 3 profile cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 16 }}>
              {[
                {
                  type: "エンタープライズ営業",
                  age: "30代前半",
                  experience: "経験7年",
                  career: "リクルート → Salesforce",
                  tags: ["大手開拓", "エンタープライズ"],
                  color: "var(--royal)",
                  bg: "var(--royal-50)",
                  border: "var(--royal-100)",
                },
                {
                  type: "カスタマーサクセス",
                  age: "20代後半",
                  experience: "経験5年",
                  career: "SmartHRでオンボーディング主導",
                  tags: ["CS", "オンボーディング"],
                  color: "var(--success)",
                  bg: "var(--success-soft)",
                  border: "#A7F3D0",
                },
                {
                  type: "インサイドセールス",
                  age: "30代前半",
                  experience: "経験6年",
                  career: "freeeでIS立ち上げ",
                  tags: ["IS立ち上げ", "SaaS営業"],
                  color: "#7C3AED",
                  bg: "#F3E8FF",
                  border: "#DDD6FE",
                },
              ].map(({ type, age, experience, career, tags, color, bg, border }) => (
                <div key={type} style={{
                  padding: "22px 20px", background: "#fff",
                  border: "1px solid var(--line)", borderRadius: 14,
                  boxShadow: "0 2px 10px rgba(0,35,102,0.05)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                      background: bg, color: color, border: `1px solid ${border}`,
                    }}>{type}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                      background: "var(--success-soft)", color: "var(--success)",
                      border: "1px solid #A7F3D0",
                    }}>✓ 面談済</span>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 4 }}>{age} · {experience}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>{career}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                    {tags.map((t) => (
                      <span key={t} style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 100,
                        background: bg, color: color, fontWeight: 600,
                        border: `1px solid ${border}`,
                      }}>{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "center", lineHeight: 1.6 }}>
              ※ 登録人材の経歴イメージ（代表例）です。実在の特定個人を示すものではありません。
            </p>
          </div>
        </section>

        {/* ─── 02 QUALITY ─── */}
        <section id="quality" style={sectionStyle("#fff")}>
          <div style={innerStyle}>
            <SectionLabel>02 / QUALITY</SectionLabel>
            <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px, 3.5vw, 32px)", fontWeight: 500, color: "var(--ink)", marginBottom: 16, lineHeight: 1.3 }}>
              なぜ、質の高い人材が集まるのか。
            </h2>
            <p style={{ fontSize: 16, color: "var(--ink-soft)", lineHeight: 1.85, marginBottom: 40, maxWidth: 580 }}>
              スカウトを乱発する候補者DBではない。<br />
              3つの仕組みで、本気度の高い層だけが届きます。
            </p>

            {/* 3 mechanisms */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 52 }}>
              {[
                {
                  num: "01",
                  title: "運営がヒアリングして構造化",
                  body: "自己申告任せにせず、OPINIO編集部が直接ヒアリングしてプロフィールを整えます。候補者の粒度が揃っているため、スクリーニングの手間が大幅に減ります。",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  ),
                },
                {
                  num: "02",
                  title: "メンター面談を経た本気度",
                  body: "応募前にIT業界経験を持つメンターと30分面談済みの層だけがコンタクトしてきます。「とりあえず応募」は来ません。",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  ),
                },
                {
                  num: "03",
                  title: "IT/SaaS特化で自然にフィルタ",
                  body: "プラットフォームがIT/SaaS業界に特化しているため、業界外からの応募が自然に減り、採用したい層が集まります。",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                    </svg>
                  ),
                },
              ].map(({ num, title, body, icon }) => (
                <div key={num} style={{
                  padding: "24px 20px", background: "var(--bg-tint)",
                  borderRadius: 14, border: "1px solid var(--line)",
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: "var(--royal-50)", border: "1.5px solid var(--royal-100)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 16,
                  }}>{icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--royal)", letterSpacing: "0.08em", fontFamily: "Inter,sans-serif", marginBottom: 8 }}>
                    {num}
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 10, lineHeight: 1.4 }}>{title}</h3>
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.75 }}>{body}</p>
                </div>
              ))}
            </div>

            {/* Comparison table */}
            <div style={{ borderRadius: 16, border: "1px solid var(--line)", overflow: "hidden", marginBottom: 48 }}>
              <div style={{ padding: "14px 20px", background: "var(--royal-50)", borderBottom: "1px solid var(--royal-100)" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)", letterSpacing: "0.06em" }}>
                  一般的な候補者DB vs OPINIO
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-tint)" }}>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "var(--ink-soft)", borderBottom: "1px solid var(--line)", fontSize: 11, width: "30%" }}>比較項目</th>
                      <th style={{ padding: "10px 16px", textAlign: "center", fontWeight: 700, color: "var(--ink-mute)", borderBottom: "1px solid var(--line)", fontSize: 11 }}>一般的な候補者DB</th>
                      <th style={{ padding: "10px 16px", textAlign: "center", fontWeight: 700, color: "var(--royal)", borderBottom: "1px solid var(--royal-100)", fontSize: 11, background: "var(--royal-50)" }}>OPINIO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { item: "コンタクト方法", general: "スカウトを乱発", opinio: "本人から直接コンタクト" },
                      { item: "プロフィールの粒度", general: "自己申告でバラバラ", opinio: "編集部ヒアリングで構造化済み" },
                      { item: "応募の本気度", general: "とりあえず登録が多い", opinio: "メンター面談を経た本気層" },
                      { item: "業界適合性", general: "業界外応募が混入", opinio: "IT/SaaS特化で自然フィルタ" },
                    ].map(({ item, general, opinio }) => (
                      <tr key={item} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "12px 16px", color: "var(--ink)", fontWeight: 600, fontSize: 12 }}>{item}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--ink-mute)" }}>{general}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--royal)", fontWeight: 700, background: "rgba(0,35,102,0.03)" }}>
                          <span style={{ color: "var(--success)", marginRight: 4 }}>✓</span>{opinio}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <MidCtaBanner
              href={bizCtaHref}
              label="人材プールを今すぐ見てみる"
              sub="登録するとすぐに候補者プロフィールを閲覧できます"
            />
          </div>
        </section>

        {/* ─── 03 EFFICIENCY ─── */}
        <section id="efficiency" style={sectionStyle("var(--bg-tint)")}>
          <div style={innerStyle}>
            <SectionLabel>03 / EFFICIENCY</SectionLabel>
            <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px, 3.5vw, 32px)", fontWeight: 500, color: "var(--ink)", marginBottom: 16, lineHeight: 1.3 }}>
              採用担当の工数を、減らす設計。
            </h2>
            <p style={{ fontSize: 16, color: "var(--ink-soft)", lineHeight: 1.85, marginBottom: 48, maxWidth: 560 }}>
              採用の各フェーズで「あなたの手間がこう減る」を示します。
            </p>

            {/* 4-step Before/After */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                {
                  step: "母集団形成",
                  before: "スカウトを大量送信し、返信を待ち続ける",
                  after: "本人から直接コンタクト。スカウト送信不要",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  ),
                },
                {
                  step: "スクリーニング",
                  before: "大量の応募書類を確認し、見極めに時間がかかる",
                  after: "メンター面談済みで本気度が事前に証明されている",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  ),
                },
                {
                  step: "候補者の見極め",
                  before: "面談で一から経験・志向を聞かないと判断できない",
                  after: "構造化プロフィール＋編集部推薦コメントで判断材料が揃っている",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  ),
                },
                {
                  step: "ミスマッチ対応",
                  before: "業界外・経験薄の応募が混入し、対応コストがかかる",
                  after: "IT/SaaS特化で業界外応募が自然に減り、対応件数が減る",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                    </svg>
                  ),
                },
              ].map(({ step, before, after, icon }, i) => (
                <div key={step} style={{
                  background: "#fff",
                  border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 9,
                      background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--royal)", flexShrink: 0,
                    }}>{icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--royal)", letterSpacing: "0.06em" }}>
                      {String(i + 1).padStart(2, "0")} / {step}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
                    <div style={{ background: "var(--error-soft)", border: "1px solid #FCA5A5", borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--error)", marginBottom: 4 }}>Before</div>
                      <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>{before}</div>
                    </div>
                    <div style={{ color: "var(--royal)", fontWeight: 700, fontSize: 18, padding: "0 4px", textAlign: "center" }}>→</div>
                    <div style={{ background: "var(--success-soft)", border: "1px solid #A7F3D0", borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--success)", marginBottom: 4 }}>After</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.5 }}>{after}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 04 EASY START ─── */}
        <section id="easy-start" style={sectionStyle("#fff")}>
          <div style={innerStyle}>
            <SectionLabel>04 / EASY START</SectionLabel>
            <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px, 3.5vw, 32px)", fontWeight: 500, color: "var(--ink)", marginBottom: 16, lineHeight: 1.3 }}>
              まず、試してみてください。
            </h2>
            <p style={{ fontSize: 16, color: "var(--ink-soft)", lineHeight: 1.85, marginBottom: 48, maxWidth: 540 }}>
              導入ハードルはほとんどありません。<br />
              既存の採用活動と並行して始められます。
            </p>

            {/* 4 points */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 52 }}>
              {[
                {
                  num: "1",
                  title: "登録は1分・審査なし",
                  body: "メールアドレスだけで完了。すぐに候補者プールを閲覧できます。",
                  color: "var(--royal)",
                  bg: "var(--royal-50)",
                  border: "var(--royal-100)",
                },
                {
                  num: "2",
                  title: "既存媒体と並行できる",
                  body: "乗り換え不要。リクナビ・ビズリーチなど既存媒体と並行してご利用いただけます。",
                  color: "var(--success)",
                  bg: "var(--success-soft)",
                  border: "#A7F3D0",
                },
                {
                  num: "3",
                  title: "営業電話・自動課金なし",
                  body: "プッシュ型の営業は一切ありません。お問い合わせはメールのみです。",
                  color: "#7C3AED",
                  bg: "#F3E8FF",
                  border: "#DDD6FE",
                },
                {
                  num: "4",
                  title: "合わなければ、やめられる",
                  body: "縛りは一切ありません。いつでも退会・停止できます。",
                  color: "#D97706",
                  bg: "#FEF3C7",
                  border: "#FDE68A",
                },
              ].map(({ num, title, body, color, bg, border }) => (
                <div key={num} style={{
                  padding: "22px 18px", background: bg,
                  border: `1.5px solid ${border}`, borderRadius: 14,
                }}>
                  <div style={{
                    fontFamily: "Inter, sans-serif", fontSize: 32, fontWeight: 800,
                    color: color, opacity: 0.2, lineHeight: 1, marginBottom: 12,
                  }}>{num}</div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 8, lineHeight: 1.4 }}>{title}</h3>
                  <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>{body}</p>
                </div>
              ))}
            </div>

            {/* Persona cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 32 }}>
              {[
                {
                  label: "スタートアップ",
                  stage: "Series A〜B",
                  color: "var(--royal)",
                  bg: "var(--royal-50)",
                  border: "var(--royal-100)",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                  ),
                  points: ["即戦力でスモールチームを強化したい", "採用リスクを最小化して始めたい", "SaaS営業・CS人材が欲しい"],
                },
                {
                  label: "ミドル〜大手",
                  stage: "上場 / 300名以上",
                  color: "#7C3AED",
                  bg: "#F3E8FF",
                  border: "#DDD6FE",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                    </svg>
                  ),
                  points: ["新規事業部門に特化した採用をしたい", "既存媒体と並行して質を上げたい", "採用ミスマッチを減らしたい"],
                },
                {
                  label: "外資・グローバル",
                  stage: "IT/SaaS外資",
                  color: "var(--success)",
                  bg: "var(--success-soft)",
                  border: "#A7F3D0",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                  ),
                  points: ["外資IT・SaaSで働きたい人材にリーチしたい", "日本市場に詳しい即戦力が欲しい", "業界特化のメディア露出で認知を高めたい"],
                },
              ].map(({ label, stage, color, bg, border, icon, points }) => (
                <div key={label} style={{
                  padding: "22px 20px",
                  background: bg, border: `1.5px solid ${border}`,
                  borderRadius: 14,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "#fff", border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
                      {icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{label}</div>
                      <div style={{ fontSize: 11, color, fontWeight: 600 }}>{stage}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {points.map((p) => (
                      <div key={p} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ color, fontWeight: 700, fontSize: 11, flexShrink: 0, marginTop: 2 }}>✓</span>
                        <span style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 向いていない場合 */}
            <div style={{
              padding: "22px 28px", background: "var(--bg-tint)",
              border: "1px solid var(--line)", borderRadius: 14, marginBottom: 40,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 14 }}>
                （参考）不向きな場合
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 32px" }}>
                {[
                  "採用ボリュームを最大化したい",
                  "短期決戦で多数の候補者にスカウトを送りたい",
                  "IT/SaaS以外の業界での採用が中心",
                ].map((item) => <CrossItem key={item}>{item}</CrossItem>)}
              </div>
              <p style={{ marginTop: 14, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
                ミスマッチを防ぐため、当社の強みを正直にお伝えしています。
              </p>
            </div>

            <MidCtaBanner
              href={bizCtaHref}
              variant="warm"
              label="貴社に合う人材が登録されているか確認する"
              sub="登録後すぐに候補者プールにアクセスできます"
            />
          </div>
        </section>

        {/* ─── 導入の流れ ─── */}
        <section id="flow" style={sectionStyle("var(--bg-tint)")}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <SectionLabel>導入の流れ</SectionLabel>
              <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px, 3.5vw, 32px)", fontWeight: 500, color: "var(--ink)" }}>
                4ステップで採用開始
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_28px_1fr_28px_1fr_28px_1fr] items-stretch">
              {[
                {
                  step: "STEP 1",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  ),
                  title: "企業を新規登録",
                  body: "メールアドレスだけで1分。審査なし、すぐに始められます。",
                  mockup: (
                    <div style={{ background: "var(--royal-50)", borderRadius: 7, padding: "8px 10px", marginTop: 10, border: "1px solid var(--royal-100)" }}>
                      <div style={{ fontSize: 9, color: "var(--royal)", fontWeight: 700, marginBottom: 4 }}>企業情報を入力</div>
                      <div style={{ height: 6, background: "var(--royal-100)", borderRadius: 3, width: "70%", marginBottom: 4 }} />
                      <div style={{ height: 6, background: "var(--royal-100)", borderRadius: 3, width: "50%" }} />
                    </div>
                  ),
                },
                {
                  step: "STEP 2",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  ),
                  title: "求人を作成・公開",
                  body: "何件でも、何ヶ月でも掲載可能。「公開」ボタンで即反映。",
                  mockup: (
                    <div style={{ background: "var(--royal-50)", borderRadius: 7, padding: "8px 10px", marginTop: 10, border: "1px solid var(--royal-100)" }}>
                      <div style={{ fontSize: 9, color: "var(--royal)", fontWeight: 700, marginBottom: 4 }}>求人プレビュー</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ height: 6, background: "var(--royal-100)", borderRadius: 3, width: "60%" }} />
                        <div style={{ padding: "2px 7px", background: "var(--royal)", borderRadius: 4, fontSize: 8, color: "#fff", fontWeight: 700 }}>公開</div>
                      </div>
                    </div>
                  ),
                },
                {
                  step: "STEP 3",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  ),
                  title: "候補者から応募が届く",
                  body: "応募前メンター面談を経た、本気度の高い候補者から応募が届きます。",
                  mockup: (
                    <div style={{ background: "var(--success-soft)", borderRadius: 7, padding: "8px 10px", marginTop: 10, border: "1px solid #A7F3D0" }}>
                      <div style={{ fontSize: 9, color: "var(--success)", fontWeight: 700, marginBottom: 3 }}>● 新着応募</div>
                      <div style={{ fontSize: 9, color: "var(--ink-soft)" }}>山田さん・面談済み✓</div>
                    </div>
                  ),
                },
                {
                  step: "STEP 4",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  ),
                  title: "入社決定時のみ成果報酬",
                  body: "採用が決まるまで請求は発生しません。成果報酬制のシンプルな体系です。",
                  mockup: (
                    <div style={{ background: "#F0FDF4", borderRadius: 7, padding: "8px 10px", marginTop: 10, border: "1px solid #BBF7D0" }}>
                      <div style={{ fontSize: 9, color: "var(--success)", fontWeight: 700, marginBottom: 3 }}>採用確定！</div>
                      <div style={{ fontSize: 9, color: "var(--ink-soft)" }}>成果報酬制（入社決定時のみ）</div>
                    </div>
                  ),
                },
              ].map(({ step, icon, title, body, mockup }, i) => (
                <React.Fragment key={step}>
                  <div style={{
                    padding: "22px 18px", background: "#fff",
                    borderRadius: 12, border: "1px solid var(--line)",
                    height: "100%", display: "flex", flexDirection: "column",
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", fontFamily: "'Inter', sans-serif", marginBottom: 12 }}>
                      {step}
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--royal-50)", border: "1px solid var(--royal-100)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                      {icon}
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6, lineHeight: 1.4 }}>{title}</h3>
                    <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, flex: 1 }}>{body}</p>
                    {mockup}
                  </div>
                  {i < 3 && (
                    <div className="hidden md:flex items-center justify-center" style={{ color: "var(--ink-mute)", fontSize: 18 }}>→</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" style={sectionStyle("#fff")}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 56, height: 56, borderRadius: "50%",
                background: "var(--royal)", marginBottom: 18,
                boxShadow: "0 4px 16px rgba(0,35,102,0.20)",
              }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", lineHeight: 1 }}>?</span>
              </div>
              <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px, 3.5vw, 32px)", fontWeight: 500, color: "var(--ink)", marginBottom: 10 }}>
                よくある質問
              </h2>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7 }}>採用担当者からよくいただく質問に、正直にお答えします。</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <FaqItem
                q="本当に掲載は無料ですか？隠れたコストはありますか？"
                a="はい、月額費用・広告費・初期費用は一切いただきません。求人公開・候補者閲覧・面談まで全て費用なしでご利用いただけます。費用が発生するのは入社決定時の成果報酬のみです。"
              />
              <FaqItem
                q="成果報酬の発生条件を教えてください。"
                a="候補者の入社が確定した時点でご請求します。成果報酬制のため、入社が決まるまで一切請求が発生しません。金額の詳細は個別にご案内しますので、お問い合わせください。"
              />
              <FaqItem
                q="登録からどのくらいで採用できますか？"
                a="求人公開後、登録済みの人材データベースからマッチした候補者に通知が届きます。最初のコンタクトは早ければ登録翌日から発生するケースもあります。採用完了までの期間は職種・条件によって異なりますが、スカウトを送らないため候補者の本気度が高く、選考がスムーズに進む傾向があります。"
              />
              <FaqItem
                q="営業電話はかかってきますか？"
                a="ございません。ご質問やご相談はサイト内のフォーム、またはメール（contact@opinio.co.jp）からのみ承ります。"
              />
              <FaqItem
                q="どのような業界・職種に対応していますか？"
                a="現在は IT/SaaS 業界に特化しています。登録ユーザーはSaaS営業・カスタマーサクセス・プロダクトマネージャー・エンジニア・インサイドセールス・マーケターなどIT業界経験者が中心です。IT/SaaS以外の業界での採用にはあまり向いていません。"
              />
              <FaqItem
                q="登録に審査はありますか？すぐに始められますか？"
                a="審査はございません。セルフサーブ型で、登録後すぐに求人を公開できます。入力フォームに企業情報・求人内容を登録し「公開する」ボタンを押すだけです（1〜5分程度）。"
              />
              <FaqItem
                q="OPINIO編集部の取材記事は必ず書いてもらえますか？"
                a="掲載企業すべてが対象ではなく、OPINIOが特にフィットすると判断した企業様を編集部からご提案しています。記事取材をご希望の場合は、ダッシュボードからお問い合わせください。"
              />
            </div>
            <div style={{ textAlign: "center", marginTop: 36 }}>
              <p style={{ fontSize: 14, color: "var(--ink-mute)" }}>
                その他のご質問は{" "}
                <a href="mailto:contact@opinio.co.jp" style={{ color: "var(--royal)", textDecoration: "underline" }}>
                  contact@opinio.co.jp
                </a>{" "}
                までお気軽にどうぞ。
              </p>
            </div>
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section style={{
          padding: "96px 24px",
          background: "linear-gradient(135deg, #001F5B 0%, #002E8A 50%, #003BB5 100%)",
          textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 40%)" }} />
          <div style={{ maxWidth: 600, margin: "0 auto", position: "relative" }}>
            <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 500, color: "#fff", lineHeight: 1.3, marginBottom: 16 }}>
              いい人が、もう登録しています。
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", lineHeight: 1.8, marginBottom: 44 }}>
              候補者プールをのぞいてみることから始めてください。
            </p>
            <Link href={bizCtaHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 44px", background: "#fff", color: "var(--royal)", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.24), 0 2px 8px rgba(0,0,0,0.16)" }}>
              企業を新規登録
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
            </Link>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
              {["入社まで費用なし（成果報酬制）", "既存媒体と並行可能"].map((txt) => (
                <div key={txt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  {txt}
                </div>
              ))}
              <a href="mailto:contact@opinio.co.jp" style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}>まず相談する</a>
            </div>
          </div>
        </section>

        {/* Mobile sticky */}
        <div className="md:hidden" style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid var(--line)",
          padding: "10px 14px", paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
          zIndex: 50, display: "flex", gap: 8,
        }}>
          <a href="mailto:contact@opinio.co.jp" style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "13px 12px", border: "1.5px solid var(--royal)",
            background: "#fff", color: "var(--royal)",
            borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            まず相談する
          </a>
          <Link href={bizCtaHref} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            padding: "13px 12px", background: "var(--royal)", color: "#fff",
            borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none",
            boxShadow: "0 2px 8px rgba(0,35,102,0.25)",
          }}>
            企業を新規登録
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </Link>
        </div>
        <div className="md:hidden" style={{ height: 72 }} />

      </main>
      <JobseekerFooter />
    </>
  );
}
