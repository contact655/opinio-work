"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/common";
import HomeFaq from "@/app/HomeFaq";
import { TYPE_BADGE, TYPE_EYECATCH_ICON } from "@/app/articles/mockArticleData";
import { CountUp } from "@/components/jobseeker/CountUp";

// ─── Site stats type ─────────────────────────────────────────────────────────

type SiteStats = { companies: number; jobs: number; mentors: number };
const DEFAULT_STATS: SiteStats = { companies: 13, jobs: 0, mentors: 13 };

// ─── Mock data ────────────────────────────────────────────────────────────────

const _MENTORS = [
  {
    name: "田中 翔太",
    path: "元 Salesforce → スタートアップ CRO",
    tags: ["SaaS営業", "外資IT", "年収交渉"],
    msg: "SaaS営業への転職は、経験よりも思考力。面接で何を話すべきか、一緒に整理しましょう。",
    gradient: "royal" as const,
    sessionCount: 23,
  },
  {
    name: "佐藤 美咲",
    path: "元 HubSpot → SaaSスタートアップ CSM",
    tags: ["カスタマーサクセス", "キャリアチェンジ", "未経験転職"],
    msg: "未経験からCSに転職したい方の相談が得意。何から始めるべきか整理します。",
    gradient: "pink" as const,
    sessionCount: 17,
  },
  {
    name: "鈴木 健太",
    path: "元 Datadog → ITコンサル マネージャー",
    tags: ["外資IT", "フィールドセールス", "面接対策"],
    msg: "外資IT転職の面接対策・オファー交渉まで、実体験をもとにフィードバックします。",
    gradient: "green" as const,
    sessionCount: 31,
  },
];

const PAIN_POINTS = [
  {
    icon: <ClockIcon />,
    q: "情報が古い気がして、応募に踏み切れない",
    a: "求人票がいつ更新されたのか分からない。OPINIOでは編集部の取材と企業アンケートで情報を更新し続け、更新日も明示します。",
  },
  {
    icon: <SearchIcon />,
    q: "「フルリモートで副業OK」の条件が探しにくい",
    a: "働き方が多様化したのに、複数条件での検索が機能しない。OPINIOは働き方×勤務地×企業タイプの組み合わせで、抜け漏れなく探せる設計です。",
  },
  {
    icon: <ShieldIcon />,
    q: "どの求人サイトを見れば、抜け漏れないか分からない",
    a: "サービスによって掲載企業がバラバラ。OPINIOはIT/SaaS業界の求人を網羅的に集め、ここを見れば済む場所を目指します。",
  },
  {
    icon: <ChatIcon />,
    q: "求人票には書けない「本当の組織文化」が知りたい",
    a: "公式情報だけでは、入社後のギャップが怖い。OPINIO編集部が現場メンバーへ直接取材した、生の組織文化レポートを各企業ページで公開しています。",
  },
  {
    icon: <PhoneOffIcon />,
    q: "エージェントに登録すると、営業電話が止まらない",
    a: "登録したら電話・メールラッシュで、冷静に比較できない。OPINIOは電話一切なし、すべてオンラインで自分のペースで進められる設計です。",
  },
  {
    icon: <PersonIcon />,
    q: "キャリアを、誰に相談すればいいか分からない",
    a: "家族や社内の人には聞きづらい。数年先を歩く、似た経歴の先輩が、30分から気軽に話を聞いてくれます。営業される心配もありません。",
  },
];

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
      color: "var(--royal)", textTransform: "uppercase" as const, marginBottom: 16,
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
function ShieldIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}
function ChatIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
}
function PhoneOffIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
function PersonIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>;
}
function ArrowIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>;
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

type PreviewJob = {
  id: string;
  title: string;
  dept: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  workStyle: string | null;
  companyName: string;
  logoLetter: string;
  logoGradient: string;
  logoUrl: string | null;
};

function formatSalary(min: number | null, max: number | null): string | null {
  // DB は万円単位で格納（例: 500 = 500万円）
  const validMin = min && min > 0 ? min : null;
  const validMax = max && max > 0 ? max : null;
  if (!validMin && !validMax) return null;
  if (validMin && validMax) return `${validMin}〜${validMax}万`;
  if (validMin) return `${validMin}万〜`;
  return `〜${validMax}万`;
}

function Hero({ stats }: { stats: SiteStats }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<PreviewJob[]>([]);

  useEffect(() => {
    fetch("/api/jobs/preview")
      .then((r) => r.json())
      .then((d) => { setJobs(Array.isArray(d.jobs) ? d.jobs : []); })
      .catch(() => { setJobs([]); });
  }, []);

  return (
    <section style={{
      background: `linear-gradient(135deg, #001233 0%, #002366 55%, #1a3569 100%)`,
      padding: "80px 48px 100px",
      overflow: "hidden",
      position: "relative",
    }} className="px-5 pt-16 pb-20 md:px-12 md:pt-20 md:pb-24">
      {/* Decorative elements */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: "-10%", top: "-20%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(59,95,217,0.18) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", left: "-5%", bottom: "-10%", width: "35vw", height: "35vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)" }} />
      </div>
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto", position: "relative" }}
        className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16 items-center">

        {/* Left: message */}
        <div className="hero-fade">
          {/* Eyebrow */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "8px 16px", background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)",
            borderRadius: 100, fontSize: 13, fontWeight: 600, marginBottom: 32,
            border: "1px solid rgba(255,255,255,0.2)",
            letterSpacing: "0.01em",
            backdropFilter: "blur(8px)",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", flexShrink: 0,
              animation: "pulseDot 2.5s ease-in-out infinite",
            }} />
            IT / SaaS 業界に、特化している。
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: "clamp(28px,4.5vw,52px)",
            fontWeight: 500, lineHeight: 1.4, letterSpacing: "0.01em",
            color: "#fff", marginBottom: 24,
            fontFamily: 'var(--font-noto-serif)',
          }}>
            <span style={{ color: "#F59E0B" }}>IT/SaaS業界</span>の求人と企業を、<br />
            先輩と話しながら選ぶ。
          </h1>

          {/* Lead */}
          <p style={{ fontSize: 17, lineHeight: 1.9, color: "rgba(255,255,255,0.75)", marginBottom: 40, maxWidth: "var(--max-w-form)" }}>
            転職を検討していなくても、使えるキャリアサービスを目指しています。<br />
            企業の<strong style={{ color: "#F59E0B" }}>今</strong>を知り、現役先輩に<strong style={{ color: "#F59E0B" }}>相談</strong>し、自分のペースで選ぶ。
          </p>

          {/* CTAs */}
          <div style={{ marginBottom: 40 }}>
            {/* 主導線: 登録不要でまず見る */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const, marginBottom: 14 }}>
              <Link href="/companies" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "16px 28px", background: "#fff", color: "var(--royal)",
                fontWeight: 700, fontSize: 15, borderRadius: 8, textDecoration: "none",
                boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              }}>
                まず企業を見てみる <ArrowIcon />
              </Link>
              <Link href="/mentors" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "15px 24px",
                background: "rgba(255,255,255,0.12)",
                border: "1.5px solid rgba(255,255,255,0.35)",
                color: "#fff",
                fontWeight: 600, fontSize: 14, borderRadius: 8, textDecoration: "none",
                backdropFilter: "blur(6px)",
              }}>
                先輩に相談する（無料）
              </Link>
            </div>
            {/* 副導線: 登録 */}
            <Link href="/auth" style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none",
            }}>
              無料で会員登録する
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </Link>
          </div>

          {/* Trust */}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" as const, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
            {["完全無料", "営業電話なし", "登録はメールのみ"].map((t) => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                {t}
              </span>
            ))}
          </div>

          {/* Mobile-only key stats strip */}
          <div className="flex md:hidden" style={{
            marginTop: 28, gap: 0,
            background: "rgba(255,255,255,0.08)", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.15)", overflow: "hidden",
          }}>
            {[
              { value: String(stats.companies), unit: "社", label: "掲載企業" },
              { value: String(stats.jobs), unit: "件", label: "公開求人" },
              { value: String(stats.mentors), unit: "名", label: "相談できる先輩" },
            ].map((s, i) => (
              <div key={s.label} style={{
                flex: 1, textAlign: "center", padding: "14px 8px",
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.1)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "Inter, sans-serif", color: "#fff" }}>
                    {s.value}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B" }}>{s.unit}</span>
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Quick search bar */}
          <div style={{ marginTop: 32 }}>
            <form
              role="search"
              aria-label="求人・企業を検索"
              onSubmit={(e) => {
                e.preventDefault();
                const q = (e.currentTarget.querySelector('input') as HTMLInputElement).value.trim();
                if (q) router.push(`/jobs?q=${encodeURIComponent(q)}`);
                else router.push('/jobs');
              }}
              style={{
                display: "flex",
                background: "rgba(255,255,255,0.97)",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              }}
            >
              <input
                type="search"
                placeholder="職種・スキル・企業名で検索..."
                aria-label="職種・スキル・企業名で検索"
                style={{
                  flex: 1, padding: "14px 16px", fontSize: 14,
                  border: "none", outline: "none", color: "var(--ink)",
                  background: "transparent",
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "0 20px",
                  background: "var(--royal)", color: "#fff",
                  border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 6,
                  flexShrink: 0,
                }}
              >
                <SearchIcon />
                検索
              </button>
            </form>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              {["フルリモート", "カスタマーサクセス", "プロダクトマネージャー", "副業OK"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-label={`${tag}で検索`}
                  onClick={() => router.push(`/jobs?q=${encodeURIComponent(tag)}`)}
                  style={{
                    fontSize: 11, padding: "4px 12px", borderRadius: 100,
                    background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)",
                    border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: search mockup */}
        <div className="hidden md:flex justify-center hero-fade-right" style={{ position: "relative" }}>
          {/* Floating mentor bubble */}
          <div className="animate-floaty" style={{
            position: "absolute", bottom: -16, right: -8, zIndex: 10,
            background: "#fff", borderRadius: 14,
            boxShadow: "0 8px 24px rgba(0,35,102,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
            padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
            maxWidth: 240,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 14,
            }}>先</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>SaaS業界の先輩メンター</div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>30分・無料で相談できます</div>
            </div>
          </div>

          {/* Main search mockup card */}
          <div style={{
            background: "#fff", borderRadius: 20,
            boxShadow: "0 30px 60px rgba(0,35,102,0.12), 0 8px 24px rgba(15,23,42,0.06)",
            padding: 24, width: "100%", maxWidth: 400,
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 16, color: "var(--royal)" }}>OPINIO</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-soft)" }}>
                <span className="animate-blink-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} />
                最新情報
              </span>
            </div>

            {/* Search label */}
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
              ライフスタイルで絞り込む
            </div>

            {/* Search bar */}
            <div style={{
              border: "1.5px solid var(--royal)", borderRadius: 8, padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
            }}>
              <SearchIcon />
              <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>フルリモート・副業OKのSaaS企業</span>
            </div>

            {/* Result count */}
            {jobs.length > 0 && (
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontSize: 12, marginBottom: 12, color: "var(--ink-soft)",
              }}>
                <span><strong style={{ color: "var(--ink)", fontSize: 14 }}>{jobs.length}</strong> 件が該当</span>
                <span style={{ color: "var(--success)", fontSize: 11 }}>今日更新</span>
              </div>
            )}

            {/* Job list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {jobs.length === 0
                ? (
                    <div style={{
                      padding: "20px 16px", borderRadius: 12,
                      background: "var(--line-soft)", textAlign: "center",
                    }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🏗️</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
                        求人は近日公開予定です
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 12 }}>
                        企業担当者が準備中。まずは企業情報を見てみましょう。
                      </div>
                      <Link href="/companies" style={{
                        display: "inline-block", padding: "7px 16px",
                        borderRadius: 20, background: "var(--royal)", color: "#fff",
                        fontSize: 12, fontWeight: 600, textDecoration: "none",
                      }}>
                        企業を見てみる →
                      </Link>
                    </div>
                  )
                : jobs.map((job) => {
                    const salary = formatSalary(job.salaryMin, job.salaryMax);
                    return (
                      <div key={job.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", borderRadius: 8, background: "var(--line-soft)",
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: job.logoGradient,
                          color: "#fff", fontSize: 13, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, overflow: "hidden",
                        }}>
                          {job.logoUrl
                            ? <Image src={job.logoUrl} alt={job.companyName} width={36} height={36} style={{ objectFit: "contain" }} />
                            : job.logoLetter}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{job.companyName}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{job.title}</div>
                          <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                            {job.workStyle && (
                              <span style={{
                                fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
                                background: "var(--royal-50)", color: "var(--royal)",
                              }}>{job.workStyle}</span>
                            )}
                          </div>
                        </div>
                        {salary && (
                          <div style={{
                            fontSize: 13, fontWeight: 700,
                            color: "var(--success)", flexShrink: 0,
                            fontFamily: "Inter, sans-serif",
                          }}>{salary}</div>
                        )}
                      </div>
                    );
                  })
              }
            </div>

            {/* Footer note */}
            <div style={{
              marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)",
              fontSize: 11, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 6,
            }}>
              <ChatIcon />
              すべての求人に「OPINIO編集部の見解」付き
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Differentiator Strip ────────────────────────────────────────────────────

function DiffStrip() {
  const DIFFS: { icon: React.ReactNode; title: string; desc: string; color: string; bg: string }[] = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
      ),
      title: "スカウトなし",
      desc: "企業からの一方的な勧誘はありません。気になった企業に、自分のペースで接触できます。",
      color: "#DC2626",
      bg: "#FEF2F2",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
      title: "第三者メンターに相談",
      desc: "転職エージェントではなく、中立な立場の現役/元社員メンターに本音を聞けます。",
      color: "#7C3AED",
      bg: "#F5F3FF",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      title: "現役社員・OBの声",
      desc: "求人票の裏側にある「実際の働き方」「入社後のギャップ」を確認してから動けます。",
      color: "#059669",
      bg: "#ECFDF5",
    },
  ];

  return (
    <section style={{ background: "#fff", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}
          className="grid-cols-1 sm:grid-cols-3">
          {DIFFS.map((d, i) => (
            <div key={i}
              className="diff-strip-item"
              style={{
                display: "flex", alignItems: "flex-start", gap: 18,
                padding: "36px 28px",
                borderRight: i < 2 ? "1px solid var(--line)" : "none",
                transition: "background 0.2s",
              }}>
              <div
                className="diff-icon"
                style={{
                  width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                  background: d.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24,
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}>
                {d.icon}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", marginBottom: 8, letterSpacing: "-0.01em" }}>
                  {d.title}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.75, color: "var(--ink-soft)" }}>
                  {d.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .diff-strip-item:hover { background: var(--bg-tint); }
        .diff-strip-item:hover .diff-icon {
          transform: scale(1.1) translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.10);
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
  "シリーズA": { bg: "#EFF3FC", color: "#002366" },
  "シリーズB": { bg: "#F3E8FF", color: "#7C3AED" },
  "シリーズC": { bg: "#ECFDF5", color: "#059669" },
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
        gap: 12,
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
            padding: "3px 8px", borderRadius: 100,
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: c.gradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 16, fontWeight: 700,
            flexShrink: 0, overflow: "hidden",
          }}>
            {c.logoUrl
              ? <img src={c.logoUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : c.letter
            }
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: "var(--ink)",
              lineHeight: 1.3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {c.name}
            </div>
            {c.industry && (
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
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
          {/* OPINIO取材済みバッジ（記事が紐づいている場合） */}
          {(c.articleCount ?? 0) > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 100,
              background: "var(--warm-soft)", color: "#92400E",
              border: "1px solid #FDE68A",
              display: "flex", alignItems: "center", gap: 3,
              whiteSpace: "nowrap" as const,
            }}>
              ✍ 取材済み
            </span>
          )}
          {/* 登録メンバーバッジ */}
          {(c.memberCount ?? 0) > 0 ? (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 100,
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
          ) : (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 100,
              background: "var(--royal-50)", color: "var(--royal)",
              border: "1px solid var(--royal-100)",
              display: "flex", alignItems: "center", gap: 3,
              whiteSpace: "nowrap" as const,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              社員・OBに聞ける
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function CompanyMiniCardSkeleton() {
  return (
    <div style={{
      background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "20px 20px 18px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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

// ─── Logo Strip Section ───────────────────────────────────────────────────────

function LogoStripSection() {
  const [companies, setCompanies] = useState<PreviewCompany[]>([]);

  useEffect(() => {
    fetch("/api/companies/preview")
      .then((r) => r.json())
      .then((d) => { setCompanies(Array.isArray(d.companies) ? d.companies : []); })
      .catch(() => setCompanies([]));
  }, []);

  if (companies.length === 0) return null;

  return (
    <section style={{
      background: "#fff",
      borderBottom: "1px solid var(--line)",
      padding: "16px 0",
      overflow: "hidden",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }} className="px-5 md:px-12">
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
          color: "var(--ink-mute)", textTransform: "uppercase" as const,
          marginBottom: 12, display: "flex", alignItems: "center", gap: 8,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          編集部が取材・審査した掲載企業
        </div>
      </div>

      {/* Auto-scrolling marquee */}
      <div style={{ overflow: "hidden", position: "relative" }}>
        {/* Fade edges */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 72,
          background: "linear-gradient(to right, #fff 0%, transparent 100%)",
          zIndex: 2, pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 72,
          background: "linear-gradient(to left, #fff 0%, transparent 100%)",
          zIndex: 2, pointerEvents: "none",
        }} />

        <div
          className="logo-marquee-track"
          style={{ display: "flex", gap: 12, width: "max-content", paddingLeft: 24 }}
        >
          {/* Duplicate for seamless loop */}
          {[...companies, ...companies].map((c, i) => (
            <Link
              key={i}
              href={`/companies/${c.id}`}
              style={{
                flexShrink: 0,
                width: 72,
                height: 44,
                borderRadius: 10,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: c.logoUrl ? "#f5f7fa" : c.gradient,
                border: "1px solid var(--line)",
                textDecoration: "none",
                transition: "opacity 0.15s, transform 0.15s",
              }}
              title={c.name}
            >
              {c.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.logoUrl}
                  alt={c.name}
                  style={{ width: "80%", height: "80%", objectFit: "contain" }}
                />
              ) : (
                <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
                  {c.letter}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .logo-marquee-track {
          animation: logoMarquee 30s linear infinite;
        }
        .logo-marquee-track:hover {
          animation-play-state: paused;
        }
        @keyframes logoMarquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .logo-marquee-track { animation: none; overflow-x: auto; }
        }
      `}</style>
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
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
              color: "var(--royal)", textTransform: "uppercase" as const, marginBottom: 8,
            }}>
              COMPANIES
            </div>
            <h2 style={{
              fontSize: "clamp(20px,2.5vw,28px)", fontWeight: 700, color: "var(--ink)",
              lineHeight: 1.35, margin: 0,
              fontFamily: "var(--font-noto-serif)",
            }}>
              IT/SaaS業界を代表する企業が集まっています
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.7 }}>
              編集部が取材・審査した企業のみ掲載。現役社員やOBに直接聞くこともできます。
            </p>
          </div>
          <Link href="/companies" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
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

        {/* Bottom CTA bar */}
        {!loading && companies.length > 6 && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Link href="/companies" style={{
              fontSize: 13, color: "var(--ink-mute)", textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              他 {companies.length - 6} 社を見る →
            </Link>
          </div>
        )}

        {/* Insider value prop strip */}
        <div style={{
          marginTop: 32, padding: "16px 24px",
          background: "var(--royal-50)", borderRadius: 12,
          border: "1px solid var(--royal-100)",
          display: "flex", alignItems: "center", gap: 16,
          flexWrap: "wrap",
        }}>
          {[
            { icon: "👥", text: "現役社員のリアルな声が聞ける" },
            { icon: "🎓", text: "OB・OGの転職経験談も" },
            { icon: "🌟", text: "第三者メンターにも相談できる" },
          ].map(({ icon, text }) => (
            <div key={text} style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 12, fontWeight: 600, color: "var(--royal)",
            }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              {text}
            </div>
          ))}
          <Link href="/mentors" style={{
            marginLeft: "auto", fontSize: 11, fontWeight: 700,
            color: "var(--royal)", textDecoration: "none",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            メンターを探す →
          </Link>
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

// ─── Stats Strip ──────────────────────────────────────────────────────────────

function StatsStrip({ stats }: { stats: SiteStats }) {
  const STATS = [
    { value: String(stats.companies), unit: "社", label: "掲載企業" },
    { value: String(stats.jobs), unit: "件", label: "公開求人" },
    { value: String(stats.mentors), unit: "名", label: "相談できるメンター" },
    { value: "30", unit: "分", label: "初回相談・完全無料" },
  ];
  return (
    <section style={{
      background: "var(--royal)",
      padding: "36px 48px",
    }} className="px-5 md:px-12">
      <div style={{
        maxWidth: 900, margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "28px 0",
      }} className="sm:[grid-template-columns:repeat(4,1fr)]">
        {STATS.map(({ value, unit, label }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{
              display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2,
              marginBottom: 6,
            }}>
              <span style={{
                fontSize: "clamp(36px,5vw,52px)", fontWeight: 700,
                fontFamily: "Inter, sans-serif", color: "#fff",
                lineHeight: 1,
              }}>
                <CountUp to={parseInt(value, 10)} />
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{unit}</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: 500, letterSpacing: "0.04em" }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Infrastructure Section (simplified) ─────────────────────────────────────

function InfraSection() {
  const points = [
    {
      num: "01",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      ),
      title: "取材された「今」の情報",
      body: "OPINIO編集部が企業を定期取材。求人票には載らない、現場のリアルな情報をお届けします。",
      color: "var(--royal)",
      bg: "var(--royal-50)",
    },
    {
      num: "02",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
      title: "第三者の先輩に相談できる",
      body: "転職エージェントではなく、中立な現役社員・OBOGメンターに本音を聞けます。完全無料・30分。",
      color: "var(--warm)",
      bg: "var(--warm-soft)",
    },
    {
      num: "03",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
        </svg>
      ),
      title: "現役社員・OBOGが見える",
      body: "企業ページには実際にその会社で働く人・働いた人のプロフィールが掲載。入社後のイメージが描けます。",
      color: "var(--success)",
      bg: "var(--success-soft)",
    },
  ];

  return (
    <section style={{ padding: "80px 48px" }} className="px-5 md:px-12">
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <SectionTag>WHAT MAKES OPINIO DIFFERENT</SectionTag>
          <h2 style={{ fontSize: "clamp(24px,3vw,34px)", fontWeight: 700, color: "var(--ink)", marginTop: 16, marginBottom: 12 }}>
            他のキャリアサービスと、ここが違う。
          </h2>
          <p style={{ fontSize: 16, color: "var(--ink-soft)", lineHeight: 1.8 }}>
            求人の鮮度、第三者への相談、現役社員の声。3つを1つにまとめました。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {points.map((p) => (
            <div key={p.num} style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 20,
              padding: "32px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: p.bg,
                color: p.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {p.icon}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: p.color, letterSpacing: "0.08em", marginBottom: 6 }}>
                  {p.num}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", marginBottom: 10, lineHeight: 1.4 }}>
                  {p.title}
                </h3>
                <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8 }}>
                  {p.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const STEPS = [
    {
      step: "STEP 01", title: "登録なしで見る", en: "Browse",
      desc: "会員登録不要。企業の取材記事・求人・先輩プロフィールを自由に閲覧できます。",
      action: "→ まず企業・求人を見てみる",
      href: "/companies",
      iconBg: "linear-gradient(135deg, var(--royal), var(--accent))",
      icon: <SearchIcon />,
    },
    {
      step: "STEP 02", title: "先輩に相談する", en: "Talk",
      desc: "気になった会社のことを、似た経歴の先輩に30分オンラインで気軽に聞けます。完全無料。",
      action: "→ 先輩を探す",
      href: "/mentors",
      iconBg: "linear-gradient(135deg, #F59E0B, #D97706)",
      icon: <ChatIcon />,
      highlight: true,
    },
    {
      step: "STEP 03", title: "自分で決める", en: "Decide",
      desc: "応募する、今の会社に残る、もう少し考える。どの選択肢もあなたが主役です。",
      action: "→ 自分のペースで転職を判断",
      href: "/jobs",
      iconBg: "linear-gradient(135deg, #059669, #047857)",
      icon: <CheckMark />,
    },
  ];

  return (
    <section style={{ background: "var(--bg-tint)", padding: "96px 48px" }} className="px-5 py-16 md:py-24 md:px-12">
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <SectionTag>HOW IT WORKS</SectionTag>
          <h2 style={{ fontSize: "clamp(26px,3vw,36px)", fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>
            OPINIOの、使い方
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.9, color: "var(--ink-soft)", maxWidth: "var(--max-w-form)", margin: "0 auto" }}>
            情報を集めて、先輩に相談して、自分で決める。<br />
            シンプルな3ステップで、納得のいくキャリア判断を。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_40px_1fr_40px_1fr] items-center">
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <div style={{
                background: s.highlight ? "linear-gradient(135deg, var(--royal-50) 0%, #fff 100%)" : "#fff",
                border: `1px solid ${s.highlight ? "var(--royal-100)" : "var(--line)"}`,
                borderRadius: 16, padding: 28,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", marginBottom: 12 }}>{s.step}</div>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", marginBottom: 16,
                }}>
                  {s.icon}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  {s.title} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--ink-mute)" }}>{s.en}</span>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink-soft)", marginBottom: 12 }}>{s.desc}</p>
                <Link href={s.href} style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                  {s.action}
                </Link>
              </div>
              {i < 2 && (
                <div className="hidden md:flex justify-center" style={{ fontSize: 24, color: "var(--line)", fontWeight: 300 }}>→</div>
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
    <section style={{ padding: "96px 48px" }} className="px-5 py-16 md:py-24 md:px-12">
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <SectionTag>PAIN POINTS</SectionTag>
          <h2 style={{ fontSize: "clamp(26px,3vw,36px)", fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>
            転職活動、こんな不便ありませんか？
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.9, color: "var(--ink-soft)", maxWidth: 600, margin: "0 auto" }}>
            求人情報の鮮度・検索性・相談相手の有無──<br />
            キャリア判断の土台となる情報が整っていないことで、一歩踏み出しづらくなっている問題に向き合います。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PAIN_POINTS.map((p, i) => (
            <div key={i} style={{
              background: "#fff", borderRadius: 16, padding: 24,
              border: "1px solid var(--line)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
            }}
              className="pain-card"
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "var(--royal-50)", color: "var(--royal)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 16,
              }}>
                {p.icon}
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 10, lineHeight: 1.5 }}>{p.q}</p>
              <p style={{ fontSize: 13, lineHeight: 1.9, color: "var(--ink-soft)" }}>{p.a}</p>
            </div>
          ))}
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

// ─── Use Cases ────────────────────────────────────────────────────────────────
// 架空の声ではなく、編集部が想定するリアルな使い方シナリオを正直に提示する

const USE_CASES = [
  {
    persona: "転職を迷っている",
    detail: "SaaS営業 · 3〜5年目",
    scene: "「今すぐ転職したいわけじゃないけど、このままでいいのか不安」",
    how: "企業の取材記事で文化を把握 → 似たキャリアの先輩に30分相談 → 応募するかどうかは自分で判断",
    outcome: "焦らず、比較しながら、納得して動ける",
    tag: "キャリア探索",
    tagColor: "var(--royal)",
    tagBg: "var(--royal-50)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
    gradient: "linear-gradient(135deg, var(--royal), var(--accent))",
    href: "/companies",
    cta: "企業を探す →",
  },
  {
    persona: "転職活動を本格化したい",
    detail: "PdM / エンジニア · 実績あり",
    scene: "「スカウトも来てるけど、自分から動くならOPINIOの企業が気になる」",
    how: "求人を条件で絞り込み → 気になる企業の現役社員・OBに相談 → カジュアル面談で雰囲気を確認",
    outcome: "入社後ギャップを減らして、ミスマッチのない転職を",
    tag: "転職活動",
    tagColor: "var(--success)",
    tagBg: "var(--success-soft)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
    gradient: "linear-gradient(135deg, #059669, #34D399)",
    href: "/jobs",
    cta: "求人を見る →",
  },
  {
    persona: "転職はまだ先だけど準備したい",
    detail: "現職満足中 · 情報収集フェーズ",
    scene: "「今の会社は好きだけど、3年後どうなるかは不安。業界の感覚を磨きたい」",
    how: "取材記事で業界トレンドをキャッチ → メンターに「今の選択は正しいか」を相談 → 登録なしで閲覧できる",
    outcome: "転職せずに終わってもOK。視野が広がるだけで価値がある",
    tag: "情報収集",
    tagColor: "#d97706",
    tagBg: "var(--warm-soft)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
    gradient: "linear-gradient(135deg, #F59E0B, #D97706)",
    href: "/mentors",
    cta: "先輩を探す →",
  },
];

function UserTestimonials() {
  return (
    <section style={{ background: "#fff", padding: "96px 48px", borderTop: "1px solid var(--line)" }} className="px-5 py-16 md:py-24 md:px-12">
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <SectionTag>USE CASES</SectionTag>
          <h2 style={{
            fontSize: "clamp(24px,3vw,34px)", fontWeight: 700,
            color: "var(--ink)", marginBottom: 12,
            fontFamily: "var(--font-noto-serif)",
          }}>
            こんな人が使っています
          </h2>
          <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.8 }}>
            転職を決意していなくても、使えるキャリアサービスを目指しています。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {USE_CASES.map((c, i) => (
            <div
              key={i}
              style={{
                background: "var(--bg-tint)",
                border: "1px solid var(--line)",
                borderRadius: 20,
                padding: "26px 24px 22px",
                display: "flex", flexDirection: "column",
                transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
              }}
              className="usecase-card"
            >
              {/* アイコン + タグ */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: c.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", flexShrink: 0,
                }}>
                  {c.icon}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 10px",
                  borderRadius: 100, background: c.tagBg, color: c.tagColor,
                  letterSpacing: "0.04em", border: `1px solid ${c.tagColor}33`,
                }}>
                  {c.tag}
                </span>
              </div>

              {/* ペルソナ */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{c.persona}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{c.detail}</div>
              </div>

              {/* 心の声 */}
              <p style={{
                fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)",
                marginBottom: 14, fontStyle: "italic",
                borderLeft: "3px solid var(--line)", paddingLeft: 10,
              }}>
                {c.scene}
              </p>

              {/* 使い方 */}
              <p style={{
                fontSize: 12, lineHeight: 1.8, color: "var(--ink-soft)",
                marginBottom: 16, flex: 1,
              }}>
                {c.how}
              </p>

              {/* アウトカム */}
              <div style={{
                padding: "10px 12px",
                borderRadius: 8, marginBottom: 16,
                background: "#fff", border: "1px solid var(--line)",
                fontSize: 12, fontWeight: 600, color: "var(--ink)",
                display: "flex", alignItems: "flex-start", gap: 6,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                {c.outcome}
              </div>

              {/* CTA */}
              <Link href={c.href} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 12, fontWeight: 700, color: c.tagColor,
                textDecoration: "none",
              }}>
                {c.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .usecase-card:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 8px 24px rgba(0,35,102,0.08) !important;
          transform: translateY(-2px) !important;
        }
      `}</style>
    </section>
  );
}

// ─── Mentors Section ──────────────────────────────────────────────────────────

type PreviewMentor = {
  id: string;
  name: string;
  initial: string;
  gradient: string;
  photoUrl: string | null;
  currentCompany: string;
  currentRole: string;
  path: string;
  tags: string[];
  roles: string[];
  catchphrase: string | null;
  successCount: number;
  isAvailable: boolean;
};

function MentorCardSkeleton() {
  return (
    <div style={{
      background: "#fff", borderRadius: 20, padding: 28,
      border: "1px solid var(--line)", boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
        <div className="skeleton-shimmer" style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton-shimmer" style={{ height: 14, width: "55%", marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 11, width: "80%" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[60, 80, 70].map((w, i) => (
          <div key={i} className="skeleton-shimmer" style={{ height: 22, width: w, borderRadius: 100 }} />
        ))}
      </div>
      <div className="skeleton-shimmer" style={{ height: 11, width: "100%", marginBottom: 6 }} />
      <div className="skeleton-shimmer" style={{ height: 11, width: "75%", marginBottom: 20 }} />
      <div className="skeleton-shimmer" style={{ height: 38, width: "100%", borderRadius: 8 }} />
    </div>
  );
}

function MentorsSection() {
  const [mentors, setMentors] = useState<PreviewMentor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mentors/preview")
      .then((r) => r.json())
      .then((d) => { setMentors(Array.isArray(d.mentors) ? d.mentors : []); })
      .catch(() => { setMentors([]); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section style={{ background: "var(--bg-tint)", padding: "96px 48px" }} className="px-5 py-16 md:py-24 md:px-12">
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <SectionTag>MENTORS</SectionTag>
          <h2 style={{ fontSize: "clamp(26px,3vw,36px)", fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>
            業界の先輩が、フィードバックします
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.9, color: "var(--ink-soft)" }}>
            IT/SaaS企業で実際に働いた経験のある、数年先を歩く先輩が、<br />
            あなたの相談にカジュアルに乗ります。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <MentorCardSkeleton key={i} />)
            : mentors.map((m) => (
            <div key={m.id} style={{
              background: "#fff", borderRadius: 20, padding: 28,
              border: "1px solid var(--line)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
              display: "flex", flexDirection: "column",
            }}
              className="mentor-card"
            >
              {/* ヘッダー：アバター + 受付中バッジ */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center", flex: 1, minWidth: 0 }}>
                  {/* 写真 or グラデーションアバター */}
                  {m.photoUrl ? (
                    <img
                      src={m.photoUrl}
                      alt={m.name}
                      width={52}
                      height={52}
                      style={{
                        width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                        objectFit: "cover", objectPosition: "center top",
                        boxShadow: "0 0 0 2px var(--royal-100)",
                      }}
                    />
                  ) : (
                    <Avatar name={m.name} size="lg" gradient={m.gradient} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2, lineHeight: 1.5 }}>{m.path || m.currentRole}</div>
                  </div>
                </div>
                {m.isAvailable && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                    padding: "4px 10px", borderRadius: 100,
                    background: "#ECFDF5", border: "1px solid #A7F3D0",
                    fontSize: 10, fontWeight: 700, color: "var(--success)", marginLeft: 8,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: "var(--success)", flexShrink: 0,
                      animation: "pulse-dot 2s ease-in-out infinite",
                    }} />
                    受付中
                  </div>
                )}
              </div>

              {/* テーマタグ */}
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 16 }}>
                {m.tags.map((t) => (
                  <span key={t} style={{
                    display: "inline-block", padding: "3px 10px", borderRadius: 100,
                    fontSize: 11, fontWeight: 600,
                    background: "var(--royal-50)", color: "var(--royal)",
                    border: "1px solid var(--royal-100)",
                  }}>{t}</span>
                ))}
              </div>

              {/* 所属 */}
              {m.currentCompany && (
                <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14, lineHeight: 1.6 }}>
                  <span style={{ color: "var(--ink-mute)" }}>現在：</span>{m.currentCompany}
                  {m.currentRole && <span style={{ color: "var(--ink-mute)" }}> / {m.currentRole}</span>}
                </p>
              )}

              {/* 相談件数 + 無料バッジ */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, marginTop: "auto" }}>
                <div style={{ fontSize: 13, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  相談件数 <span style={{ fontWeight: 700, color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{m.successCount}</span> 件
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--success)", fontWeight: 600 }}>
                  <CheckMark /> 無料
                </div>
              </div>

              {/* デュアルCTA: 相談する（予約）+ プロフィールを見る */}
              <div style={{ display: "flex", gap: 8 }}>
                <Link
                  href={`/mentors/${m.id}/reserve`}
                  style={{
                    flex: 1, display: "block", padding: "11px 0", borderRadius: 8,
                    fontSize: 13, fontWeight: 700,
                    background: "linear-gradient(135deg, #F59E0B, #D97706)",
                    color: "#fff", textAlign: "center",
                    boxShadow: "0 3px 10px rgba(245,158,11,0.3)",
                    textDecoration: "none",
                  }}
                >
                  相談する（無料）
                </Link>
                <Link
                  href={`/mentors/${m.id}`}
                  style={{
                    flex: 1, display: "block", padding: "11px 0", borderRadius: 8,
                    fontSize: 13, fontWeight: 600,
                    background: "transparent",
                    color: "var(--ink-soft)", textAlign: "center",
                    textDecoration: "none",
                    border: "1px solid var(--line)",
                    whiteSpace: "nowrap",
                  }}
                >
                  詳しく見る →
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 40 }}>
          <Link href="/mentors" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "14px 28px", borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: "#fff", color: "var(--royal)",
            border: "1.5px solid var(--royal)", textDecoration: "none",
          }}>
            先輩一覧を見る →
          </Link>
        </div>
      </div>
      <style>{`
        .mentor-card:hover {
          border-color: #FDE68A !important;
          box-shadow: 0 12px 32px rgba(245,158,11,0.12) !important;
          transform: translateY(-3px) !important;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.75); }
        }
      `}</style>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCta({ mentorCount }: { mentorCount: number }) {
  const MENTOR_AVATARS = [
    { initial: "田", gradient: "linear-gradient(135deg, #002366, #3B5FD9)" },
    { initial: "佐", gradient: "linear-gradient(135deg, #7C3AED, #A78BFA)" },
    { initial: "鈴", gradient: "linear-gradient(135deg, #059669, #34D399)" },
    { initial: "山", gradient: "linear-gradient(135deg, #D97706, #FBBF24)" },
    { initial: "伊", gradient: "linear-gradient(135deg, #DC2626, #F87171)" },
  ];

  return (
    <section style={{
      background: `linear-gradient(135deg, #001233 0%, var(--royal) 60%, var(--accent) 100%)`,
      padding: "96px 48px", textAlign: "center",
    }} className="px-5 py-16 md:py-24 md:px-12">
      {/* Mentor avatar row + social proof */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
        <div style={{ display: "flex", marginBottom: 12 }}>
          {MENTOR_AVATARS.map((m, i) => (
            <div key={i} style={{
              width: 44, height: 44, borderRadius: "50%",
              background: m.gradient,
              border: "3px solid rgba(255,255,255,0.9)",
              marginLeft: i === 0 ? 0 : -12,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 15, fontWeight: 700,
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              zIndex: MENTOR_AVATARS.length - i,
              position: "relative",
            }}>
              {m.initial}
            </div>
          ))}
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 14px", borderRadius: 100,
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.2)",
          fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", flexShrink: 0 }} />
          {mentorCount}名のメンターが相談を受け付け中
        </div>
      </div>

      <h2 style={{
        fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 700, color: "#fff",
        marginBottom: 12, fontFamily: 'var(--font-noto-serif)', lineHeight: 1.35,
      }}>
        今のキャリアを変えなくてもいい。<br />
        <span style={{ opacity: 0.85, fontSize: "0.75em" }}>ただ、知ることから始めよう。</span>
      </h2>
      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", marginBottom: 40, lineHeight: 1.8 }}>
        IT/SaaS業界の企業情報・求人・先輩メンターが、ひとつの場所に。<br />
        完全無料・メールアドレスのみで登録。
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" as const }}>
        <Link href="/auth" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "16px 32px", background: "#fff", color: "var(--royal)",
          fontWeight: 700, fontSize: 15, borderRadius: 8, textDecoration: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        }}>
          無料登録する <ArrowIcon />
        </Link>
        <Link href="/mentors" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "16px 32px", background: "transparent", color: "#fff",
          fontWeight: 600, fontSize: 15, borderRadius: 8, textDecoration: "none",
          border: "1.5px solid rgba(255,255,255,0.5)",
        }}>
          まず先輩に話を聞く
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
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-noto-serif)',
              fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 500,
              color: "var(--ink)", letterSpacing: "0.04em", marginBottom: 6,
            }}>
              現場から届く、キャリアの声。
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.7 }}>
              OPINIO編集部が IT/SaaS 業界の現場に会いに行く、4種類の取材コンテンツ。
            </p>
          </div>
          <Link href="/articles" style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "9px 18px", borderRadius: 8,
            border: "1.5px solid var(--royal)", color: "var(--royal)",
            fontSize: 13, fontWeight: 600, textDecoration: "none",
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
            const icon  = TYPE_EYECATCH_ICON[type] ?? TYPE_EYECATCH_ICON["employee"];
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
                    height: 120, background: article.eyecatch_gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative",
                  }}>
                    <span style={{ fontSize: 40, opacity: 0.3 }}>{icon}</span>
                    <div style={{
                      position: "absolute", top: 10, left: 12,
                      display: "inline-flex", alignItems: "center",
                      padding: "3px 9px", borderRadius: 100,
                      background: badge.bg, color: badge.color,
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                    }}>
                      {badge.label}
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <h3 style={{
                      fontFamily: 'var(--font-noto-serif)',
                      fontSize: 13.5, fontWeight: 700, lineHeight: 1.6,
                      color: "var(--ink)", marginBottom: 10, flex: 1,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
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
                      <span style={{ fontSize: 11, color: "var(--ink-soft)", flex: 1, fontWeight: 500 }}>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [stats, setStats] = useState<SiteStats>(DEFAULT_STATS);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d: Partial<SiteStats>) => {
        if (d.companies != null || d.jobs != null || d.mentors != null) {
          setStats({
            companies: d.companies ?? DEFAULT_STATS.companies,
            jobs: d.jobs ?? DEFAULT_STATS.jobs,
            mentors: d.mentors ?? DEFAULT_STATS.mentors,
          });
        }
      })
      .catch(() => {/* デフォルトを維持 */});
  }, []);

  return (
    <>
      <Hero stats={stats} />
      <HowItWorks />
      <LogoStripSection />
      <DiffStrip />
      <FeaturedCompaniesSection />
      <StatsStrip stats={stats} />
      <InfraSection />
      <PainPoints />
      <UserTestimonials />
      <MentorsSection />
      <ArticlesPreview />
      <HomeFaq />
      <FinalCta mentorCount={stats.mentors} />
    </>
  );
}
