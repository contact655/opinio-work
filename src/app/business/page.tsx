import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { BusinessHeader } from "@/components/business/BusinessHeader";
import { BusinessHero } from "@/components/business/BusinessHero";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "採用コスト、ゼロから。｜Opinio Work",
  description:
    "月額費用なし、広告費なし、入社決定時のみ成果報酬。IT/SaaS業界の即戦力人材を、無料で採用開始できる「Opinio Work」。メンター介在で採用ミスマッチを構造的に防ぐ。",
  openGraph: {
    title: "採用コスト、ゼロから。｜Opinio Work",
    description: "掲載・スカウト・面談まで全て無料。成果報酬は入社決定時のみ。IT/SaaS業界特化の採用プラットフォーム。",
    type: "website",
  },
};


// ── SectionLabel ──────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "inline-block",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      color: "var(--royal)",
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

// ── CheckItem ─────────────────────────────────────────────────────────────────
function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ color: "var(--royal)", fontWeight: 700, marginTop: 1, flexShrink: 0 }}>✓</span>
      <span style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

// ── CrossItem ─────────────────────────────────────────────────────────────────
function CrossItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ color: "var(--ink-mute)", marginTop: 1, flexShrink: 0 }}>✕</span>
      <span style={{ fontSize: 14, color: "var(--ink-mute)", lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

// ── FaqItem ───────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div style={{
      padding: "24px 28px",
      background: "#fff",
      borderRadius: 12,
      border: "1px solid var(--line)",
    }}>
      <div style={{
        fontSize: 15,
        fontWeight: 700,
        color: "var(--ink)",
        marginBottom: 10,
        display: "flex",
        gap: 10,
      }}>
        <span style={{ color: "var(--royal)", flexShrink: 0 }}>Q.</span>
        {q}
      </div>
      <div style={{
        fontSize: 14,
        color: "var(--ink-soft)",
        lineHeight: 1.8,
        paddingLeft: 24,
      }}>
        {a}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function ForCompaniesPage() {
  // Phase 5: ログイン状態により CTA の遷移先を変える
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let bizCtaHref = "/biz/auth";
  if (user) {
    const { data: memberships } = await supabase
      .from("ow_company_admins")
      .select("id")
      .limit(1);
    bizCtaHref = (memberships?.length ?? 0) > 0 ? "/biz/dashboard" : "/biz/companies/add/new";
  }
  const sectionStyle = (bg = "#fff"): React.CSSProperties => ({
    background: bg,
    padding: "80px 24px",
  });

  const innerStyle: React.CSSProperties = {
    maxWidth: 900,
    margin: "0 auto",
  };

  return (
    <>
      <BusinessHeader />
      <main style={{ paddingTop: 60 }}>

        {/* ─── Section 1: Hero (BusinessHero client component) ─────────────── */}
        <BusinessHero />
        {/* ─── KPI strip + Logo strip ─────────────────────────────────────────── */}
        <section style={{
          background: "#fff",
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
          padding: "48px 24px",
        }}>
          <div style={innerStyle}>
            {/* KPI 数字 */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 0,
              marginBottom: 40,
              borderRadius: 16,
              border: "1px solid var(--line)",
              overflow: "hidden",
              background: "var(--bg-tint)",
            }}>
              {[
                { value: "¥0", unit: "", label: "掲載・スカウト費用", sub: "入社決定まで完全無料" },
                { value: "13", unit: "社", label: "掲載企業数", sub: "IT/SaaS特化" },
                { value: "30", unit: "分", label: "無料カジュアル面談", sub: "採用前に候補者と対話" },
              ].map(({ value, unit, label, sub }, i) => (
                <div key={label} style={{
                  padding: "24px 20px",
                  textAlign: "center",
                  borderRight: i < 2 ? "1px solid var(--line)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2, marginBottom: 6 }}>
                    <span style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "clamp(28px, 4vw, 40px)",
                      fontWeight: 700,
                      color: "var(--royal)",
                      lineHeight: 1,
                    }}>{value}</span>
                    {unit && <span style={{ fontSize: 16, fontWeight: 700, color: "var(--royal)" }}>{unit}</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Company chips */}
            <p style={{
              textAlign: "center",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink-mute)",
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              marginBottom: 16,
            }}>
              掲載中の企業様（一部）
            </p>
            <div style={{
              display: "flex",
              flexWrap: "wrap" as const,
              gap: 10,
              justifyContent: "center",
              marginBottom: 40,
            }}>
              {["Sansan", "freee", "Money Forward", "SmartHR", "LayerX", "Ubie", "PKSHA", "Datadog"].map((name) => (
                <div key={name} style={{
                  padding: "7px 18px",
                  background: "var(--royal-50)",
                  border: "1px solid var(--royal-100)",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--royal)",
                }}>
                  {name}
                </div>
              ))}
            </div>

            {/* Voice cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}>
              {[
                {
                  quote: "スカウト費用ゼロで、IT業界の即戦力層と直接対話できるのが魅力です。面談前にメンターが関わるので、応募してくる方の本気度が違います。",
                  name: "採用担当 A社",
                  role: "SaaS系スタートアップ · Series B",
                },
                {
                  quote: "求人ページに掲載するだけで、Opinio編集部が取材記事を書いてくれる。記事経由で「御社の文化が好き」と言って来る候補者の質が高い。",
                  name: "人事部長 B社",
                  role: "HR Tech · 従業員200名",
                },
                {
                  quote: "入社まで完全無料なので、採用できなければリスクゼロ。小さいチームでも気軽に始められました。",
                  name: "COO C社",
                  role: "FinTech · シードステージ",
                },
              ].map(({ quote, name, role }) => (
                <div key={name} style={{
                  padding: "20px 20px",
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}>
                  {/* Quote mark */}
                  <svg width="20" height="16" viewBox="0 0 24 20" fill="var(--royal-100)" style={{ flexShrink: 0 }}>
                    <path d="M0 20V12.727C0 9.697 .788 7.121 2.364 5 3.94 2.879 6.061 1.455 8.727.727L9.818 3.09C8.424 3.636 7.288 4.485 6.41 5.636 5.53 6.788 5.09 8.03 5.09 9.364H9.09V20H0zm13.09 0V12.727c0-3.03.789-5.606 2.364-7.727C17.03 2.879 19.152 1.455 21.818.727L22.91 3.09c-1.394.546-2.53 1.395-3.41 2.546-.879 1.152-1.318 2.394-1.318 3.728H22V20h-8.91z"/>
                  </svg>
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, flex: 1, margin: 0 }}>{quote}</p>
                  <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>{role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Section 2–4: Point 1 / 2 / 3 — InfraBlock 左右レイアウト ────────── */}
        <section id="pricing" style={{ background: "#fff" }}>
          <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto", padding: "0 48px" }}>

            {/* ── Point 1: 完全無料で求人掲載 ── */}
            <div className="grid grid-cols-1 gap-12 items-center md:grid-cols-2 md:gap-16"
              style={{ paddingTop: 80, paddingBottom: 80, borderTop: "1px solid var(--line)" }}>
              {/* Left: copy */}
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--royal)", textTransform: "uppercase" as const, fontFamily: "'Inter', sans-serif" }}>
                  01 / FREE
                </span>
                <h3 style={{
                  fontFamily: "var(--font-noto-serif)",
                  fontSize: "clamp(20px, 3vw, 28px)",
                  fontWeight: 500,
                  color: "var(--ink)",
                  marginTop: 12,
                  marginBottom: 14,
                  lineHeight: 1.4,
                }}>
                  完全無料で求人掲載
                </h3>
                <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 28 }}>
                  月額費用なし、広告費なし。<br />
                  お金が発生するのは<strong style={{ color: "var(--ink)" }}>「入社決定」の一点のみ</strong>。
                  掲載件数・掲載期間に制限はありません。
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <CheckItem>求人掲載・スカウト・面談まで完全無料</CheckItem>
                  <CheckItem>掲載件数・期間 無制限</CheckItem>
                  <CheckItem>採用決定まで一切請求なし</CheckItem>
                  <CheckItem>クレジットカード登録不要</CheckItem>
                </div>
              </div>
              {/* Right: job creation UI mockup */}
              <div style={{ direction: "ltr" }}>
                <div style={{
                  background: "var(--bg-tint)",
                  border: "1px solid var(--line)",
                  borderRadius: 16,
                  padding: "24px",
                  boxShadow: "0 4px 24px rgba(0,35,102,0.06)",
                }}>
                  {/* Window chrome */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#60a5fa" }} />
                    <span style={{ marginLeft: 8, fontSize: 11, color: "var(--ink-mute)", fontFamily: "'Inter', sans-serif" }}>求人管理 — Opinio Work</span>
                  </div>
                  {/* Mock job form */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid var(--line)" }}>
                      <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 4, fontFamily: "'Inter', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>職種</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>カスタマーサクセス（エンタープライズ）</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 4, fontFamily: "'Inter', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>雇用形態</div>
                        <div style={{ fontSize: 13, color: "var(--ink)" }}>正社員</div>
                      </div>
                      <div style={{ background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 4, fontFamily: "'Inter', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>勤務地</div>
                        <div style={{ fontSize: 13, color: "var(--ink)" }}>東京（リモート可）</div>
                      </div>
                    </div>
                    <div style={{ background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid var(--line)" }}>
                      <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 4, fontFamily: "'Inter', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>想定年収</div>
                      <div style={{ fontSize: 13, color: "var(--ink)" }}>600万円 〜 900万円</div>
                    </div>
                    {/* Publish button */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                      <div style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, color: "var(--ink-mute)", background: "#fff" }}>下書き保存</div>
                      <div style={{ padding: "8px 20px", borderRadius: 8, background: "var(--royal)", fontSize: 13, fontWeight: 600, color: "#fff" }}>公開する</div>
                    </div>
                    {/* Free badge */}
                    <div style={{ textAlign: "center", padding: "8px", background: "var(--royal-50)", borderRadius: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)" }}>✓ 掲載無料 · 件数・期間制限なし</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Point 2: 届く応募の、質が違う。── */}
            <div style={{ paddingTop: 80, paddingBottom: 80, borderTop: "1px solid var(--line)" }}>
              {/* Header copy */}
              <div style={{ marginBottom: 48 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--royal)", textTransform: "uppercase" as const, fontFamily: "'Inter', sans-serif" }}>
                  02 / QUALITY
                </span>
                <h3 style={{
                  fontFamily: "var(--font-noto-serif)",
                  fontSize: "clamp(20px, 3vw, 28px)",
                  fontWeight: 500,
                  color: "var(--ink)",
                  marginTop: 12,
                  marginBottom: 14,
                  lineHeight: 1.4,
                }}>
                  届く応募の、質が違う。
                </h3>
                <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.9, maxWidth: 560 }}>
                  スカウトを送らず、本気度の高い応募だけを受け取る。<br />
                  Opinio はメンター制度・編集部の取材・自然言語検索で、<br />
                  採用ミスマッチを構造的に防ぎます。
                </p>
              </div>
              {/* 4-card grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: "🎯",
                    title: "スカウト不要",
                    body: "本人から直接コンタクトが来ます。採用担当者の業務時間を奪いません。",
                  },
                  {
                    icon: "💬",
                    title: "面談を経た応募",
                    body: "応募前にIT業界経験メンターと30分面談済み。本気度の高い応募だけが届きます。",
                  },
                  {
                    icon: "📰",
                    title: "編集部が取材した記事",
                    body: "Opinio編集部が第三者視点で御社を取材。深い記事が対話のきっかけになります。",
                  },
                  {
                    icon: "🔍",
                    title: "自然言語で候補者検索",
                    body: "「大企業開拓の営業経験者」など、経験ベースで自由に検索可能です。",
                  },
                ].map(({ icon, title, body }) => (
                  <div key={title} style={{
                    padding: "24px 20px",
                    background: "var(--bg-tint)",
                    borderRadius: 12,
                    border: "1px solid var(--line)",
                    display: "flex",
                    flexDirection: "column",
                  }}>
                    <div style={{
                      width: 40, height: 40,
                      borderRadius: 10,
                      background: "var(--royal-50)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20,
                      marginBottom: 14,
                      flexShrink: 0,
                    }}>
                      {icon}
                    </div>
                    <h4 style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--ink)",
                      marginBottom: 8,
                      lineHeight: 1.4,
                    }}>
                      {title}
                    </h4>
                    <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Point 3: IT業界職経ありユーザーが中心 ── */}
            <div className="grid grid-cols-1 gap-12 items-center md:grid-cols-2 md:gap-16"
              style={{ paddingTop: 80, paddingBottom: 80, borderTop: "1px solid var(--line)" }}>
              {/* Left: copy */}
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--royal)", textTransform: "uppercase" as const, fontFamily: "'Inter', sans-serif" }}>
                  03 / TALENT
                </span>
                <h3 style={{
                  fontFamily: "var(--font-noto-serif)",
                  fontSize: "clamp(20px, 3vw, 28px)",
                  fontWeight: 500,
                  color: "var(--ink)",
                  marginTop: 12,
                  marginBottom: 14,
                  lineHeight: 1.4,
                }}>
                  IT業界職経ありユーザーが中心
                </h3>
                <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 28 }}>
                  Opinio に登録しているユーザーの大多数が、
                  IT/SaaS 業界で実務経験を持つ即戦力人材。
                  業界知識ゼロから教育する必要がありません。
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <CheckItem>SaaS営業・CS・PMなど即戦力層が中心</CheckItem>
                  <CheckItem>入社後すぐに戦力として活躍できる</CheckItem>
                  <CheckItem>IT業界外の応募は自然にフィルタされる</CheckItem>
                </div>
              </div>
              {/* Right: user attribute tag cloud */}
              <div style={{ direction: "ltr" }}>
                <div style={{
                  background: "var(--bg-tint)",
                  border: "1px solid var(--line)",
                  borderRadius: 16,
                  padding: "28px 24px",
                  boxShadow: "0 4px 24px rgba(0,35,102,0.06)",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--royal)", textTransform: "uppercase" as const, fontFamily: "'Inter', sans-serif", marginBottom: 16 }}>
                    登録ユーザーの属性
                  </div>
                  {/* Tag cloud */}
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                    {[
                      { label: "SaaS営業", weight: 700 },
                      { label: "カスタマーサクセス", weight: 700 },
                      { label: "プロダクトマネージャー", weight: 600 },
                      { label: "エンジニア", weight: 600 },
                      { label: "マーケター", weight: 500 },
                      { label: "インサイドセールス", weight: 500 },
                      { label: "コンサルタント", weight: 400 },
                      { label: "データアナリスト", weight: 400 },
                      { label: "デザイナー", weight: 400 },
                    ].map(({ label, weight }) => (
                      <span key={label} style={{
                        padding: "5px 12px",
                        borderRadius: 100,
                        background: weight >= 700 ? "var(--royal)" : weight >= 600 ? "var(--royal-100)" : weight >= 500 ? "var(--royal-50)" : "#fff",
                        color: weight >= 700 ? "#fff" : weight >= 600 ? "var(--royal)" : "var(--ink-soft)",
                        border: weight < 600 ? "1px solid var(--line)" : "none",
                        fontSize: weight >= 700 ? 13 : weight >= 600 ? 12 : 11,
                        fontWeight: 600,
                      }}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ─── Section 3: 導入の流れ ────────────────────────────────────────────── */}
        <section id="flow" style={sectionStyle("#fff")}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <SectionLabel>導入の流れ</SectionLabel>
              <h2 style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 500,
                color: "var(--ink)",
              }}>
                4ステップで採用開始
              </h2>
            </div>

            {/* 4 STEP cards — 4-column desktop (with arrow spacers) / 1-column mobile */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_28px_1fr_28px_1fr_28px_1fr] items-stretch">
              {[
                {
                  step: "STEP 1",
                  icon: "🏢",
                  title: "企業を新規登録",
                  body: "無料。メールアドレスだけで1分。クレジットカード登録不要。",
                },
                {
                  step: "STEP 2",
                  icon: "📋",
                  title: "求人を作成・公開",
                  body: "何件でも、何ヶ月でも無料。下書きから「公開」ボタンで即反映。",
                },
                {
                  step: "STEP 3",
                  icon: "👤",
                  title: "候補者から応募が届く",
                  body: "応募前メンター面談を経た、本気度の高い候補者から応募が届きます。",
                },
                {
                  step: "STEP 4",
                  icon: "✅",
                  title: "入社決定時のみ成果報酬",
                  body: "採用が決まるまで一切請求なし。シンプルな料金体系でわかりやすい。",
                },
              ].map(({ step, icon, title, body }, i) => (
                <React.Fragment key={step}>
                  <div style={{
                    padding: "24px 20px",
                    background: "var(--bg-tint)",
                    borderRadius: 12,
                    border: "1px solid var(--line)",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}>
                    {/* Step label */}
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: "var(--royal)",
                      fontFamily: "'Inter', sans-serif",
                      marginBottom: 12,
                    }}>
                      {step}
                    </div>
                    {/* Icon */}
                    <div style={{
                      width: 40, height: 40,
                      borderRadius: 10,
                      background: "var(--royal-50)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20,
                      marginBottom: 14,
                    }}>
                      {icon}
                    </div>
                    <h3 style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--ink)",
                      marginBottom: 8,
                      lineHeight: 1.4,
                    }}>
                      {title}
                    </h3>
                    <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                      {body}
                    </p>
                  </div>
                  {/* Arrow between steps (desktop only) */}
                  {i < 3 && (
                    <div className="hidden md:flex items-center justify-center"
                      style={{ color: "var(--ink-mute)", fontSize: 18 }}>
                      →
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* ─── id="mentor" anchor (invisible, for nav link) ──────────────────── */}
        <div id="mentor" style={{ position: "relative", top: -60 }} aria-hidden="true" />

        {/* ─── Section 5: Target ────────────────────────────────────────────── */}
        <section style={sectionStyle("#fff")}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <SectionLabel>対象</SectionLabel>
              <h2 style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 500,
                color: "var(--ink)",
              }}>
                こんな企業に最適です
              </h2>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}>
              {/* Good fit */}
              <div style={{
                padding: "28px 28px",
                background: "var(--royal-50)",
                border: "1px solid var(--royal-100)",
                borderRadius: 14,
              }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--royal)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  marginBottom: 20,
                }}>
                  ✓ Opinio が力になれる
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <CheckItem>IT/SaaS業界の即戦力人材を採用したい</CheckItem>
                  <CheckItem>コストを抑えつつ質の高い採用をしたい</CheckItem>
                  <CheckItem>早期離職を防ぐ採用設計を求めている</CheckItem>
                  <CheckItem>1名からでも丁寧に採用したい</CheckItem>
                </div>
              </div>

              {/* Not fit */}
              <div style={{
                padding: "28px 28px",
                background: "var(--bg-tint)",
                border: "1px solid var(--line)",
                borderRadius: 14,
              }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink-mute)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  marginBottom: 20,
                }}>
                  （参考）不向きな場合
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <CrossItem>採用ボリュームを最大化したい</CrossItem>
                  <CrossItem>短期決戦で多数の候補者にスカウトを送りたい</CrossItem>
                  <CrossItem>IT/SaaS以外の業界での採用が中心</CrossItem>
                </div>
                <p style={{
                  marginTop: 16,
                  fontSize: 12,
                  color: "var(--ink-mute)",
                  lineHeight: 1.7,
                }}>
                  ミスマッチを防ぐため、当社の強みを正直にお伝えしています。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Section 7: FAQ ───────────────────────────────────────────────── */}
        <section id="faq" style={sectionStyle("#fff")}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <SectionLabel>よくある質問</SectionLabel>
              <h2 style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 500,
                color: "var(--ink)",
              }}>
                FAQ
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <FaqItem
                q="本当に掲載は無料ですか？"
                a="はい、月額費用や広告費は一切いただきません。求人公開、スカウト、面談まで全て無料でご利用いただけます。"
              />
              <FaqItem
                q="成果報酬の発生条件は？"
                a="候補者の入社が確定した時点でご請求します。それまでは一切請求が発生しません。シンプルな料金体系です。詳細はお問い合わせください。"
              />
              <FaqItem
                q="自社で採用したい場合は？"
                a="求人公開、スカウト、面談まで全て無料でご利用いただけます。自社の採用力で完結する企業様にも、無料の掲載基盤としてご活用いただけます。"
              />
              <FaqItem
                q="営業電話はかかってきますか？"
                a="ございません。ご質問やご相談はサイト内のフォーム、またはメール（contact@opinio.co.jp）からのみ承ります。"
              />
              <FaqItem
                q="どのような業界に対応していますか？"
                a="現在は IT/SaaS 業界に特化して運営しています。将来的には他業界への展開も予定していますが、現時点では IT/SaaS 業界の即戦力人材採用に最適化されています。"
              />
              <FaqItem
                q="登録に審査はありますか？"
                a="ございません。セルフサーブ型で、登録後すぐに求人を公開できます。※ 明らかにスパムや偽情報と判断される場合のみ、運営側で削除する場合があります（事後巡回方式）。"
              />
              <FaqItem
                q="メンターとはどんな存在ですか？"
                a="IT 業界で経験を積んだプロフェッショナルです。候補者の方々は応募前にメンターと面談し、キャリアの方向性や企業選びについてアドバイスを受けます。これにより「本気度の高い応募」だけが企業に届きます。"
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

        {/* ─── Section 8: Final CTA ─────────────────────────────────────────── */}
        <section style={{
          padding: "96px 24px",
          background: "var(--royal)",
          textAlign: "center",
        }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <h2 style={{
              fontFamily: "var(--font-noto-serif)",
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 500,
              color: "#fff",
              lineHeight: 1.3,
              marginBottom: 16,
            }}>
              今すぐ始める
            </h2>
            <p style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.75)",
              lineHeight: 1.8,
              marginBottom: 44,
            }}>
              登録は1分で完了します。<br />
              クレジットカード登録不要、自動課金もありません。
            </p>

            <Link
              href={bizCtaHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "16px 40px",
                background: "#fff",
                color: "var(--royal)",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
                letterSpacing: "0.01em",
              }}
            >
              企業を新規登録（無料）
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" as const }}>
              <a
                href="mailto:contact@opinio.co.jp"
                style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "underline" }}
              >
                お問い合わせ
              </a>
            </div>
          </div>
        </section>

      </main>
      <JobseekerFooter />
    </>
  );
}
