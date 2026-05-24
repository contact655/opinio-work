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
const DEFAULT_STATS: SiteStats = { companies: 36, jobs: 30, mentors: 10 };

// ─── Mock data ────────────────────────────────────────────────────────────────

const LOGOS = [
  "SmartHR", "LayerX", "Ubie", "Sansan", "Salesforce",
  "HubSpot", "freee", "Money Forward", "kubell", "PKSHA", "Datadog",
];

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

// ─── Hero Role Rotator ────────────────────────────────────────────────────────

const ROLE_LIST = [
  "エンタープライズセールス",
  "カスタマーサクセス",
  "プロダクトマーケティング",
  "インサイドセールス",
  "プロダクトマネージャー",
  "フィールドセールス",
  "ビジネス開発",
  "マーケティング",
];

// 最長職種名（レイアウトシフト防止の基準）
const LONGEST_ROLE = "プロダクトマーケティング";

function HeroRoleRotator() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  useEffect(() => {
    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      // フェードアウト
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % ROLE_LIST.length);
        // フェードイン
        setVisible(true);
      }, 400);
    }, 2800);

    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {/* 最長職種名で幅を確保（レイアウトシフト防止） */}
      <span aria-hidden style={{ visibility: "hidden", display: "inline-block" }}>
        {LONGEST_ROLE}
      </span>
      <span style={{
        position: "absolute", left: 0, top: 0,
        color: "var(--royal)",
        opacity: visible ? 1 : 0,
        transition: "opacity 400ms ease-in-out",
        whiteSpace: "nowrap",
      }}>
        {ROLE_LIST[index]}
      </span>
      <style>{`@media (prefers-reduced-motion: reduce) { .hero-role-rotator { transition: none !important; } }`}</style>
    </span>
  );
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
  if (!min && !max) return null;
  const fmt = (v: number) => `${Math.round(v / 10000)}`;
  if (min && max) return `¥${fmt(min)}-${fmt(max)}万`;
  if (min) return `¥${fmt(min)}万〜`;
  if (max) return `〜¥${fmt(max)}万`;
  return null;
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
      background: `
        radial-gradient(ellipse 60% 50% at 85% 30%, rgba(30,64,175,0.07) 0%, transparent 60%),
        radial-gradient(ellipse 50% 40% at 15% 80%, rgba(0,35,102,0.05) 0%, transparent 60%),
        linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)
      `,
      padding: "80px 48px 100px",
      overflow: "hidden",
    }} className="px-5 pt-16 pb-20 md:px-12 md:pt-20 md:pb-24">
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
        className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16 items-center">

        {/* Left: message */}
        <div className="hero-fade">
          {/* Eyebrow */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "8px 16px", background: "var(--royal-50)", color: "var(--royal)",
            borderRadius: 100, fontSize: 13, fontWeight: 600, marginBottom: 32,
            border: "1px solid var(--royal-100)",
            letterSpacing: "0.01em",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0,
              animation: "pulseDot 2.5s ease-in-out infinite",
            }} />
            IT / SaaS 業界に、特化している。
          </div>

          {/* Title with role rotator */}
          <h1 style={{
            fontSize: "clamp(30px,4.5vw,52px)",
            fontWeight: 500, lineHeight: 1.4, letterSpacing: "0.01em",
            color: "var(--ink)", marginBottom: 24,
            fontFamily: 'var(--font-noto-serif)',
          }}>
            <HeroRoleRotator />
            <br />
            <span style={{ color: "var(--ink)" }}>の求人と企業を、先輩と話しながら選ぶ。</span>
          </h1>

          {/* Lead */}
          <p style={{ fontSize: 17, lineHeight: 1.9, color: "var(--ink-soft)", marginBottom: 40, maxWidth: "var(--max-w-form)" }}>
            転職を検討していなくても、使えるキャリアサービスを目指しています。<br />
            企業の<strong style={{ color: "var(--royal)" }}>今</strong>を知り、現役先輩に<strong style={{ color: "var(--royal)" }}>相談</strong>し、自分のペースで選ぶ。
          </p>

          {/* CTAs */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const, marginBottom: 14 }}>
              <Link href="/auth" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "16px 28px", background: "var(--royal)", color: "#fff",
                fontWeight: 600, fontSize: 15, borderRadius: 8, textDecoration: "none",
                boxShadow: "0 4px 14px rgba(0,35,102,0.25)",
              }}>
                無料登録する <ArrowIcon />
              </Link>
              <Link href="/career-consultation" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "16px 28px", background: "#fff", color: "var(--royal)",
                fontWeight: 600, fontSize: 15, borderRadius: 8, textDecoration: "none",
                border: "1.5px solid var(--royal)",
              }}>
                先輩に相談する
              </Link>
            </div>
            <Link href="/companies" style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 13, color: "var(--ink-mute)", textDecoration: "none",
            }}>
              まず企業・求人を見てみる
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </Link>
          </div>

          {/* Trust */}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" as const, fontSize: 13, color: "var(--ink-mute)" }}>
            {["完全無料", "営業電話なし", "登録はメールのみ"].map((t) => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <CheckMark /> {t}
              </span>
            ))}
          </div>

          {/* Mobile-only key stats strip */}
          <div className="flex md:hidden" style={{
            marginTop: 28, gap: 0,
            background: "var(--royal-50)", borderRadius: 12,
            border: "1px solid var(--royal-100)", overflow: "hidden",
          }}>
            {[
              { value: String(stats.companies), unit: "社", label: "掲載企業" },
              { value: String(stats.jobs), unit: "件", label: "公開求人" },
              { value: String(stats.mentors), unit: "名", label: "相談できる先輩" },
            ].map((s, i) => (
              <div key={s.label} style={{
                flex: 1, textAlign: "center", padding: "14px 8px",
                borderRight: i < 2 ? "1px solid var(--royal-100)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "Inter, sans-serif", color: "var(--royal)" }}>
                    {s.value}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>{s.unit}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 2, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Quick search bar */}
          <div style={{ marginTop: 32 }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = (e.currentTarget.querySelector('input') as HTMLInputElement).value.trim();
                if (q) router.push(`/jobs?q=${encodeURIComponent(q)}`);
                else router.push('/jobs');
              }}
              style={{
                display: "flex",
                background: "#fff",
                border: "1.5px solid var(--line)",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0,35,102,0.08)",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLFormElement).style.borderColor = "var(--royal)";
                (e.currentTarget as HTMLFormElement).style.boxShadow = "0 4px 20px rgba(0,35,102,0.15)";
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  (e.currentTarget as HTMLFormElement).style.borderColor = "var(--line)";
                  (e.currentTarget as HTMLFormElement).style.boxShadow = "0 4px 20px rgba(0,35,102,0.08)";
                }
              }}
            >
              <input
                type="text"
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
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              {["フルリモート", "カスタマーサクセス", "プロダクトマネージャー", "副業OK"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => router.push(`/jobs?q=${encodeURIComponent(tag)}`)}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 100,
                    background: "var(--royal-50)", color: "var(--royal)",
                    border: "1px solid var(--royal-100)", cursor: "pointer",
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
            <Avatar name="佐藤 美咲" size="sm" gradient="pink" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>佐藤さん（元HubSpot）</div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>似た経歴の私に、話しませんか？</div>
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
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 12, marginBottom: 12, color: "var(--ink-soft)",
            }}>
              <span><strong style={{ color: "var(--ink)", fontSize: 14 }}>47</strong> 件が該当</span>
              <span style={{ color: "var(--success)", fontSize: 11 }}>今日更新</span>
            </div>

            {/* Job list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {jobs.length === 0
                ? [0, 1, 2].map((i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 8, background: "var(--line-soft)",
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: "var(--line)",
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                        <div style={{ height: 9, width: "40%", borderRadius: 4, background: "var(--line)" }} />
                        <div style={{ height: 11, width: "70%", borderRadius: 4, background: "var(--line)" }} />
                      </div>
                      <div style={{ height: 9, width: 48, borderRadius: 4, background: "var(--line)", flexShrink: 0 }} />
                    </div>
                  ))
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
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", flexShrink: 0 }}>{salary}</div>
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
  const DIFFS = [
    {
      icon: "🚫",
      title: "スカウトなし",
      desc: "企業からの一方的な勧誘はありません。気になった企業に、自分のペースで接触できます。",
      color: "#DC2626",
      bg: "#FEF2F2",
    },
    {
      icon: "💬",
      title: "第三者メンターに相談",
      desc: "転職エージェントではなく、中立な立場の現役/元社員メンターに本音を聞けます。",
      color: "#7C3AED",
      bg: "#F5F3FF",
    },
    {
      icon: "👥",
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
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 16,
              padding: "32px 28px",
              borderRight: i < 2 ? "1px solid var(--line)" : "none",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: d.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
              }}>
                {d.icon}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                  {d.title}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink-soft)" }}>
                  {d.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Logo Marquee ─────────────────────────────────────────────────────────────

function LogoMarquee() {
  const doubled = [...LOGOS, ...LOGOS];
  return (
    <section style={{
      borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
      padding: "32px 0", overflow: "hidden", background: "#fff",
    }}>
      <p style={{
        textAlign: "center", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em",
        color: "var(--ink-mute)", textTransform: "uppercase",
        marginBottom: 20,
      }}>
        IT / SaaS 業界を代表する企業が、OPINIO に集まっています
      </p>
      <div style={{ position: "relative", overflow: "hidden" }}>
        {/* fade masks */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 80, background: "linear-gradient(to right, #fff, transparent)", zIndex: 1 }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 80, background: "linear-gradient(to left, #fff, transparent)", zIndex: 1 }} />
        <div className="animate-marquee">
          {doubled.map((name, i) => (
            <span key={i} style={{
              display: "inline-flex", alignItems: "center",
              padding: "6px 20px", margin: "0 4px",
              borderRadius: 100, border: "1.5px solid var(--line)",
              fontSize: 13, fontWeight: 500, color: "var(--ink-soft)",
              whiteSpace: "nowrap",
            }}>
              {name}
            </span>
          ))}
        </div>
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

// ─── Infrastructure Section ───────────────────────────────────────────────────

function InfraBlock({
  num, title, desc, points, visual, reverse = false,
}: {
  num: string; title: React.ReactNode; desc: string;
  points: { icon: React.ReactNode; html: React.ReactNode }[];
  visual: React.ReactNode; reverse?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 gap-12 items-center md:grid-cols-2 md:gap-16 ${reverse ? "md:[direction:rtl]" : ""}`}
      style={{ paddingTop: 80, paddingBottom: 80, borderTop: "1px solid var(--line)" }}>
      {/* Text */}
      <div style={{ direction: "ltr" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", textTransform: "uppercase" as const }}>{num}</span>
        <h3 style={{ fontSize: "clamp(22px,2.5vw,30px)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, margin: "12px 0 16px", fontFamily: 'var(--font-noto-serif)' }}>
          {title}
        </h3>
        <p style={{ fontSize: 15, lineHeight: 1.9, color: "var(--ink-soft)", marginBottom: 24 }}>{desc}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {points.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ color: "var(--royal)", flexShrink: 0, marginTop: 2 }}>{p.icon}</span>
              <div style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink-soft)" }}>{p.html}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Visual */}
      <div style={{ direction: "ltr" }}>{visual}</div>
    </div>
  );
}

function InfraSection() {
  return (
    <section style={{ padding: "0 48px" }} className="px-5 md:px-12">
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", padding: "80px 0 0" }}>
          <SectionTag>WHAT MAKES OPINIO DIFFERENT</SectionTag>
          <h2 style={{ fontSize: "clamp(26px,3vw,36px)", fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>
            他のキャリアサービスと、ここが違う。
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.9, color: "var(--ink-soft)", maxWidth: 600, margin: "0 auto" }}>
            求人の<strong>鮮度</strong>、検索の<strong>網羅性</strong>、相談できる<strong>先輩の存在</strong>。<br />
            キャリア判断に必要な 3 つを、ひとつの場所に揃えました。
          </p>
        </div>

        {/* Block 01: FRESH */}
        <InfraBlock
          num="01 / FRESH"
          title={<>企業の<em style={{ fontStyle: "normal", color: "var(--royal)" }}>「今」</em>を、<br />取材とアンケートで更新し続ける。</>}
          desc="求人票に書かれている情報は、いつのものか分からない──そんな不安を解消します。OPINIO編集部が企業を定期的に取材し、企業からも定期アンケートで最新情報を集めます。"
          points={[
            { icon: <ClockIcon />, html: <><strong>編集部による定期取材：</strong>経営層・現場メンバーに会いにいき、生の言葉をお届けします。</> },
            { icon: <ChatIcon />, html: <><strong>企業からの定期アンケート：</strong>リモート比率、残業時間、組織変更などを企業自身に更新してもらう仕組み。</> },
            { icon: <CheckMark />, html: <><strong>更新日の明示：</strong>各求人・企業情報に「最終更新日」を表示。古い情報は透明に。</> },
          ]}
          visual={
            <div style={{
              background: "var(--royal-50)", borderRadius: 16, padding: 24,
              border: "1px solid var(--royal-100)",
            }}>
              {[
                { label: "STEP 1 · 編集部", title: "企業への訪問取材", desc: "経営者・現場メンバーに直接会いに", date: "4月", v: 1 },
                { label: "STEP 2 · 企業", title: "定期アンケート回答", desc: "リモート比率・残業・組織情報を更新", date: "毎月", v: 2 },
                { label: "STEP 3 · ユーザー", title: "常に最新の情報", desc: "「○日前に更新」と明示して表示", date: "今日", v: 3 },
              ].map((step, i) => (
                <div key={i}>
                  <div style={{
                    background: "#fff", borderRadius: 12, padding: "14px 16px",
                    display: "flex", alignItems: "center", gap: 12,
                    boxShadow: "0 2px 8px rgba(0,35,102,0.06)",
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: step.v === 1 ? "var(--royal-50)" : step.v === 2 ? "#F5F3FF" : "var(--success-soft)",
                      color: step.v === 1 ? "var(--royal)" : step.v === 2 ? "var(--purple)" : "var(--success)",
                    }}>
                      {step.v === 1 ? <ClockIcon /> : step.v === 2 ? <ChatIcon /> : <CheckMark />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.06em" }}>{step.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{step.title}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{step.desc}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--royal)", flexShrink: 0 }}>{step.date}</span>
                  </div>
                  {i < 2 && <div style={{ textAlign: "center", fontSize: 18, color: "var(--ink-mute)", padding: "4px 0" }}>↓</div>}
                </div>
              ))}
            </div>
          }
        />

        {/* Block 02: COVERED (reversed) */}
        <InfraBlock
          reverse
          num="02 / COVERED"
          title={<>ライフスタイルに合う求人を、<br /><em style={{ fontStyle: "normal", color: "var(--royal)" }}>抜け漏れなく</em>探せる。</>}
          desc="働き方が多様化した今、「フルリモートで副業OK」「子育てと両立できる週4日勤務」──条件の組み合わせで求人を探すのが難しくなっています。OPINIOは、ライフスタイル起点で絞り込める場所を目指します。"
          points={[
            { icon: <CheckMark />, html: <><strong>働き方で絞れる：</strong>フルリモート・副業OK・フレックス・週3/4日勤務など、多様なタグを標準装備。</> },
            { icon: <CheckMark />, html: <><strong>勤務地で絞れる：</strong>地方在住でも、自分のペースに合う場所で働ける会社を見つけられます。</> },
            { icon: <CheckMark />, html: <><strong>業界の網羅性：</strong>IT/SaaS業界の求人を、外資・国内スタートアップ・上場企業まで集約。</> },
          ]}
          visual={
            <div style={{
              background: "#fff", borderRadius: 16, padding: 24,
              boxShadow: "0 8px 32px rgba(0,35,102,0.08), 0 0 0 1px var(--line)",
            }}>
              {[
                { label: "働き方", chips: [{ t: "フルリモート", on: true }, { t: "副業OK", on: true }, { t: "フレックス", on: false }, { t: "週4日勤務", on: false }] },
                { label: "勤務地", chips: [{ t: "全国どこでも", on: true }, { t: "東京", on: false }, { t: "大阪", on: false }, { t: "福岡", on: false }] },
                { label: "企業タイプ", chips: [{ t: "外資", on: true }, { t: "スタートアップ", on: false }, { t: "上場", on: false }] },
              ].map((group, gi) => (
                <div key={gi} style={{ marginBottom: gi < 2 ? 16 : 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-mute)", marginBottom: 8 }}>{group.label}</div>
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                    {group.chips.map((c, ci) => (
                      <span key={ci} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "5px 12px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                        background: c.on ? "var(--royal)" : "#fff",
                        color: c.on ? "#fff" : "var(--ink-soft)",
                        border: c.on ? "none" : "1.5px solid var(--line)",
                      }}>
                        {c.on && <span style={{ fontSize: 10 }}>✓</span>}
                        {c.t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{
                marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>
                  <strong style={{ fontSize: 20, color: "var(--ink)" }}>47</strong> 件の求人が該当
                </span>
                <Link href="/jobs" style={{ fontSize: 13, color: "var(--royal)", textDecoration: "none", fontWeight: 600 }}>
                  すべて見る →
                </Link>
              </div>
            </div>
          }
        />

        {/* Block 03: MENTOR */}
        <InfraBlock
          num="03 / MENTOR"
          title={<>数年先を歩く先輩に、<br /><em style={{ fontStyle: "normal", color: "var(--royal)" }}>カジュアルに</em>話を聞ける。</>}
          desc="キャリアの悩みは、家族や社内の人には聞きづらい。OPINIOには、あなたと似た経歴を持ち、少し先を歩く先輩がいます。30分のオンライン対話で気軽に話せます。"
          points={[
            { icon: <PersonIcon />, html: <><strong>似た経歴の先輩とマッチング：</strong>あなたの職種・経験年数・志向に近い先輩を自動で提案します。</> },
            { icon: <CheckMark />, html: <><strong>応募の強制なし：</strong>相談がそのまま求人提案に繋がることはありません。フラットな対話を大切に。</> },
            { icon: <CheckMark />, html: <><strong>オンラインで30分から：</strong>勤務時間外でもOK。お昼休みや移動中にも気軽に。</> },
          ]}
          visual={
            <div style={{
              background: "var(--royal-50)", borderRadius: 16, padding: 24,
              border: "1px solid var(--royal-100)",
            }}>
              {/* You */}
              <div style={{
                background: "#fff", borderRadius: 12, padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
                boxShadow: "0 2px 8px rgba(0,35,102,0.06)",
              }}>
                <Avatar name="あ" size="sm" gradient="royal" />
                <div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>あなた</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>SaaS営業 · 5年 · CS転向希望</div>
                </div>
              </div>
              <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink-soft)", padding: "4px 0 8px", fontWeight: 500 }}>
                ↓ 似た経歴の先輩
              </div>
              {[
                { name: "佐藤 美咲", path: "元HubSpot営業 → 現SaaS CSM", sim: "同じ転向経験あり", gradient: "pink" as const },
                { name: "田中 翔太", path: "元Salesforce営業 → 現CRO", sim: "営業キャリア5年以上", gradient: "royal" as const },
              ].map((m, i) => (
                <div key={i} style={{
                  background: "#fff", borderRadius: 12, padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 12, marginBottom: i < 1 ? 8 : 0,
                  boxShadow: "0 2px 8px rgba(0,35,102,0.06)",
                }}>
                  <Avatar name={m.name} size="sm" gradient={m.gradient} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{m.path}</div>
                    <span style={{
                      display: "inline-block", marginTop: 4,
                      fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                      background: "var(--royal-50)", color: "var(--royal)",
                    }}>{m.sim}</span>
                  </div>
                  <button style={{
                    padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                    background: "var(--royal)", color: "#fff", border: "none", cursor: "pointer",
                    flexShrink: 0,
                  }}>相談</button>
                </div>
              ))}
            </div>
          }
        />
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const STEPS = [
    {
      step: "STEP 01", title: "探す", en: "Find",
      desc: "ライフスタイルに合う条件で、最新の求人と企業情報を探せます。",
      action: "→ 求人・企業を検索",
      iconBg: "linear-gradient(135deg, var(--royal), var(--accent))",
      icon: <SearchIcon />,
    },
    {
      step: "STEP 02", title: "相談する", en: "Talk",
      desc: "気になった会社について、似た経歴の先輩に気軽に話を聞けます。",
      action: "→ 先輩と30分オンライン対話",
      iconBg: "linear-gradient(135deg, #F472B6, #DB2777)",
      icon: <ChatIcon />,
      highlight: true,
    },
    {
      step: "STEP 03", title: "決める", en: "Decide",
      desc: "応募する、今の会社に残る、もう少し考える。どの選択もあなたの自由です。",
      action: "→ 自分のペースで判断",
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
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)" }}>{s.action}</div>
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

// ─── User Testimonials ────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: "メンターの方に話を聞いて、ずっと迷っていた転職に踏み切れました。求人情報だけでは分からない「社内の雰囲気」を教えてもらえたのが大きかったです。",
    role: "SaaS営業 → CSM",
    tag: "転職成功",
    tagColor: "var(--success)",
    tagBg: "var(--success-soft)",
    avatar: "佐",
    gradient: "linear-gradient(135deg, #7C3AED, #A78BFA)",
  },
  {
    quote: "転職を考えているわけではなかったけど、業界の最新トレンドや他社の様子を知れて、現職でのキャリア戦略が整理できました。求人サイトというより情報プラットフォームに近い感覚。",
    role: "プロダクトマネージャー・5年目",
    tag: "情報収集",
    tagColor: "var(--royal)",
    tagBg: "var(--royal-50)",
    avatar: "田",
    gradient: "linear-gradient(135deg, #002366, #3B5FD9)",
  },
  {
    quote: "自分と似たキャリアの先輩が実際にいて、30分話すだけで悩みが整理できました。「応募しなきゃ」というプレッシャーがないのがよかった。",
    role: "エンジニア・3年目",
    tag: "メンター相談",
    tagColor: "#d97706",
    tagBg: "var(--warm-soft)",
    avatar: "鈴",
    gradient: "linear-gradient(135deg, #059669, #34D399)",
  },
];

function UserTestimonials() {
  return (
    <section style={{ background: "var(--bg-tint)", padding: "96px 48px" }} className="px-5 py-16 md:py-24 md:px-12">
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <SectionTag>VOICES</SectionTag>
          <h2 style={{
            fontSize: "clamp(24px,3vw,34px)", fontWeight: 700,
            color: "var(--ink)", marginBottom: 12,
            fontFamily: "var(--font-noto-serif)",
          }}>
            使ってみた方の声
          </h2>
          <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.8 }}>
            転職活動中でも、情報収集中でも。キャリアの悩みを持つすべての方に。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                border: "1px solid var(--line)",
                borderRadius: 16,
                padding: "24px 24px 22px",
                display: "flex", flexDirection: "column",
                boxShadow: "0 2px 12px rgba(15,23,42,0.06)",
                position: "relative",
              }}
              className="testimonial-card"
            >
              {/* Large quote mark */}
              <div style={{
                position: "absolute", top: 18, right: 22,
                fontSize: 56, fontWeight: 900, lineHeight: 1,
                color: "var(--line)",
                fontFamily: "Georgia, serif",
                pointerEvents: "none",
              }}>
                "
              </div>

              {/* Tag */}
              <span style={{
                display: "inline-flex", alignItems: "center",
                fontSize: 10, fontWeight: 700, padding: "3px 10px",
                borderRadius: 100, marginBottom: 16,
                background: t.tagBg, color: t.tagColor,
                letterSpacing: "0.04em", alignSelf: "flex-start",
                border: `1px solid ${t.tagColor}22`,
              }}>
                {t.tag}
              </span>

              {/* Quote */}
              <p style={{
                fontSize: 14, lineHeight: 1.9, color: "var(--ink-soft)",
                flex: 1, marginBottom: 20,
              }}>
                {t.quote}
              </p>

              {/* Author */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 16, borderTop: "1px solid var(--line-soft)" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: t.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                  {t.avatar}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 500 }}>
                  {t.role}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .testimonial-card:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 8px 24px rgba(0,35,102,0.07) !important;
          transform: translateY(-2px);
          transition: all 0.2s;
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
  currentCompany: string;
  currentRole: string;
  path: string;
  tags: string[];
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
            <Link key={m.id} href={`/mentors/${m.id}`} style={{ textDecoration: "none" }}>
              <div style={{
                background: "#fff", borderRadius: 20, padding: 28,
                border: "1px solid var(--line)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
                height: "100%",
              }}
                className="mentor-card"
              >
                {/* ヘッダー：アバター + 受付中バッジ */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center", flex: 1, minWidth: 0 }}>
                    <Avatar name={m.name} size="lg" gradient={m.gradient} />
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
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

                {/* 相談するボタン（warm orange） */}
                <div style={{
                  width: "100%", padding: "11px 0", borderRadius: 8, fontSize: 14, fontWeight: 700,
                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                  color: "#fff", textAlign: "center" as const,
                  boxShadow: "0 3px 10px rgba(245,158,11,0.3)",
                }}>
                  相談する
                </div>
              </div>
            </Link>
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
      <DiffStrip />
      <LogoMarquee />
      <StatsStrip stats={stats} />
      <InfraSection />
      <HowItWorks />
      <PainPoints />
      <UserTestimonials />
      <MentorsSection />
      <ArticlesPreview />
      <HomeFaq />
      <FinalCta mentorCount={stats.mentors} />
    </>
  );
}
