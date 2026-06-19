"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import HomeFaq from "@/app/HomeFaq";
import { TYPE_BADGE, TYPE_EYECATCH_ICON } from "@/app/articles/mockArticleData";

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
    q: "求人票には書けない「本当の組織文化」が知りたい",
    pain: "公式情報だけでは、入社後のギャップが怖い。会社の内側がわからないまま応募するリスク。",
    resolution: "現役社員・OBへの取材レポートを各企業ページで公開。カジュアル面談で直接確かめることもできます。",
  },
  {
    icon: <PhoneOffIcon />,
    q: "エージェントに登録すると、営業電話が止まらない",
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

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ companyNum, jobNum }: { companyNum: string; jobNum: string }) {

  return (
    <section style={{
      background: `linear-gradient(155deg, #edf0fa 0%, #ece8ff 28%, #f6f0ff 55%, #fafafa 78%, #fff 100%)`,
      padding: "80px 48px 100px",
      overflow: "hidden",
      position: "relative",
    }} className="px-5 pt-16 pb-20 md:px-12 md:pt-20 md:pb-24">
      {/* Decorative orbs — soft on light bg */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: "-8%", top: "-15%", width: "45vw", height: "45vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(59,95,217,0.07) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", left: "-5%", bottom: "-10%", width: "32vw", height: "32vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)" }} />
      </div>
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto", position: "relative" }}
        className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16 items-center">

        {/* Left: message */}
        <div className="hero-fade">
          {/* Eyebrow */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "var(--space-2) var(--space-4)", background: "var(--royal-50)", color: "var(--royal)",
            borderRadius: 100, fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-6)",
            border: "1px solid var(--royal-100)",
            letterSpacing: "0.01em",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "var(--success)", flexShrink: 0,
              animation: "pulseDot 2.5s ease-in-out infinite",
            }} />
            外資系 IT・SaaS・スタートアップに特化
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: "clamp(28px,3.5vw,48px)",
            fontWeight: 700, lineHeight: 1.22, letterSpacing: "-0.03em",
            color: "var(--ink)", marginBottom: "var(--space-2)",
            fontFamily: 'var(--font-noto-serif)',
          }}>
            外資・SaaSの転職を、<br />
            <span style={{ color: "#D97706" }}>深く知って</span>から動く。
          </h1>

          {/* Lead */}
          <p style={{ fontSize: 16, lineHeight: 1.9, color: "var(--ink-soft)", marginBottom: 28, maxWidth: "var(--max-w-form)" }}>
            外資IT・国内SaaS・スタートアップへの転職情報が一か所に。<br />
            <strong style={{ color: "#D97706" }}>登録不要</strong>で閲覧でき、カジュアル面談で<strong style={{ color: "#D97706" }}>現役社員に直接</strong>話を聞けます。
          </p>

          {/* CTAs — primary only, secondary as text link */}
          <div style={{ marginBottom: 28 }}>
            <Link href="/companies" style={{
              display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
              padding: "16px 32px", background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", color: "#fff",
              fontWeight: 800, fontSize: 16, borderRadius: 10, textDecoration: "none",
              boxShadow: "0 6px 24px rgba(245,158,11,0.35)",
              letterSpacing: "-0.01em",
            }}>
              まず企業を見てみる <ArrowIcon />
            </Link>
            <div style={{ marginTop: 10 }}>
              <Link href="/auth" style={{
                fontSize: 12, color: "var(--ink-mute)", textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                → 無料会員登録はこちら（30秒）
              </Link>
            </div>
          </div>

          {/* ② Stats row */}
          <div style={{
            display: "flex", gap: 28, flexWrap: "wrap" as const,
            marginTop: 20, paddingTop: 18,
            borderTop: "1px solid rgba(0,35,102,0.08)",
          }}>
            {[
              { num: companyNum, label: "掲載企業" },
              { num: jobNum, label: "公開求人" },
              { num: "無料", label: "登録・閲覧" },
            ].map(({ num, label }) => (
              <div key={label} style={{ display: "flex", flexDirection: "column" as const, gap: 1 }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 22, fontWeight: 800, color: "var(--ink)", lineHeight: 1 }}>{num}</span>
                <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: feature highlights */}
        <div className="hidden md:flex justify-center hero-fade-right" style={{ position: "relative" }}>
          <div style={{
            background: "#fff", borderRadius: 20,
            boxShadow: "0 20px 60px rgba(0,35,102,0.10), 0 4px 16px rgba(15,23,42,0.06)",
            padding: "24px", width: "100%", maxWidth: 400,
            border: "1px solid var(--line)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>OPINIOでできること</div>

            {[
              {
                icon: "🏢", title: "企業の内側を知る",
                desc: "求人票には載らない組織文化・フェーズ感を取材レポートで確認。",
                href: "/companies", cta: "企業を見る →",
                bg: "var(--royal-50)", border: "var(--royal-100)",
              },
              {
                icon: "💼", title: "ポジションを深掘りする",
                desc: "職種・年収・働き方でフィルタリング。自分に合う求人を探せます。",
                href: "/jobs", cta: "求人を探す →",
                bg: "#FEF3C7", border: "#FDE68A",
              },
              {
                icon: "💬", title: "在籍ユーザーにDMで聞く",
                desc: "社員・OBのプロフィールから直接DM。求人票には載らないリアルな声を。",
                href: "/companies", cta: "企業の社員を見る →",
                bg: "var(--success-soft)", border: "#A7F3D0",
              },
            ].map((item) => (
              <Link key={item.title} href={item.href} style={{ textDecoration: "none", display: "block" }}>
                <div style={{
                  background: item.bg, borderRadius: 12, padding: "14px 16px",
                  border: `1px solid ${item.border}`, marginBottom: 10,
                  transition: "box-shadow 0.15s",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{item.title}</div>
                      <p style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 6px" }}>{item.desc}</p>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--royal)" }}>{item.cta}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            <p style={{ fontSize: 10, color: "var(--ink-mute)", textAlign: "center" as const, marginTop: 12 }}>
              すべて無料 · 登録不要で閲覧可 · 営業電話なし
            </p>
          </div>
        </div>
      </div>
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
  "上場": { bg: "#FEF3C7", color: "#D97706" },
  "グロース": { bg: "#FEF3C7", color: "#D97706" },
  "プライム": { bg: "#FEF3C7", color: "#B45309" },
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
              ? <img src={c.logoUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
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
              background: "var(--warm-soft)", color: "#92400E",
              border: "1px solid #FDE68A",
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

// ─── Trust Strip (social proof) ───────────────────────────────────────────────

function TrustStrip({ companyNum }: { companyNum: string }) {
  const STATS = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2} strokeLinecap="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
      num: companyNum,
      label: "IT/SaaS 企業掲載",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2} strokeLinecap="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      ),
      num: "編集部取材",
      label: "全企業を審査・取材済み",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      ),
      num: "完全無料",
      label: "閲覧・面談・登録すべて",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth={2} strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      ),
      num: "スカウト0",
      label: "営業電話・メール一切なし",
    },
  ];

  return (
    <section style={{
      background: "#fff",
      borderBottom: "1px solid var(--line)",
      padding: "0 48px",
    }} className="px-5 md:px-12">
      <div style={{
        maxWidth: 1080, margin: "0 auto",
        display: "flex", alignItems: "stretch",
        flexWrap: "wrap" as const,
      }}>
        {STATS.map(({ icon, num, label }, i) => (
          <div key={label} style={{
            display: "flex", alignItems: "center", gap: 12,
            flex: "1 1 160px", minWidth: 140,
            padding: "16px 0",
            borderRight: i < STATS.length - 1 ? "1px solid var(--line)" : "none",
            paddingLeft: i > 0 ? 20 : 0, paddingRight: i < STATS.length - 1 ? 20 : 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "var(--bg-tint)", border: "1px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", lineHeight: 1.2, fontFamily: "Inter, sans-serif" }}>{num}</div>
              <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturedCompaniesSection() {
  const [companies, setCompanies] = useState<PreviewCompany[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/companies/preview")
      .then((r) => r.json())
      .then((d) => { setCompanies(Array.isArray(d.companies) ? d.companies : []); })
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false));
  }, []);

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
              編集部が取材・審査した企業のみ掲載。現役社員やOBに直接聞くこともできます。
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

        {/* Insider value prop strip */}
        <div style={{
          marginTop: "var(--space-8)", padding: "var(--space-4) var(--space-6)",
          background: "var(--royal-50)", borderRadius: 12,
          border: "1px solid var(--royal-100)",
          display: "flex", alignItems: "center", gap: "var(--space-4)",
          flexWrap: "wrap",
        }}>
          {[
            { icon: "👥", text: "現役社員のリアルな声が聞ける" },
            { icon: "🎓", text: "OB・OGの転職経験談も" },
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

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const STEPS = [
    {
      step: "STEP 01", title: "登録なしで見る", en: "Browse",
      desc: "会員登録不要。企業の取材記事・求人情報を自由に閲覧できます。",
      action: "→ まず企業・求人を見てみる",
      href: "/companies",
      iconBg: "linear-gradient(135deg, var(--royal), var(--accent))",
      icon: <SearchIcon />,
    },
    {
      step: "STEP 02", title: "在籍者に直接DMする", en: "Connect",
      desc: "登録後、企業に在籍するユーザーにDMで直接コンタクト。エージェントを介さず、リアルな本音を聞けます。",
      action: "→ 企業の在籍者を見る",
      href: "/companies",
      iconBg: "linear-gradient(135deg, #F59E0B, #D97706)",
      icon: <ChatIcon />,
      highlight: true,
      badge: "OPINIOだけの強み",
    },
    {
      step: "STEP 03", title: "自分で決める", en: "Decide",
      desc: "応募する、今の会社に残る、もう少し考える。どの選択肢もあなたが主役です。",
      action: "→ 自分のペースで転職を判断",
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
            OPINIOの、使い方
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.9, color: "var(--ink-soft)", maxWidth: "var(--max-w-form)", margin: "0 auto" }}>
            企業を知って、現役社員に話を聞いて、自分で決める。<br />
            シンプルな3ステップで、納得のいくキャリア判断を。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_40px_1fr_40px_1fr] items-center">
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <div className="card-hover" style={{
                background: s.highlight ? "linear-gradient(135deg, #FEF9EC 0%, #fff 100%)" : "#fff",
                border: s.highlight ? "2px solid #D97706" : "1px solid var(--line)",
                borderRadius: 16, padding: 28,
                cursor: "default",
                position: "relative", overflow: "hidden",
                boxShadow: s.highlight ? "0 8px 32px rgba(245,158,11,0.12)" : "none",
              }}>
                {/* 背景ステップ数字 */}
                <div style={{
                  position: "absolute", top: -4, right: 12,
                  fontSize: 96, fontWeight: 900,
                  color: s.highlight ? "#D97706" : "var(--ink)",
                  opacity: 0.04,
                  fontFamily: "Inter, sans-serif",
                  lineHeight: 1,
                  userSelect: "none" as const,
                  pointerEvents: "none",
                }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.1em", color: s.highlight ? "#D97706" : "var(--royal)", marginBottom: "var(--space-2)" }}>{s.step}</div>
                {/* badge for highlight steps */}
                {"badge" in s && s.badge && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 100, marginBottom: 10,
                    background: "#FEF3C7", border: "1px solid #FDE68A",
                    fontSize: 10, fontWeight: 700, color: "#D97706",
                  }}>
                    ★ {s.badge}
                  </div>
                )}
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
            求人情報の鮮度・検索性・相談相手の有無──<br />
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
            background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
            color: "#fff", fontWeight: 700, fontSize: 15,
            borderRadius: 8, textDecoration: "none",
            boxShadow: "0 4px 20px rgba(245,158,11,0.25)",
          }}>
            企業情報・求人を見てみる <ArrowIcon />
          </Link>
          <p style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 10 }}>登録不要 · 完全無料</p>
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
          background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", color: "#fff",
          fontWeight: 800, fontSize: 18, borderRadius: 10, textDecoration: "none",
          boxShadow: "0 8px 32px rgba(245,158,11,0.50), 0 2px 8px rgba(0,0,0,0.12)",
          letterSpacing: "-0.01em",
        }}>
          まず企業を見てみる <ArrowIcon />
        </Link>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: 0 }}>
          登録不要 · 今すぐ全 {companyNum} の企業情報を見られます
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

// ─── Articles Preview ─────────────────────────────────────────────────────────

type PreviewArticle = {
  slug: string;
  type: string;
  title: string;
  eyecatch_gradient: string;
  read_min: number;
  date: string;
  company_name: string;
  company_initial: string;
  company_gradient: string;
};

// ─── Story Feed ───────────────────────────────────────────────────────────────

type PreviewStory = {
  id: string;
  companyId: string;
  companyName: string;
  companyLogoLetter: string | null;
  companyLogoGradient: string | null;
  companyLogoUrl: string | null;
  title: string;
  body: string;
  category: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
};

const STORY_CATEGORY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  "join_reason":    { label: "なぜ入社したか", color: "#1D4ED8", bg: "#EFF6FF" },
  "daily_work":     { label: "1日の仕事",      color: "#065F46", bg: "#ECFDF5" },
  "team_vibe":      { label: "チームの雰囲気",  color: "#6D28D9", bg: "#F3E8FF" },
  "failure_lesson": { label: "失敗から学んだ",  color: "#92400E", bg: "#FEF3C7" },
  "before_after":   { label: "転職前後の変化",  color: "#9D174D", bg: "#FCE7F3" },
  "culture":        { label: "カルチャー",      color: "#065F46", bg: "#ECFDF5" },
  "interview":      { label: "インタビュー",    color: "#1D4ED8", bg: "#EFF6FF" },
  "event":          { label: "イベント",        color: "#92400E", bg: "#FEF3C7" },
  "product":        { label: "プロダクト",      color: "#6D28D9", bg: "#F3E8FF" },
  "hiring":         { label: "採用情報",        color: "#065F46", bg: "#ECFDF5" },
  "other":          { label: "その他",          color: "#334155", bg: "#F1F5F9" },
};

function StoryCard({ story }: { story: PreviewStory }) {
  const cat = STORY_CATEGORY_LABELS[story.category] ?? STORY_CATEGORY_LABELS["other"];
  const bodyPreview = story.body.replace(/[#*>\-_]/g, "").slice(0, 80) + (story.body.length > 80 ? "…" : "");

  return (
    <Link href={`/companies/${story.companyId}#stories`} style={{ textDecoration: "none", display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 14,
          overflow: "hidden",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          transition: "box-shadow 0.2s, transform 0.2s, border-color 0.2s",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,35,102,0.12)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--royal-100)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          (e.currentTarget as HTMLDivElement).style.transform = "none";
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)";
        }}
      >
        {/* Cover image or gradient placeholder */}
        <div style={{
          height: 120,
          background: story.companyLogoGradient ?? "linear-gradient(135deg, #001233, var(--royal))",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
          position: "relative",
        }}>
          {story.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.coverImageUrl} alt={story.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif" }}>
              {story.companyLogoLetter ?? story.companyName[0]}
            </span>
          )}
          {/* Category badge */}
          <span style={{
            position: "absolute", top: 10, left: 10,
            padding: "3px 10px", borderRadius: 100,
            fontSize: "var(--text-xs)", fontWeight: 700,
            background: cat.bg, color: cat.color,
            backdropFilter: "blur(4px)",
          }}>
            {cat.label}
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: "14px var(--space-4) var(--space-4)", flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {/* Company */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 4, flexShrink: 0,
              background: story.companyLogoGradient ?? "linear-gradient(135deg, #001233, var(--royal))",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {story.companyLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={story.companyLogoUrl} alt={story.companyName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                  {story.companyLogoLetter ?? story.companyName[0]}
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 500 }}>{story.companyName}</span>
          </div>

          {/* Title */}
          <p style={{
            margin: 0, fontSize: "var(--text-base)", fontWeight: 700, color: "var(--ink)",
            lineHeight: 1.5, flex: 1,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
          }}>
            {story.title}
          </p>

          {/* Body preview */}
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
            {bodyPreview}
          </p>
        </div>
      </div>
    </Link>
  );
}

function StoryFeedSection() {
  const [stories, setStories] = useState<PreviewStory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/companies/stories")
      .then((r) => r.json())
      .then((d) => { setStories(Array.isArray(d.stories) ? d.stories : []); })
      .catch(() => { setStories([]); })
      .finally(() => setLoading(false));
  }, []);

  if (!loading && stories.length === 0) return null;

  return (
    <section style={{ padding: "64px 48px", background: "#fff" }} className="px-5 py-14 md:px-12">
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-8)" }}>
          <div>
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.12em", color: "var(--royal)", textTransform: "uppercase" as const, marginBottom: "var(--space-2)" }}>
              COMPANY STORIES
            </div>
            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--ink)", margin: 0, fontFamily: "var(--font-noto-serif)" }}>
              企業の「中の人」が語るストーリー
            </h2>
            <p style={{ fontSize: "var(--text-base)", color: "var(--ink-soft)", margin: "6px 0 0", lineHeight: 1.7 }}>
              なぜ入社したか、どんなチームか。社員の声をリアルに。
            </p>
          </div>
          <Link href="/companies" style={{ fontSize: "var(--text-sm)", color: "var(--royal)", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            企業一覧へ →
          </Link>
        </div>

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ height: 260, background: "var(--line)", borderRadius: 14, animation: "shimmer 1.5s infinite" }} />
              ))
            : stories.map((s) => <StoryCard key={s.id} story={s} />)
          }
        </div>
      </div>
    </section>
  );
}

function FeedUVP() {
  return (
    <section style={{ background: "linear-gradient(135deg, #f0fdf8 0%, #ecfdf5 50%, #f0f9ff 100%)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "64px 0" }}>
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }} className="grid grid-cols-1 md:grid-cols-2">
          {/* Left */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--success)", textTransform: "uppercase" as const, marginBottom: 10 }}>
              OPINIO FEED
            </div>
            <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px, 2.8vw, 30px)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.45, marginBottom: 14 }}>
              転職活動の「いま」を、<br />同じ業界の人とシェアする。
            </h2>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.85, marginBottom: 24 }}>
              選考状況・面接対策・業界の動き——OPINIOフィードは、外資・SaaS転職を目指すユーザー同士がリアルな声を共有できる場所です。DMで直接つながることもできます。
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {[
                { icon: "✍️", text: "転職中のリアルな体験を投稿・共有できる" },
                { icon: "💬", text: "気になる企業の在籍ユーザーにDMを送れる" },
                { icon: "🔔", text: "フォロー中の企業の新着情報が届く" },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--success-soft)", border: "1px solid #A7F3D0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{icon}</span>
                  <span style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 500 }}>{text}</span>
                </div>
              ))}
            </div>
            <Link href="/feed" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", borderRadius: 8, background: "var(--success)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 2px 10px rgba(5,150,105,0.3)" }}>
              フィードを見る →
            </Link>
          </div>

          {/* Right: mock feed cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { init: "田", grad: "linear-gradient(135deg, #002366, #3B5FD9)", name: "田中 翔太", role: "SaaS営業 → 転職活動中", text: "Salesforceの最終面接でした。外資のウォータースライド面接、想定より深掘りされた💦 内定出たらまたご報告します。", time: "3時間前", tags: ["Salesforce", "外資転職"] },
              { init: "K", grad: "linear-gradient(135deg, #7C3AED, #A78BFA)", name: "Kim Jihoon", role: "SRE at Startup", text: "HubSpotのSRE面接通過しました。インフラ経験をどう説明するか、ここ最近で一番練習したかも。", time: "昨日", tags: ["HubSpot", "エンジニア転職"] },
              { init: "山", grad: "linear-gradient(135deg, #059669, #34D399)", name: "山本 美月", role: "CS → BizDev を検討中", text: "Timeeのカジュアル面談でした。事業フェーズの話を直接聞けて解像度が上がりました🙌", time: "2日前", tags: ["Timee", "BizDev"] },
            ].map((post) => (
              <div key={post.name} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid var(--line)", boxShadow: "0 2px 8px rgba(15,23,42,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: post.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{post.init}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{post.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>{post.role} · {post.time}</div>
                  </div>
                </div>
                <p style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 8px" }}>{post.text}</p>
                <div style={{ display: "flex", gap: 4 }}>
                  {post.tags.map((t) => (
                    <span key={t} style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 7px", borderRadius: 100, background: "var(--success-soft)", color: "var(--success)", border: "1px solid #A7F3D0" }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ArticlesPreview() {
  const [articles, setArticles] = useState<PreviewArticle[] | null>(null);

  useEffect(() => {
    fetch("/api/articles/preview")
      .then((r) => r.json())
      .then((d) => { setArticles(Array.isArray(d.articles) ? d.articles : []); })
      .catch(() => { setArticles([]); });
  }, []);

  // fetch 完了前は非表示（レイアウトシフト防止）
  if (articles === null) return null;

  const latest = articles;
  return (
    <section style={{ background: "var(--bg-tint)", borderTop: "1px solid var(--line)", padding: "72px 0" }}>
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "var(--space-8)", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <div>
            <div style={{
              fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.12em",
              color: "var(--royal)", textTransform: "uppercase" as const, marginBottom: "var(--space-2)",
            }}>
              独自取材レポート
            </div>
            <h2 style={{
              fontFamily: 'var(--font-noto-serif)',
              fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 700,
              color: "var(--ink)", letterSpacing: "-0.01em", marginBottom: 8,
            }}>
              現役社員に会いに行く、<br />
              <span style={{ color: "var(--royal)" }}>OPINIO の取材記事。</span>
            </h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-mute)", lineHeight: 1.7 }}>
              CEO・社員・メンター・OGへの独自取材。求人票には載らない「中の声」を届けます。
            </p>
          </div>
          <Link href="/articles" style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "9px 18px", borderRadius: 8,
            border: "1.5px solid var(--royal)", color: "var(--royal)",
            fontSize: "var(--text-sm)", fontWeight: 600, textDecoration: "none",
            background: "#fff",
          }}>
            すべての記事 →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((article) => {
            type ArticleType = "employee" | "mentor" | "ceo" | "report";
            const type = article.type as ArticleType;
            const badge = TYPE_BADGE[type] ?? TYPE_BADGE["employee"];
            const _icon  = TYPE_EYECATCH_ICON[type] ?? TYPE_EYECATCH_ICON["employee"]; void _icon;
            return (
              <Link key={article.slug} href={`/articles/${article.slug}`} style={{ textDecoration: "none" }}>
                <article style={{
                  display: "flex", flexDirection: "column",
                  background: "#fff", border: "1px solid var(--line)",
                  borderRadius: 16, overflow: "hidden", height: "100%",
                  transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                }}
                  className="home-article-card"
                >
                  <div style={{
                    height: 160, background: article.eyecatch_gradient,
                    position: "relative", overflow: "hidden",
                    display: "flex", flexDirection: "column", justifyContent: "flex-end",
                    padding: "12px 14px",
                  }}>
                    {/* 背景大文字 */}
                    <div style={{
                      position: "absolute", top: -10, right: 10,
                      fontSize: 100, fontWeight: 900, lineHeight: 1,
                      color: "#fff", opacity: 0.1,
                      fontFamily: "Inter, sans-serif",
                      userSelect: "none",
                      pointerEvents: "none",
                    }}>
                      {article.company_initial}
                    </div>
                    {/* ⑧ Dark overlay for title readability */}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0, height: 90,
                      background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)",
                      pointerEvents: "none",
                    }} />
                    {/* バッジ */}
                    <div style={{
                      position: "absolute", top: 10, left: 12,
                      display: "inline-flex", alignItems: "center",
                      padding: "3px 9px", borderRadius: 100,
                      background: "rgba(255,255,255,0.85)",
                      backdropFilter: "blur(4px)",
                      color: badge.color,
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                    }}>
                      {badge.label}
                    </div>
                  </div>
                  <div style={{ padding: "14px var(--space-4) 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <h3 style={{
                      fontFamily: 'var(--font-noto-serif)',
                      fontSize: 13.5, fontWeight: 700, lineHeight: 1.6,
                      color: "var(--ink)", marginBottom: 10, flex: 1,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    } as React.CSSProperties}>
                      {article.title}
                    </h3>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 7,
                      paddingTop: 10, borderTop: "1px solid var(--line-soft, #F1F5F9)",
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 5,
                        background: article.company_gradient,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 7, fontWeight: 700, flexShrink: 0,
                      }}>
                        {article.company_initial}
                      </div>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)", flex: 1, fontWeight: 500 }}>
                        {article.company_name}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--ink-mute)" }}>
                        {(() => {
                          try {
                            return new Date(article.date).toLocaleDateString("ja-JP", { year: "numeric", month: "long" });
                          } catch {
                            return article.date.slice(2).replace(/-/g, "/");
                          }
                        })()}
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      </div>

      <style>{`
        .home-article-card:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 12px 32px rgba(15,23,42,0.07) !important;
          transform: translateY(-2px) !important;
        }
      `}</style>
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
        background: "linear-gradient(135deg, #F59E0B, #D97706)",
        color: "#fff", fontSize: 13, fontWeight: 700,
        textDecoration: "none",
        boxShadow: "0 2px 8px rgba(245,158,11,0.4)",
        whiteSpace: "nowrap",
      }}>
        無料登録 →
      </Link>
    </div>
  );
}

// ─── DM Experience Mock ───────────────────────────────────────────────────────

function DMExperienceMock() {
  const messages = [
    { from: "user", text: "Salesforceって、未経験の外資系でも最初から英語対応ですか？社内の雰囲気も知りたいです。", time: "14:32" },
    { from: "employee", name: "田村 美咲（CS 3年目）", avatar: "田", gradient: "linear-gradient(135deg,#002366,#3B5FD9)", text: "英語は部署によりますが、私のチームは会議の約7割が日本語です。最初の3ヶ月は日本語でOKと言われました！", time: "14:48" },
    { from: "user", text: "ありがとうございます！転職活動中なのですが、正直に言って残業はどうですか？", time: "14:51" },
    { from: "employee", name: "田村 美咲（CS 3年目）", avatar: "田", gradient: "linear-gradient(135deg,#002366,#3B5FD9)", text: "繁忙期は月20〜30時間ほどですが、フレックスで調整できるので働きやすいですよ。子育て中の方も多いです。", time: "15:03" },
  ];
  return (
    <section style={{ background: "var(--bg-tint)", padding: "72px 48px 80px" }} className="px-5 md:px-12">
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 14px", borderRadius: 100, background: "var(--royal-50)", border: "1px solid var(--royal-100)", fontSize: 11, fontWeight: 700, color: "var(--royal)", marginBottom: 16 }}>
            💬 DM機能
          </div>
          <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px,3vw,34px)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.3, marginBottom: 12 }}>
            在籍ユーザーに、<span style={{ color: "var(--royal)" }}>直接聞ける。</span>
          </h2>
          <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.75, maxWidth: 520, margin: "0 auto" }}>
            求人票には書けない「残業の実態」「英語環境」「社内文化」を、実際に働く人から聞けます。返信するかどうかは相手次第ですが、意外と丁寧に答えてくれます。
          </p>
          <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 8 }}>※ 下記の会話はイメージです</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "center" }} className="grid grid-cols-1 md:grid-cols-2">
          {/* Mock chat */}
          <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 8px 32px rgba(0,35,102,0.10)", border: "1px solid var(--line)", overflow: "hidden" }}>
            {/* Chat header */}
            <div style={{ background: "var(--royal)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#3B5FD9,#002366)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", border: "2px solid rgba(255,255,255,0.3)", flexShrink: 0 }}>田</div>
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>田村 美咲</div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Salesforce Japan · CS 3年目</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: 100 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80" }} />
                <span style={{ color: "#fff", fontSize: 10, fontWeight: 600 }}>DMを受付中</span>
              </div>
            </div>
            {/* Messages */}
            <div style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.from === "user" ? "flex-end" : "flex-start", gap: 3 }}>
                  {m.from === "employee" && (
                    <div style={{ fontSize: 10, color: "var(--ink-mute)", paddingLeft: 4 }}>{m.name}</div>
                  )}
                  <div style={{
                    maxWidth: "82%", padding: "9px 13px", borderRadius: m.from === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: m.from === "user" ? "var(--royal)" : "var(--line-soft)",
                    color: m.from === "user" ? "#fff" : "var(--ink)",
                    fontSize: 12, lineHeight: 1.65,
                  }}>
                    {m.text}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--ink-mute)", paddingRight: m.from === "user" ? 4 : 0, paddingLeft: m.from === "employee" ? 4 : 0 }}>{m.time}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Copy */}
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {[
                { icon: "🎯", title: "本当に知りたいことを聞ける", body: "「英語環境は実際どう？」「残業は？」「チームの雰囲気は？」—求人票に書けないことを直接質問できます。" },
                { icon: "🔓", title: "無料・登録するだけでOK", body: "メールアドレスだけで登録。スカウト電話・営業メールは一切ありません。" },
                { icon: "🤝", title: "返信は相手の判断に委ねる", body: "強制はしません。忙しい社員が自分のペースで答えてくれます。それが誠実な情報です。" },
              ].map(({ icon, title, body }) => (
                <div key={title} style={{ display: "flex", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>{body}</div>
                  </div>
                </div>
              ))}
              <Link href="/auth" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 10, background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 16px rgba(0,35,102,0.25)", alignSelf: "flex-start" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                無料登録してDMを送る
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Social Proof Section ────────────────────────────────────────────────────

function SocialProofSection() {
  const stories = [
    {
      quote: "Salesforceの在籍ユーザーに直接DMして、入社前に組織文化を把握できました。入社後のギャップがほぼゼロでした。",
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
      quote: "記事で取材されていた社員にDMしたら親切に答えてもらえて、その人がいる部署に転職できました。",
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
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 14px", borderRadius: 100, background: "#FEF3C7", border: "1px solid #FDE68A", fontSize: 11, fontWeight: 700, color: "#92400E", marginBottom: 16 }}>
            ⭐ ユーザーの声
          </div>
          <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(20px,2.8vw,32px)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>
            OPINIOで、動き出した人たち。
          </h2>
          <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 8 }}>※ 実際のご利用者の体験をもとに作成したイメージです</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }} className="grid grid-cols-1 md:grid-cols-3">
          {stories.map((s) => (
            <div key={s.name} style={{ background: "var(--bg-tint)", borderRadius: 16, padding: "24px", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 16 }}>
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

export default function HomePage() {
  const [stats, setStats] = useState<{ companies: number; jobs: number } | null>(null);
  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(setStats).catch(() => {});
  }, []);
  const companyNum = stats ? `${stats.companies}社+` : "80社+";
  const jobNum = stats ? `${stats.jobs}件+` : "252件+";

  return (
    <>
      <Hero companyNum={companyNum} jobNum={jobNum} />
      <TrustStrip companyNum={companyNum} />
      <HowItWorks />
      <FeaturedCompaniesSection />
      <DMExperienceMock />
      <PainPoints />
      <StoryFeedSection />
      <FeedUVP />
      <ArticlesPreview />
      <SocialProofSection />
      <HomeFaq />
      <FinalCta companyNum={companyNum} />
      <MobileAuthCTA />
    </>
  );
}
