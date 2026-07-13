"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import HomeFaq from "@/app/HomeFaq";
import { LogoWall } from "@/components/companies/LogoWall";

// ─── Featured company cards（#4）─────────────────────────────────────────────

const FEATURED_COMPANIES = [
  {
    id: "c3664ef1-5571-4645-b30f-1474e7961c17",
    name: "株式会社セールスフォース・ジャパン",
    brandName: "Salesforce Japan",
    industry: "CRM・営業支援",
    logoUrl: null,
    logoLetter: "S",
    gradient: "#374151",
    jobCount: 111,
    articleCount: 1,
  },
  {
    id: "81aa95dc-2304-4faa-9c4a-f2f5454e8e11",
    name: "SmartHR株式会社",
    brandName: "SmartHR",
    industry: "HR Tech",
    logoUrl: null,
    logoLetter: "S",
    gradient: "#4B5563",
    jobCount: 3,
    articleCount: 2,
  },
  {
    id: "f98f5d13-c72f-42fa-9c91-ee4647de2793",
    name: "freee株式会社",
    brandName: "freee",
    industry: "FinTech",
    logoUrl: null,
    logoLetter: "F",
    gradient: "#6B7280",
    jobCount: 3,
    articleCount: 1,
  },
];

function FeaturedThreeCards() {
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  return (
    <section style={{ background: "#fff", padding: "48px 48px 40px", borderTop: "1px solid var(--line)" }} className="px-5 py-10 md:px-12">
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-mute)", marginBottom: 20, textTransform: "uppercase" as const }}>
          掲載企業の例
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURED_COMPANIES.map((co) => {
            const showLogo = co.logoUrl && !imgErrors.has(co.id);
            return (
              <Link key={co.id} href={`/companies/${co.id}`} style={{ textDecoration: "none", display: "block" }}>
                <div style={{
                  borderRadius: 14, border: "1px solid var(--line)",
                  overflow: "hidden", background: "#fff",
                  boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
                  transition: "box-shadow 0.18s, transform 0.18s",
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,35,102,0.1)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(15,23,42,0.06)"; (e.currentTarget as HTMLDivElement).style.transform = ""; }}
                >
                  {/* Logo area */}
                  <div style={{ height: 72, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--line-soft)", background: "#fafafa" }}>
                    {showLogo ? (
                      <Image src={co.logoUrl ?? ""} alt={co.brandName} width={120} height={36} style={{ maxHeight: 36, maxWidth: "60%", objectFit: "contain", width: "auto" }}
                        onError={() => setImgErrors(prev => new Set(Array.from(prev).concat(co.id)))} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: co.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff" }}>{co.logoLetter}</div>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{co.brandName}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 10 }}>{co.industry}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                      {co.articleCount > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "var(--line-soft)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>
                          ✍ 取材記事 {co.articleCount}件
                        </span>
                      )}
                      {co.jobCount > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>
                          💼 求人 {co.jobCount}件
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/companies" style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
            全企業を見る →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Job category quick-filter tags（#5）─────────────────────────────────────

const JOB_TAGS = [
  { label: "フィールドセールス", q: "フィールドセールス" },
  { label: "インサイドセールス", q: "インサイドセールス" },
  { label: "カスタマーサクセス", q: "カスタマーサクセス" },
  { label: "プロダクトマネージャー", q: "プロダクト" },
  { label: "エンジニア", q: "エンジニア" },
  { label: "マーケティング", q: "マーケティング" },
];

function JobTagSection() {
  const router = useRouter();
  return (
    <section style={{ background: "var(--royal-50)", padding: "28px 48px", borderTop: "1px solid var(--royal-100)" }} className="px-5 py-6 md:px-12">
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--royal)", flexShrink: 0, letterSpacing: "0.04em" }}>職種で探す:</span>
          {JOB_TAGS.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => router.push(`/jobs?q=${encodeURIComponent(t.q)}`)}
              style={{
                fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 100,
                background: "#fff", border: "1.5px solid var(--royal-100)",
                color: "var(--royal)", cursor: "pointer", transition: "all 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--royal)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)"; }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const PAIN_POINTS = [
  {
    icon: <ClockIcon />,
    q: "情報が古い気がして、応募に踏み切れない",
    pain: "求人票がいつ更新されたのかわからない。鮮度の見えない情報では、動き出せない。",
    resolution: "OPINIO編集部が定期取材。更新日を明示し、求人票には載らない「今の状態」を届けます。",
  },
  {
    icon: <ChatIcon />,
    q: "求人票には記載がない「本当の組織文化」が知りたい",
    pain: "公式情報だけでは、入社後のギャップが怖い。会社の内側がわからないまま応募するリスク。",
    resolution: "現役社員・OBへの取材レポートを各企業ページで公開。求人票に載らないカルチャーや組織の実態を確認できます。",
  },
  {
    icon: <PhoneOffIcon />,
    q: "転職サイトに登録するとスカウトメールがたくさん届く",
    pain: "登録したら電話・メールラッシュで冷静に比較できない。転職活動が「追われる」感覚に。",
    resolution: "OPINIOはスカウト・営業電話・メール一切なし。登録後も企業からの連絡は来ません。",
  },
];

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "inline-block",
      fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.12em",
      color: "var(--royal)", textTransform: "uppercase" as const, marginBottom: "var(--space-4)",
      background: "var(--royal-50)", border: "1px solid var(--royal-100)",
      padding: "4px 14px", borderRadius: 100,
    }}>
      {children}
    </div>
  );
}

function CheckMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
function ClockIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
}
function SearchIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>;
}
function ChatIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
}
function PhoneOffIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
function ArrowIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>;
}
function BuildingIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h6M3 15h6M15 9h6M15 15h6"/></svg>;
}
function BriefcaseIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="17"/><line x1="9.5" y1="14.5" x2="14.5" y2="14.5"/></svg>;
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

// ─── Hero company preview cards ───────────────────────────────────────────────
const HERO_COMPANIES = [
  { id: "c3664ef1-5571-4645-b30f-1474e7961c17", name: "Salesforce Japan", industry: "グローバルCRM", phase: "上場", gradient: "linear-gradient(135deg,#00A1E0,#0066CC)", letter: "SF", jobs: 106 },
  { id: "81aa95dc-2304-4faa-9c4a-f2f5454e8e11", name: "SmartHR", industry: "HR Tech", phase: "シリーズD", gradient: "linear-gradient(135deg,#1E3A5F,#2E5077)", letter: "SH", jobs: 3 },
  { id: "a6b3aef3-6c56-4c95-99f5-08be757b12d7", name: "medimo", industry: "Medical AI", phase: "シリーズA", gradient: "linear-gradient(135deg,#059669,#047857)", letter: "ME", jobs: 25 },
  { id: "f98f5d13-c72f-42fa-9c91-ee4647de2793", name: "freee", industry: "FinTech", phase: "上場", gradient: "linear-gradient(135deg,#7C3AED,#5B21B6)", letter: "fr", jobs: 3 },
];

function HeroCompanyPreview() {
  return (
    <div style={{
      background: "var(--royal)",
      borderRadius: 16,
      padding: "20px 18px 16px",
      boxShadow: "0 20px 56px rgba(0,35,102,0.28)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* bg decoration */}
      <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(59,95,217,0.25)", pointerEvents: "none" }} />
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" as const, marginBottom: 14, position: "relative" }}>
        掲載企業（一部）
      </div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, position: "relative" }}>
        {HERO_COMPANIES.map((co) => (
          <Link key={co.id} href={`/companies/${co.id}`} style={{ textDecoration: "none" }}>
            <div style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 11,
              transition: "background 0.15s",
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.13)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.07)"; }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 8, background: co.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0, fontFamily: "Inter, sans-serif" }}>{co.letter}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{co.name}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{co.industry}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(5,150,105,0.3)", color: "#6EE7B7", padding: "2px 7px", borderRadius: 100, whiteSpace: "nowrap" as const }}>面談受付中</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>求人{co.jobs}件</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 12, textAlign: "center" as const, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>他{">"}76社掲載中</div>
    </div>
  );
}

function Hero({ companyNum, jobNum, newJobsThisWeek }: { companyNum: string; jobNum: string; newJobsThisWeek: number }) {
  return (
    <section style={{
      background: "#fff",
      borderBottom: "1px solid var(--line)",
      padding: "80px 48px 64px",
    }} className="px-5 pt-16 pb-12 md:px-12 md:pt-20 md:pb-16">
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}>
        <div className="hero-two-col">
          {/* ── 左: テキスト ── */}
          <div className="hero-left">
            <h1 style={{
              fontSize: "clamp(28px,3.6vw,50px)",
              fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.03em",
              color: "var(--ink)", marginBottom: 18,
              fontFamily: "var(--font-noto-serif)",
            }}>
              IT転職に必要な<br />情報が、ここで完結する。
            </h1>

            <p style={{ fontSize: 15, lineHeight: 1.9, color: "var(--ink-soft)", marginBottom: 32, maxWidth: 480 }}>
              企業データ・求人・編集部の取材記事を一か所に集約。<br />
              探し回らず、比べて、自分のペースで応募できます。
            </p>

            {/* CTAs */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" as const, marginBottom: 40 }}>
              <Link href="/companies" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "14px 28px",
                background: "var(--ink)", color: "#fff",
                fontWeight: 700, fontSize: 14, borderRadius: 8, textDecoration: "none",
                letterSpacing: "-0.01em",
              }}>
                まず企業を見てみる <ArrowIcon />
              </Link>
              <Link href="/auth" style={{
                fontSize: 13, color: "var(--ink-mute)", textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                → 無料登録はこちら（30秒）
              </Link>
            </div>

            {/* 数字ストリップ */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 24 }}>
              <div style={{ display: "flex", gap: 0, marginBottom: newJobsThisWeek > 0 ? 14 : 0 }}>
                {[
                  { num: companyNum, label: "取材済み企業" },
                  { num: jobNum, label: "公開求人" },
                  { num: "外資IT・SaaS", label: "特化領域" },
                ].map((item, i) => (
                  <div key={item.label} style={{
                    flex: 1, paddingRight: 20,
                    borderLeft: i > 0 ? "1px solid var(--line)" : "none",
                    paddingLeft: i > 0 ? 20 : 0,
                  }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "clamp(16px,1.8vw,22px)", fontWeight: 800, color: "var(--ink)", lineHeight: 1.1 }}>{item.num}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 3, fontWeight: 500 }}>{item.label}</div>
                  </div>
                ))}
              </div>
              {newJobsThisWeek > 0 && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 99, background: "var(--success-soft)", border: "1px solid #A7F3D0" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success)" }}>今週 {newJobsThisWeek}件の新着求人</span>
                </div>
              )}
            </div>
          </div>

          {/* ── 右: 企業プレビューカード ── */}
          <div className="hero-right">
            <HeroCompanyPreview />
          </div>
        </div>
      </div>
      <style>{`
        .hero-two-col {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 56px;
          align-items: center;
        }
        .hero-right { display: block; }
        @media (max-width: 900px) {
          .hero-two-col { grid-template-columns: 1fr; gap: 36px; }
          .hero-right { max-width: 420px; }
        }
        @media (max-width: 640px) {
          .hero-right { display: none; }
        }
      `}</style>
    </section>
  );
}


// ─── Featured Companies ────────────────────────────────────────────────────────

type PreviewCompany = {
  id: string;
  name: string;
  industry: string | null;
  phase: string | null;
  gradient: string;
  letter: string;
  logoUrl: string | null;
  acceptingMeeting: boolean;
  employeeCount: number | null;
  articleCount?: number;
  memberCount?: number;
};

const PHASE_COLORS: Record<string, { bg: string; color: string }> = {
  "シリーズA": { bg: "#EFF3FC", color: "var(--royal)" },
  "シリーズB": { bg: "#F3E8FF", color: "#7C3AED" },
  "シリーズC": { bg: "#ECFDF5", color: "var(--success)" },
  "上場": { bg: "var(--line-soft)", color: "var(--ink-soft)" },
  "グロース": { bg: "var(--line-soft)", color: "var(--ink-soft)" },
  "プライム": { bg: "var(--line-soft)", color: "var(--ink-soft)" },
};

function CompanyMiniCard({ c }: { c: PreviewCompany }) {
  const phaseStyle = c.phase ? (PHASE_COLORS[c.phase] ?? { bg: "var(--line-soft)", color: "var(--ink-mute)" }) : null;
  return (
    <Link href={`/companies/${c.id}`} style={{ textDecoration: "none" }}>
      <div className="company-mini-card" style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "20px 20px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        height: "100%",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* 面談受付中バッジ */}
        {c.acceptingMeeting && (
          <div style={{
            position: "absolute", top: 12, right: 12,
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px var(--space-2)", borderRadius: 100,
            background: "#ECFDF5", border: "1px solid #A7F3D0",
            fontSize: 9, fontWeight: 700, color: "var(--success)",
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: "50%",
              background: "var(--success)", flexShrink: 0,
              animation: "pulse-dot 2s ease-in-out infinite",
            }} />
            面談受付中
          </div>
        )}

        {/* Logo + Name */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: c.gradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: "var(--text-md)", fontWeight: 700,
            flexShrink: 0, overflow: "hidden",
          }}>
            {c.logoUrl
              ? <Image src={c.logoUrl} alt={c.name} width={48} height={48} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : c.letter
            }
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: "var(--text-base)", fontWeight: 700, color: "var(--ink)",
              lineHeight: 1.3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {c.name}
            </div>
            {c.industry && (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-mute)", marginTop: 2 }}>
                {c.industry}
              </div>
            )}
          </div>
        </div>

        {/* Phase + badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
          {phaseStyle && c.phase && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
              background: phaseStyle.bg, color: phaseStyle.color,
              border: `1px solid ${phaseStyle.color}33`,
            }}>
              {c.phase}
            </span>
          )}
          {/* Show one social proof badge — memberCount preferred, else articleCount */}
          {(c.memberCount ?? 0) > 0 ? (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px var(--space-2)", borderRadius: 100,
              background: "var(--royal-50)", color: "var(--royal)",
              border: "1px solid var(--royal-100)",
              display: "flex", alignItems: "center", gap: 3,
              whiteSpace: "nowrap" as const,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              {c.memberCount}名登録中
            </span>
          ) : (c.articleCount ?? 0) > 0 ? (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px var(--space-2)", borderRadius: 100,
              background: "var(--line-soft)", color: "var(--ink-soft)",
              border: "1px solid var(--line)",
              display: "flex", alignItems: "center", gap: 3,
              whiteSpace: "nowrap" as const,
            }}>
              ✍️ 取材済み
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function CompanyMiniCardSkeleton() {
  return (
    <div style={{
      background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "20px 20px 18px",
      display: "flex", flexDirection: "column", gap: "var(--space-3)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton-shimmer" style={{ height: 14, width: "65%", marginBottom: 6 }} />
          <div className="skeleton-shimmer" style={{ height: 11, width: "45%" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <div className="skeleton-shimmer" style={{ height: 18, width: 60, borderRadius: 100 }} />
        <div className="skeleton-shimmer" style={{ height: 18, width: 80, borderRadius: 100 }} />
      </div>
    </div>
  );
}


function _FeaturedCompaniesSection({ initialCompanies }: { initialCompanies: PreviewCompany[] }) {
  const companies = initialCompanies;
  const loading = false;

  // 6件に絞る
  const displayed = companies.slice(0, 6);

  return (
    <section style={{
      background: "#fff",
      borderTop: "1px solid var(--line)",
      borderBottom: "1px solid var(--line)",
      padding: "56px 0",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }} className="px-5 md:px-12">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "var(--space-8)", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <div>
            <div style={{
              fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.12em",
              color: "var(--royal)", textTransform: "uppercase" as const, marginBottom: "var(--space-2)",
            }}>
              掲載企業
            </div>
            <h2 style={{
              fontSize: "clamp(20px,2.5vw,28px)", fontWeight: 700, color: "var(--ink)",
              lineHeight: 1.35, margin: 0,
              fontFamily: "var(--font-noto-serif)",
            }}>
              IT/SaaS業界を代表する企業が集まっています
            </h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)", marginTop: "var(--space-2)", lineHeight: 1.7 }}>
              編集部が取材・審査した企業のみ掲載。取材記事と求人票を横断して確認できます。
            </p>
          </div>
          <Link href="/companies" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "10px 20px", borderRadius: 8, fontSize: "var(--text-sm)", fontWeight: 600,
            border: "1.5px solid var(--royal)", color: "var(--royal)",
            textDecoration: "none", flexShrink: 0,
          }}>
            全企業を見る →
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3" style={{ gridAutoRows: "1fr" }}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <CompanyMiniCardSkeleton key={i} />)
            : displayed.map((c) => <CompanyMiniCard key={c.id} c={c} />)
          }
        </div>

        {/* ④ Bottom CTA bar — proper button */}
        {!loading && companies.length > 6 && (
          <div style={{ textAlign: "center", marginTop: "var(--space-6)" }}>
            <Link href="/companies" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "11px 28px", borderRadius: 8,
              border: "1.5px solid var(--royal)", color: "var(--royal)",
              fontSize: "var(--text-sm)", fontWeight: 600, textDecoration: "none",
              background: "#fff",
              transition: "background 0.15s",
            }}>
              他 {companies.length - 6} 社を見る
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </Link>
          </div>
        )}

        {/* Value prop strip */}
        <div style={{
          marginTop: "var(--space-8)", padding: "var(--space-4) var(--space-6)",
          background: "var(--royal-50)", borderRadius: 12,
          border: "1px solid var(--royal-100)",
          display: "flex", alignItems: "center", gap: "var(--space-4)",
          flexWrap: "wrap",
        }}>
          {[
            { icon: "✍", text: "編集部の取材記事が読める" },
            { icon: "💼", text: "求人票と企業情報を横断して比較" },
          ].map(({ icon, text }) => (
            <div key={text} style={{
              display: "flex", alignItems: "center", gap: "var(--space-2)",
              fontSize: 12, fontWeight: 600, color: "var(--royal)",
            }}>
              <span style={{ fontSize: "var(--text-md)" }}>{icon}</span>
              {text}
            </div>
          ))}
        </div>

        <style>{`
          .company-mini-card:hover {
            border-color: var(--royal-100) !important;
            box-shadow: 0 8px 24px rgba(0,35,102,0.08) !important;
            transform: translateY(-2px) !important;
          }
        `}</style>
      </div>
    </section>
  );
}

// ─── Logo Wall Section（#6）──────────────────────────────────────────────────

function LogoWallSection({ companies }: { companies: PreviewCompany[] }) {
  const wallData = companies.map((c) => ({
    id: c.id,
    name: c.name,
    logoUrl: c.logoUrl,
    letter: c.letter,
    gradient: c.gradient,
  }));
  return (
    <section style={{ background: "#fff", padding: "64px 48px", borderTop: "1px solid var(--line)" }} className="px-5 py-12 md:px-12">
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <SectionTag>掲載企業</SectionTag>
          <h2 style={{ fontSize: "clamp(22px,2.8vw,34px)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.3, marginBottom: 10 }}>
            編集部が取材・審査した企業だけ
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8 }}>
            外資IT・国内SaaS・スタートアップを中心に、OPINIOが直接取材した企業のみ掲載しています。
          </p>
        </div>
        <LogoWall companies={wallData} />
        {/* Value prop strip */}
        <div style={{
          marginTop: 28, padding: "14px 24px",
          background: "var(--royal-50)", borderRadius: 12,
          border: "1px solid var(--royal-100)",
          display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" as const,
          justifyContent: "center",
        }}>
          {[
            { icon: "✍", text: "編集部の取材記事が読める" },
            { icon: "💼", text: "求人票と企業情報を横断して比較" },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--royal)" }}>
              <span>{icon}</span>{text}
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/companies" style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, padding: "10px 24px", border: "1.5px solid var(--royal-100)", borderRadius: 8, background: "var(--royal-50)" }}>
            全企業を見る →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

type HowItWorksStep = { step: string; title: string; en: string; desc: string; action: string; href: string; iconBg: string; icon: React.ReactNode; };

function HowItWorks() {
  const STEPS: HowItWorksStep[] = [
    {
      step: "STEP 01", title: "企業の内側を知る", en: "Research",
      desc: "取材記事・求人票・組織情報が一か所に集約。メール登録のみで、IT/SaaS企業のリアルを自由に調べられます。",
      action: "→ 企業を見てみる",
      href: "/companies",
      iconBg: "linear-gradient(135deg, var(--royal), var(--accent))",
      icon: <SearchIcon />,
    },
    {
      step: "STEP 02", title: "気になる求人を比較する", en: "Compare",
      desc: "職種・年収・働き方で横断検索し、企業ごとに比べられる。取材記事と求人票を並べて、自分に合うかを確かめる。",
      action: "→ 求人を探す",
      href: "/jobs",
      iconBg: "linear-gradient(135deg, #475569, #1e293b)",
      icon: <BriefcaseIcon />,
    },
    {
      step: "STEP 03", title: "自分のペースで決める", en: "Decide",
      desc: "エージェントに急かされず、情報を集めてから動く。応募する・残る・もう少し考える、どの選択もあなたが主役。",
      action: "→ 求人を探す",
      href: "/jobs",
      iconBg: "linear-gradient(135deg, var(--success), #047857)",
      icon: <CheckMark />,
    },
  ];

  return (
    <section style={{ background: "var(--bg-tint)", padding: "72px 48px" }} className="px-5 py-14 md:py-20 md:px-12">
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <SectionTag>使い方</SectionTag>
          <h2 style={{ fontSize: "clamp(28px,3.5vw,42px)", fontWeight: 700, color: "var(--ink)", marginBottom: "var(--space-4)", letterSpacing: "-0.01em" }}>
            企業と、そこで働く人の情報を一か所で
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.9, color: "var(--ink-soft)", maxWidth: "var(--max-w-form)", margin: "0 auto" }}>
            取材記事・求人票を一か所に集約。<br />
            情報を集めてから、自分のペースで動ける。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_40px_1fr_40px_1fr] items-center">
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <div className="card-hover" style={{
                background: "#fff",
                border: "1px solid var(--line)",
                borderRadius: 16, padding: 28,
                cursor: "default",
                position: "relative", overflow: "hidden",
                boxShadow: "none",
              }}>
                {/* 背景ステップ数字 */}
                <div style={{
                  position: "absolute", top: -4, right: 12,
                  fontSize: 96, fontWeight: 900,
                  color: "var(--ink)",
                  opacity: 0.04,
                  fontFamily: "Inter, sans-serif",
                  lineHeight: 1,
                  userSelect: "none" as const,
                  pointerEvents: "none",
                }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", marginBottom: "var(--space-2)" }}>{s.step}</div>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", marginBottom: "var(--space-4)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  flexShrink: 0,
                }}>
                  <div style={{ transform: "scale(1.2)" }}>{s.icon}</div>
                </div>
                <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  {s.title} <span style={{ fontSize: "var(--text-sm)", fontWeight: 400, color: "var(--ink-mute)" }}>{s.en}</span>
                </div>
                <p style={{ fontSize: "var(--text-base)", lineHeight: 1.8, color: "var(--ink-soft)", marginBottom: "var(--space-3)" }}>{s.desc}</p>
                <Link href={s.href} style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                  {s.action}
                </Link>
              </div>
              {i < 2 && (
                <div className="hidden md:flex justify-center items-center" style={{ flexShrink: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "var(--royal-50)",
                    border: "1px solid var(--royal-100)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pain Points ──────────────────────────────────────────────────────────────

function PainPoints() {
  return (
    <section style={{ padding: "56px 48px 72px", background: "var(--bg-tint)" }} className="px-5 pt-10 pb-14 md:pt-14 md:pb-20 md:px-12">
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <SectionTag>よくある悩み</SectionTag>
          <h2 style={{ fontSize: "clamp(28px,3.5vw,42px)", fontWeight: 700, color: "var(--ink)", marginBottom: "var(--space-4)", letterSpacing: "-0.01em" }}>
            転職活動、こんな不便ありませんか？
          </h2>
          <p style={{ fontSize: "var(--text-md)", lineHeight: 1.9, color: "var(--ink-soft)", maxWidth: 600, margin: "0 auto" }}>
            求人情報の鮮度・検索性・企業情報の透明性──<br />
            キャリア判断の土台となる情報が整っていないことで、一歩踏み出しづらくなっている問題に向き合います。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PAIN_POINTS.map((p, i) => (
            <div key={i} style={{
              background: "#fff", borderRadius: 16,
              border: "1px solid var(--line)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              overflow: "hidden",
              transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
            }}
              className="pain-card"
            >
              {/* 問題部分 */}
              <div style={{ padding: "20px 22px 16px", borderTop: "3px solid #DC2626" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "var(--space-3)" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "#FEE2E2", color: "#DC2626",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, border: "1px solid #FECACA",
                  }}>
                    {p.icon}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", letterSpacing: "0.06em" }}>BEFORE</span>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 8, lineHeight: 1.5 }}>{p.q}</p>
                <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--ink-mute)" }}>{p.pain}</p>
              </div>
              {/* 解決部分 */}
              <div style={{
                background: "linear-gradient(to bottom, #ECFDF5, #F0FDF4)",
                borderTop: "2px solid var(--success)",
                padding: "14px 22px 18px",
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "var(--success)",
                  letterSpacing: "0.06em", marginBottom: 6,
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  AFTER · OPINIOなら
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.8, color: "#064E3B", fontWeight: 500 }}>{p.resolution}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: 48 }}>
          <Link href="/companies" style={{
            display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
            padding: "var(--space-4) 32px",
            background: "var(--ink)",
            color: "#fff", fontWeight: 700, fontSize: 15,
            borderRadius: 8, textDecoration: "none",
          }}>
            まず企業を見てみる <ArrowIcon />
          </Link>
          <p style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 10 }}>メール登録のみ · 完全無料</p>
        </div>
      </div>
      <style>{`
        .pain-card:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 8px 24px rgba(0,35,102,0.08) !important;
          transform: translateY(-2px) !important;
        }
      `}</style>
    </section>
  );
}

// ─── Mentor Preview ──────────────────────────────────────────────────────────

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCta({ companyNum }: { companyNum: string }) {
  return (
    <section style={{
      background: `linear-gradient(155deg, #002980 0%, #002366 45%, #1a3a8f 100%)`,
      padding: "96px 48px", textAlign: "center",
    }} className="px-5 py-16 md:py-24 md:px-12">
      <h2 style={{
        fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 700, color: "#fff",
        marginBottom: "var(--space-3)", fontFamily: 'var(--font-noto-serif)', lineHeight: 1.35,
      }}>
        深く知ってから、動く。<br />
        <span style={{ opacity: 0.8, fontSize: "0.65em", fontWeight: 500 }}>今のキャリアを変えなくてもいい。まず、知ることから始めよう。</span>
      </h2>
      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", marginBottom: 40, lineHeight: 1.8 }}>
        {companyNum}の企業情報・求人が、ひとつの場所に。<br />
        完全無料・メールアドレスのみで登録。
      </p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
        <Link href="/companies" style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "18px 56px",
          background: "#fff", color: "var(--ink)",
          fontWeight: 800, fontSize: 18, borderRadius: 10, textDecoration: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          letterSpacing: "-0.01em",
        }}>
          まず企業を見てみる <ArrowIcon />
        </Link>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: 0 }}>
          メールアドレスのみ · 全 {companyNum} 社の企業情報にアクセス
        </p>
        <Link href="/auth" style={{
          fontSize: 14, color: "rgba(255,255,255,0.7)", textDecoration: "none",
          display: "flex", alignItems: "center", gap: 4,
          padding: "8px 20px", border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: 8, background: "rgba(255,255,255,0.08)",
          fontWeight: 500,
        }}>
          → メールアドレスで無料登録（30秒）
        </Link>
      </div>
    </section>
  );
}

// ─── First-Visit Onboarding（初回1問3カード） ─────────────────────────────────

const FV_KEY = "opinio_ftv_done";

function FirstVisitOnboarding() {
  const router = useRouter();
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) { setShow(false); return; }
      setShow(!localStorage.getItem(FV_KEY));
    });
  }, []);

  const go = (href: string) => {
    localStorage.setItem(FV_KEY, "1");
    setShow(false);
    router.push(href);
  };

  const skip = () => {
    localStorage.setItem(FV_KEY, "1");
    setShow(false);
  };

  // null=判定中、false=非表示
  if (!show) return null;

  const cards: {
    icon: React.ReactNode;
    title: string;
    sub: string;
    href: string;
    color: string;
    accent: string;
    border: string;
  }[] = [
    {
      icon: <BuildingIcon />,
      title: "企業のリアルを知りたい",
      sub: "現役社員・OBの声、カジュアル面談",
      href: "/companies",
      color: "#002366",
      accent: "var(--royal-50)",
      border: "var(--royal-100)",
    },
    {
      icon: <BriefcaseIcon />,
      title: "自分に合う求人を探したい",
      sub: "職種・年収・働き方で絞り込む",
      href: "/jobs",
      color: "var(--ink-soft)",
      accent: "var(--line-soft)",
      border: "var(--line)",
    },
  ];

  return (
    <section style={{
      background: "#fff",
      borderBottom: "1px solid var(--line)",
      padding: "52px 48px 44px",
    }} className="px-5 md:px-12">
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}>
        {/* 見出し */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h2 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: "clamp(20px, 2.4vw, 28px)",
            fontWeight: 700,
            color: "var(--ink)",
            lineHeight: 1.4,
            margin: 0,
          }}>
            今日は、何から始めますか？
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8 }}>
            選んだページに移動します
          </p>
        </div>

        {/* 3カード */}
        <style>{`
          .ftv-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
          @media (max-width: 640px) { .ftv-grid { grid-template-columns: 1fr; } }
          .ftv-card { transition: transform 0.15s, box-shadow 0.15s; }
          .ftv-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
          .ftv-card:active { transform: translateY(-1px); }
        `}</style>
        <div className="ftv-grid">
          {cards.map((c) => (
            <button
              key={c.href}
              className="ftv-card"
              onClick={() => go(c.href)}
              style={{
                background: "#fff",
                border: `1.5px solid ${c.border}`,
                borderRadius: 16,
                padding: "28px 24px 24px",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                width: "100%",
              }}
            >
              {/* アイコン */}
              <div style={{
                width: 48, height: 48,
                borderRadius: 12,
                background: c.accent,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: c.color,
                flexShrink: 0,
              }}>
                {c.icon}
              </div>
              {/* テキスト */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>
                  {c.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 5, lineHeight: 1.6 }}>
                  {c.sub}
                </div>
              </div>
              {/* アクション */}
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 13, fontWeight: 600, color: c.color,
                marginTop: 4,
              }}>
                見てみる <ArrowIcon />
              </div>
            </button>
          ))}
        </div>

        {/* スキップ */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={skip}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: "var(--ink-mute)",
              padding: "6px 16px",
              textDecoration: "underline",
            }}
          >
            あとで
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Mobile non-auth sticky CTA ──────────────────────────────────────────────

function MobileAuthCTA() {
  const [show, setShow] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setAuthed(!!data.user);
    });

    const onScroll = () => {
      setShow(window.scrollY > 300);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 認証済み or スクロール前 or 判定中は非表示
  if (authed !== false || !show) return null;

  return (
    <div className="md:hidden" style={{
      position: "fixed",
      bottom: 64, // モバイルボトムナビの上
      left: 0, right: 0,
      zIndex: 90,
      padding: "10px 16px",
      background: "linear-gradient(135deg, #001233 0%, #002366 100%)",
      borderTop: "1px solid rgba(255,255,255,0.1)",
      display: "flex",
      alignItems: "center",
      gap: 10,
      boxShadow: "0 -4px 20px rgba(0,0,0,0.2)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>無料で始めてみませんか？</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>メール登録のみ · 営業電話なし</div>
      </div>
      <Link href="/auth" style={{
        padding: "9px 18px", borderRadius: 8, flexShrink: 0,
        background: "#fff",
        color: "var(--ink)", fontSize: 13, fontWeight: 700,
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}>
        無料登録 →
      </Link>
    </div>
  );
}

// ─── Social Proof Section ────────────────────────────────────────────────────

function _SocialProofSection() {
  const stories = [
    {
      quote: "Salesforceの先輩に相談して、入社前に組織文化を把握できました。入社後のギャップがほぼゼロでした。",
      name: "K.T. さん",
      role: "前職：SIer → Salesforce Japan / カスタマーサクセス",
      avatar: "K",
      gradient: "linear-gradient(135deg,#059669,#10B981)",
    },
    {
      quote: "エージェント経由だと「とりあえず応募して」と急かされたけど、OPINIOは自分のペースで情報収集できました。",
      name: "M.Y. さん",
      role: "前職：コンサル → SaaS企業 / プロダクトマネージャー",
      avatar: "M",
      gradient: "linear-gradient(135deg,#7C3AED,#8B5CF6)",
    },
    {
      quote: "OPINIOで取材記事を読んで解像度が上がり、カジュアル面談で背中を押してもらえました。納得感のある転職ができました。",
      name: "R.N. さん",
      role: "前職：営業 → LayerX / BizDev",
      avatar: "R",
      gradient: "linear-gradient(135deg,#D97706,#F59E0B)",
    },
  ];
  return (
    <section style={{ background: "#fff", padding: "72px 48px 80px", borderTop: "1px solid var(--line)" }} className="px-5 md:px-12">
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 16px", borderRadius: 100,
            background: "linear-gradient(135deg, #001233, #002366)",
            fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 16,
            letterSpacing: "0.06em",
          }}>
            ⭐ ユーザーの声
          </div>
          <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(20px,2.8vw,32px)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>
            OPINIOで、動き出した人たち。
          </h2>
          <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 8, opacity: 0.5 }}>※ 実際のご利用者の体験をもとに作成したイメージです</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }} className="grid grid-cols-1 md:grid-cols-3">
          {stories.map((s) => (
            <div key={s.name} style={{ background: "var(--bg-tint)", borderRadius: 16, padding: "24px", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 星5つ */}
              <div style={{ display: "flex", gap: 2 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} style={{ color: "#F59E0B", fontSize: 14 }}>★</span>
                ))}
              </div>
              <svg width="28" height="20" viewBox="0 0 28 20" fill="var(--royal-100)" aria-hidden><path d="M0 20V12.4C0 8.8 1.2 5.8 3.6 3.4 6 1 9.2 0 13.2 0v3.6c-2 0-3.6.7-4.8 2.2C7.2 7.2 6.6 9 6.6 11H11V20H0zm16 0V12.4c0-3.6 1.2-6.6 3.6-9C22 1 25.2 0 29.2 0v3.6c-2 0-3.6.7-4.8 2.2-1.2 1.4-1.8 3.2-1.8 5.2H27V20H16z"/></svg>
              <p style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.75, fontStyle: "italic", flex: 1, margin: 0 }}>{s.quote}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: s.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{s.avatar}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 1 }}>{s.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePageClient({
  initialCompanies = [],
  companyNum = "80社+",
  jobNum = "150件+",
  newJobsThisWeek = 0,
}: {
  initialCompanies?: PreviewCompany[];
  companyNum?: string;
  jobNum?: string;
  newJobsThisWeek?: number;
}) {
  return (
    <>
      <Hero companyNum={companyNum} jobNum={jobNum} newJobsThisWeek={newJobsThisWeek} />
      <FeaturedThreeCards />
      <JobTagSection />
      <FirstVisitOnboarding />
      <PainPoints />
      <LogoWallSection companies={initialCompanies} />
      <HowItWorks />
      {/* 実ユーザーの声が取れ次第、実引用に差し替え。現状は架空データのため非表示 */}
      {/* <SocialProofSection /> */}
      <HomeFaq />
      <FinalCta companyNum={companyNum} />
      <MobileAuthCTA />
    </>
  );
}
