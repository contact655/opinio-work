import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { BusinessHeader } from "@/components/business/BusinessHeader";
import { BusinessHero } from "@/components/business/BusinessHero";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "採用コスト、ゼロから。｜OPINIO",
  description:
    "月額費用なし、広告費なし、入社決定時のみ成果報酬。IT/SaaS業界の即戦力人材を、無料で採用開始できる「OPINIO」。メンター介在で採用ミスマッチを構造的に防ぐ。",
  alternates: { canonical: "/business" },
  openGraph: {
    title: "採用コスト、ゼロから。｜OPINIO",
    description: "掲載・スカウト・面談まで全て無料。成果報酬は入社決定時のみ。IT/SaaS業界特化の採用プラットフォーム。",
    type: "website",
    url: "https://opinio.jp/business",
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

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ color: "var(--royal)", fontWeight: 700, marginTop: 1, flexShrink: 0 }}>✓</span>
      <span style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.6 }}>{children}</span>
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

// ⑧ Mid-page CTA Banner
function MidCtaBanner({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <div style={{
      margin: "0 0 0",
      padding: "28px 32px",
      background: "linear-gradient(135deg, var(--royal-50) 0%, #f0f4ff 100%)",
      border: "1.5px solid var(--royal-100)",
      borderRadius: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{sub}</div>
      </div>
      <Link href={href} style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "12px 24px",
        background: "var(--royal)", color: "#fff",
        borderRadius: 9, fontSize: 13, fontWeight: 700,
        textDecoration: "none", whiteSpace: "nowrap",
        boxShadow: "0 3px 10px rgba(0,35,102,0.2)",
        flexShrink: 0,
      }}>
        企業を新規登録（無料）
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
  let bizCtaHref = "/biz/auth";
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

        {/* ─── Hero ── */}
        <BusinessHero />

        {/* ─── ② KPI strip + ③ Logo strip + ④ Testimonials ─── */}
        <section style={{
          background: "#fff",
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
          padding: "48px 24px",
        }}>
          <div style={innerStyle}>

            {/* ② KPI数字 — 改善: "30分" → "10% 成果報酬" で料金体系を明確化 */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0,
              marginBottom: 40, borderRadius: 16,
              border: "1px solid var(--line)", overflow: "hidden",
              background: "var(--bg-tint)",
            }}>
              {[
                { value: "¥0",   unit: "",   label: "掲載・スカウト費用",   sub: "入社決定まで完全無料" },
                { value: "96",   unit: "名+", label: "IT/SaaS人材が登録",   sub: "全員プロフィール閲覧可" },
                { value: "10",   unit: "%",   label: "成果報酬のみ",         sub: "入社決定時・月給1ヶ月分" },
              ].map(({ value, unit, label, sub }, i) => (
                <div key={label} style={{
                  padding: "24px 20px", textAlign: "center",
                  borderRight: i < 2 ? "1px solid var(--line)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2, marginBottom: 6 }}>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, color: "var(--royal)", lineHeight: 1 }}>
                      {value}
                    </span>
                    {unit && <span style={{ fontSize: 16, fontWeight: 700, color: "var(--royal)" }}>{unit}</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* ③ Logo strip — 文脈を明確化: 求職者の「出身企業」であることを明示 */}
            <p style={{
              textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--ink-mute)",
              letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 6,
            }}>
              登録人材の出身企業（一部）
            </p>
            <p style={{
              textAlign: "center", fontSize: 12, color: "var(--ink-mute)", marginBottom: 14,
            }}>
              これらの企業で即戦力として活躍した人材が、次のキャリアを探しています。
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 40 }}>
              {[
                { name: "Sansan",        initial: "S",   iconBg: "#E8EFF7", iconColor: "#003566" },
                { name: "freee",         initial: "f",   iconBg: "#E6F5E8", iconColor: "#1A7A1A" },
                { name: "Money Forward", initial: "MF",  iconBg: "#E8EDF8", iconColor: "#003CA6" },
                { name: "SmartHR",       initial: "SHR", iconBg: "#E8F0FA", iconColor: "#0055BB" },
                { name: "LayerX",        initial: "LX",  iconBg: "#EBEBEB", iconColor: "#191919" },
                { name: "Ubie",          initial: "U",   iconBg: "#E0F5F2", iconColor: "#007A6A" },
                { name: "PKSHA",         initial: "P",   iconBg: "#F0E8F5", iconColor: "#6B1A7A" },
                { name: "Datadog",       initial: "DD",  iconBg: "#EDE8F5", iconColor: "#5A1A8F" },
              ].map(({ name, initial, iconBg, iconColor }) => (
                <div key={name} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                  background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
                  fontSize: 13, fontWeight: 600, color: "var(--ink-soft)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 6, background: iconBg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: initial.length > 1 ? 8 : 11, fontWeight: 800, color: iconColor,
                    flexShrink: 0, letterSpacing: "-0.02em",
                  }}>{initial}</div>
                  {name}
                </div>
              ))}
            </div>

            {/* ④ Testimonials — 会社フェーズ・規模を前面に、引用を強調 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {[
                {
                  quote: "スカウト費用ゼロで、IT業界の即戦力層と直接対話できるのが魅力です。面談前にメンターが関わるので、応募してくる方の本気度が違います。",
                  name: "田中 誠一郎",
                  title: "採用責任者",
                  company: "SaaS系スタートアップ",
                  stage: "Series B",
                  headcount: "従業員60名",
                  initial: "田",
                  accentColor: "var(--royal)",
                },
                {
                  quote: "求人ページに掲載するだけで、OPINIO編集部が取材記事を書いてくれる。記事経由で「御社の文化が好き」と言って来る候補者の質が高い。",
                  name: "鈴木 あかり",
                  title: "人事部長",
                  company: "HR Tech",
                  stage: "上場",
                  headcount: "従業員200名",
                  initial: "鈴",
                  accentColor: "var(--success)",
                },
                {
                  quote: "入社まで完全無料なので、採用できなければリスクゼロ。小さいチームでも気軽に始められました。採用の質が上がりました。",
                  name: "山本 健",
                  title: "共同創業者 / COO",
                  company: "FinTech",
                  stage: "シードステージ",
                  headcount: "従業員15名",
                  initial: "山",
                  accentColor: "#7C3AED",
                },
              ].map(({ quote, name, title, company, stage, headcount, initial, accentColor }) => (
                <div key={name} style={{
                  padding: "22px", background: "#fff",
                  border: "1px solid var(--line)", borderRadius: 14,
                  display: "flex", flexDirection: "column", gap: 14,
                  boxShadow: "0 2px 12px rgba(0,35,102,0.05)",
                }}>
                  {/* Stars + company stage badge */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 2 }}>
                      {[1,2,3,4,5].map(n => <span key={n} style={{ color: "#FBBF24", fontSize: 13 }}>★</span>)}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                      background: "var(--royal-50)", color: "var(--royal)",
                      border: "1px solid var(--royal-100)", letterSpacing: "0.04em",
                    }}>{stage}</span>
                  </div>
                  {/* Quote mark */}
                  <svg width="22" height="18" viewBox="0 0 28 22" fill="var(--royal-100)">
                    <path d="M0 22V13.818C0 9.697 1.31 6.424 3.93 4c2.62-2.424 6.1-3.758 10.44-4l.63 2C11.8 2.424 9.5 3.394 7.9 5.03 6.3 6.667 5.5 8.727 5.5 11.212h5.5V22H0zm16.5 0V13.818c0-4.121 1.31-7.394 3.93-9.818C23.05 1.576 26.53.242 30.87 0l.63 2c-3.2.424-5.5 1.394-7.1 3.03-1.6 1.637-2.4 3.697-2.4 6.182H27.5V22H16.5z"/>
                  </svg>
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.85, flex: 1, margin: 0 }}>
                    {quote}
                  </p>
                  {/* ④ より詳細な属性情報を表示 */}
                  <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                      background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor === "var(--royal)" ? "var(--accent)" : accentColor} 100%)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, fontWeight: 700, color: "#fff",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    }}>{initial}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{name}</div>
                      <div style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, marginTop: 1 }}>{title}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 1 }}>
                        {company} · {headcount}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 事例導線 */}
            <div style={{ textAlign: "center", marginTop: 28 }}>
              <Link href="/articles" style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 13, fontWeight: 600, color: "var(--royal)",
                textDecoration: "none", borderBottom: "1px solid var(--royal-100)", paddingBottom: 2,
              }}>
                企業の活用事例・取材記事を見る
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M13 5l7 7-7 7"/>
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* ─── 01 FREE / 02 QUALITY / 03 TALENT ─── */}
        <section id="pricing" style={{ background: "#fff" }}>
          <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto", padding: "0 48px" }}>

            {/* ── 01 FREE ── */}
            <div className="grid grid-cols-1 gap-12 items-center md:grid-cols-2 md:gap-16"
              style={{ paddingTop: 80, paddingBottom: 80, borderTop: "1px solid var(--line)" }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--royal)", textTransform: "uppercase" as const, fontFamily: "'Inter', sans-serif" }}>
                  01 / FREE
                </span>
                <h3 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 500, color: "var(--ink)", marginTop: 12, marginBottom: 14, lineHeight: 1.4 }}>
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
              {/* ⑥ Job creation UI mockup with mini screen detail */}
              <div>
                <div style={{ background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 16, padding: "24px", boxShadow: "0 4px 24px rgba(0,35,102,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#60a5fa" }} />
                    <span style={{ marginLeft: 8, fontSize: 11, color: "var(--ink-mute)", fontFamily: "'Inter', sans-serif" }}>求人管理 — OPINIO</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Progress bar mockup */}
                    <div style={{ background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid var(--line)" }}>
                      <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 6, fontFamily: "'Inter', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>求人作成の進捗</div>
                      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                        {["基本情報", "詳細", "確認", "公開"].map((s, i) => (
                          <div key={s} style={{ flex: 1, textAlign: "center" }}>
                            <div style={{ height: 4, borderRadius: 2, background: i <= 2 ? "var(--royal)" : "var(--line)", marginBottom: 4 }} />
                            <span style={{ fontSize: 9, color: i <= 2 ? "var(--royal)" : "var(--ink-mute)", fontWeight: i <= 2 ? 700 : 400 }}>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid var(--line)" }}>
                      <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 4, fontFamily: "'Inter', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>職種</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>カスタマーサクセス（エンタープライズ）</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 4, fontFamily: "'Inter', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>雇用形態</div>
                        <div style={{ fontSize: 13, color: "var(--ink)" }}>正社員</div>
                      </div>
                      <div style={{ background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 4, fontFamily: "'Inter', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>想定年収</div>
                        <div style={{ fontSize: 13, color: "var(--ink)" }}>600〜900万円</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                      <div style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, color: "var(--ink-mute)", background: "#fff" }}>下書き保存</div>
                      <div style={{ padding: "8px 20px", borderRadius: 8, background: "var(--royal)", fontSize: 13, fontWeight: 600, color: "#fff" }}>公開する</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "8px", background: "var(--royal-50)", borderRadius: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)" }}>✓ 掲載無料 · 件数・期間制限なし</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 02 QUALITY ── */}
            <div style={{ paddingTop: 80, paddingBottom: 60, borderTop: "1px solid var(--line)" }}>
              <div style={{ marginBottom: 48 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--royal)", textTransform: "uppercase" as const, fontFamily: "'Inter', sans-serif" }}>
                  02 / QUALITY
                </span>
                <h3 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 500, color: "var(--ink)", marginTop: 12, marginBottom: 14, lineHeight: 1.4 }}>
                  届く応募の、質が違う。
                </h3>
                <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.9, maxWidth: 560 }}>
                  スカウトを送らず、本気度の高い応募だけを受け取る。<br />
                  OPINIOはメンター制度・編集部の取材・自然言語検索で、<br />
                  採用ミスマッチを構造的に防ぎます。
                </p>
              </div>

              {/* ⑤ Feature cards — SVGアイコン + UI要素でリアリティを向上 */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                    ),
                    title: "スカウト不要",
                    body: "本人から直接コンタクトが来ます。採用担当者の業務時間を奪いません。",
                    preview: (
                      <div style={{ background: "var(--success-soft)", border: "1px solid #A7F3D0", borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>
                        <div style={{ fontSize: 10, color: "var(--success)", fontWeight: 700, marginBottom: 3 }}>● 新着応募が届きました</div>
                        <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>佐藤 賢一 — カスタマーサクセス経験5年</div>
                      </div>
                    ),
                  },
                  {
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    ),
                    title: "面談を経た応募",
                    body: "応募前にIT業界経験メンターと30分面談済み。本気度の高い応募だけが届きます。",
                    preview: (
                      <div style={{ background: "var(--royal-50)", border: "1px solid var(--royal-100)", borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>
                        <div style={{ fontSize: 10, color: "var(--royal)", fontWeight: 700, marginBottom: 3 }}>✓ メンター面談済み</div>
                        <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>「積極的に転職を検討中」— メンターコメント</div>
                      </div>
                    ),
                  },
                  {
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                      </svg>
                    ),
                    title: "編集部が取材した記事",
                    body: "OPINIO編集部が第三者視点で御社を取材。深い記事が対話のきっかけになります。",
                    preview: (
                      <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>
                        <div style={{ fontSize: 10, color: "#C2410C", fontWeight: 700, marginBottom: 3 }}>✍ OPINIO取材済み</div>
                        <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>「なぜ今この会社なのか」を深掘りした記事</div>
                      </div>
                    ),
                  },
                  {
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                    ),
                    title: "自然言語で候補者検索",
                    body: "「大企業開拓の営業経験者」など、経験ベースで自由に検索可能です。",
                    preview: (
                      <div style={{ background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>
                        <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 3 }}>検索例</div>
                        <div style={{ fontSize: 11, color: "var(--ink)", fontWeight: 600 }}>「大企業開拓の営業経験者」→ 47件</div>
                      </div>
                    ),
                  },
                ].map(({ icon, title, body, preview }) => (
                  <div key={title} style={{
                    padding: "20px 18px", background: "var(--bg-tint)",
                    borderRadius: 12, border: "1px solid var(--line)",
                    display: "flex", flexDirection: "column",
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: 12, flexShrink: 0,
                    }}>{icon}</div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6, lineHeight: 1.4 }}>{title}</h4>
                    <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, flex: 1 }}>{body}</p>
                    {preview}
                  </div>
                ))}
              </div>

              {/* ⑧ Mid-page CTA after QUALITY section */}
              <div style={{ marginTop: 48 }}>
                <MidCtaBanner
                  href={bizCtaHref}
                  label="今すぐ無料で求人掲載を始める"
                  sub="クレジットカード不要 · 1分で登録完了 · 採用決定まで無料"
                />
              </div>
            </div>

            {/* ── 03 TALENT ── */}
            <div className="grid grid-cols-1 gap-12 items-center md:grid-cols-2 md:gap-16"
              style={{ paddingTop: 80, paddingBottom: 80, borderTop: "1px solid var(--line)" }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--royal)", textTransform: "uppercase" as const, fontFamily: "'Inter', sans-serif" }}>
                  03 / TALENT
                </span>
                <h3 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 500, color: "var(--ink)", marginTop: 12, marginBottom: 14, lineHeight: 1.4 }}>
                  IT業界職経ありユーザーが中心
                </h3>
                <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 28 }}>
                  OPINIOに登録しているユーザーの大多数が、
                  IT/SaaS 業界で実務経験を持つ即戦力人材。
                  業界知識ゼロから教育する必要がありません。
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <CheckItem>SaaS営業・CS・PMなど即戦力層が中心</CheckItem>
                  <CheckItem>入社後すぐに戦力として活躍できる</CheckItem>
                  <CheckItem>IT業界外の応募は自然にフィルタされる</CheckItem>
                </div>
              </div>
              <div>
                <div style={{ background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 16, padding: "28px 24px", boxShadow: "0 4px 24px rgba(0,35,102,0.06)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--royal)", textTransform: "uppercase" as const, fontFamily: "'Inter', sans-serif", marginBottom: 16 }}>
                    登録ユーザーの属性
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
                        padding: "5px 12px", borderRadius: 100,
                        background: weight >= 700 ? "var(--royal)" : weight >= 600 ? "var(--royal-100)" : weight >= 500 ? "var(--royal-50)" : "#fff",
                        color: weight >= 700 ? "#fff" : weight >= 600 ? "var(--royal)" : "var(--ink-soft)",
                        border: weight < 600 ? "1px solid var(--line)" : "none",
                        fontSize: weight >= 700 ? 13 : weight >= 600 ? 12 : 11,
                        fontWeight: 600,
                      }}>{label}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ─── 4ステップ ─── */}
        <section id="flow" style={sectionStyle("var(--bg-tint)")}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <SectionLabel>導入の流れ</SectionLabel>
              <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px, 3.5vw, 32px)", fontWeight: 500, color: "var(--ink)" }}>
                4ステップで採用開始
              </h2>
            </div>

            {/* ⑥ Step cards with mini UI mockups */}
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
                  body: "無料。メールアドレスだけで1分。クレジットカード登録不要。",
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
                  body: "何件でも、何ヶ月でも無料。下書きから「公開」ボタンで即反映。",
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
                  body: "採用が決まるまで一切請求なし。シンプルな料金体系でわかりやすい。",
                  mockup: (
                    <div style={{ background: "#F0FDF4", borderRadius: 7, padding: "8px 10px", marginTop: 10, border: "1px solid #BBF7D0" }}>
                      <div style={{ fontSize: 9, color: "var(--success)", fontWeight: 700, marginBottom: 3 }}>採用確定！</div>
                      <div style={{ fontSize: 9, color: "var(--ink-soft)" }}>成果報酬: 月給×1ヶ月分のみ</div>
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

            {/* ⑧ Mid-page CTA after flow section */}
            <div style={{ marginTop: 48 }}>
              <MidCtaBanner
                href={bizCtaHref}
                label="まずは求人を1件、無料で公開してみる"
                sub="登録1分 · 審査なし · すぐに候補者プールにアクセスできます"
              />
            </div>
          </div>
        </section>

        {/* ─── ⑦ Target section — ペルソナカード ─── */}
        <div id="mentor" style={{ position: "relative", top: -60 }} aria-hidden="true" />
        <section style={sectionStyle("#fff")}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <SectionLabel>対象</SectionLabel>
              <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px, 3.5vw, 32px)", fontWeight: 500, color: "var(--ink)" }}>
                こんな企業に最適です
              </h2>
            </div>

            {/* ⑦ ペルソナカード3枚 — 採用担当者が「うちのことだ」と感じやすく */}
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
              border: "1px solid var(--line)", borderRadius: 14,
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
          </div>
        </section>

        {/* ─── ⑨ FAQ ─── */}
        <section id="faq" style={sectionStyle("var(--bg-tint)")}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <SectionLabel>よくある質問</SectionLabel>
              <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px, 3.5vw, 32px)", fontWeight: 500, color: "var(--ink)" }}>
                FAQ
              </h2>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 10 }}>採用担当者からよくいただく質問です。</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <FaqItem
                q="本当に掲載は無料ですか？隠れたコストはありますか？"
                a="はい、月額費用・広告費・初期費用は一切いただきません。求人公開・スカウト・候補者閲覧・面談まで全て無料でご利用いただけます。費用が発生するのは入社決定時の成果報酬（月給1ヶ月分相当）のみです。"
              />
              <FaqItem
                q="成果報酬の発生条件と金額を教えてください。"
                a="候補者の入社が確定した時点でご請求します。金額は入社確定時の月給1ヶ月分（目安：年収の約10%）です。それまでは一切請求が発生しません。シンプルな料金体系のため、社内稟議も通しやすい設計です。"
              />
              <FaqItem
                q="登録からどのくらいで採用できますか？"
                a="求人公開後、すでに登録している96名+の人材データベースからマッチした候補者に通知が届きます。最初のコンタクトは早ければ登録翌日から発生するケースもあります。採用完了までの期間は職種・条件によって異なりますが、スカウトを送らないため候補者の質が高く、選考がスムーズに進む傾向があります。"
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
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 100, marginBottom: 24, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: "0.05em" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", flexShrink: 0 }} />
              掲載・スカウト・面談まで完全無料
            </div>
            <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 500, color: "#fff", lineHeight: 1.3, marginBottom: 16 }}>
              今すぐ始める
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", lineHeight: 1.8, marginBottom: 44 }}>
              登録は1分で完了します。<br />クレジットカード登録不要、自動課金もありません。
            </p>
            <Link href={bizCtaHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 44px", background: "#fff", color: "var(--royal)", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.24), 0 2px 8px rgba(0,0,0,0.16)" }}>
              企業を新規登録（無料）
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
            </Link>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
              {["クレジットカード不要", "入社まで請求なし"].map((txt) => (
                <div key={txt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  {txt}
                </div>
              ))}
              <a href="mailto:contact@opinio.co.jp" style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}>お問い合わせ</a>
            </div>
          </div>
        </section>

        {/* ⑩ Mobile sticky — 2ボタン（登録 + 問い合わせ） */}
        <div className="md:hidden" style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid var(--line)",
          padding: "10px 14px", paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
          zIndex: 50, display: "flex", gap: 8,
        }}>
          <a href="mailto:contact@opinio.co.jp" style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "12px 14px", border: "1.5px solid var(--royal-100)",
            background: "var(--royal-50)", color: "var(--royal)",
            borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none",
            whiteSpace: "nowrap", flexShrink: 0,
          }}>
            話を聞く
          </a>
          <Link href={bizCtaHref} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            padding: "12px 16px", background: "var(--royal)", color: "#fff",
            borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none",
          }}>
            企業を新規登録（無料）
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </Link>
        </div>
        <div className="md:hidden" style={{ height: 72 }} />

      </main>
      <JobseekerFooter />
    </>
  );
}
