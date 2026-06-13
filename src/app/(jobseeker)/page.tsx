"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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

type PreviewJob = {
  id: string;
  title: string;
  dept: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  workStyle: string | null;
  employmentType: string | null;
  location: string | null;
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

function Hero() {
  const [jobs, setJobs] = useState<PreviewJob[]>([]);

  useEffect(() => {
    fetch("/api/jobs/preview")
      .then((r) => r.json())
      .then((d) => { setJobs(Array.isArray(d.jobs) ? d.jobs : []); })
      .catch(() => { setJobs([]); });
  }, []);

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
            fontSize: "clamp(28px,3.8vw,46px)",
            fontWeight: 700, lineHeight: 1.4, letterSpacing: "-0.01em",
            color: "var(--ink)", marginBottom: "var(--space-3)",
            fontFamily: 'var(--font-noto-serif)',
          }}>
            <span style={{ color: "#D97706" }}>外資・SaaS</span>の転職は、<br />
            深く知ってから動く。
          </h1>

          {/* Tagline */}
          <p style={{ fontSize: 14, color: "var(--ink-mute)", marginBottom: "var(--space-6)", letterSpacing: "0.01em" }}>
            今のキャリアを変えなくてもいい。ただ、知ることから始めよう。
          </p>

          {/* Lead */}
          <p style={{ fontSize: 16, lineHeight: 1.9, color: "var(--ink-soft)", marginBottom: 36, maxWidth: "var(--max-w-form)" }}>
            外資IT・国内SaaS・スタートアップへの転職情報が一か所に。<br />
            <strong style={{ color: "#D97706" }}>登録不要</strong>で閲覧でき、カジュアル面談で<strong style={{ color: "#D97706" }}>現役社員に直接</strong>話を聞けます。
          </p>

          {/* CTAs */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" as const, marginBottom: 14, alignItems: "center" }}>
              <Link href="/companies" style={{
                display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
                padding: "var(--space-4) 28px", background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", color: "#fff",
                fontWeight: 700, fontSize: 15, borderRadius: 8, textDecoration: "none",
                boxShadow: "0 4px 20px rgba(245,158,11,0.3)",
              }}>
                まず企業を見てみる <ArrowIcon />
              </Link>
              <Link href="/auth" style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: "var(--text-sm)", color: "var(--ink-mute)", textDecoration: "none",
                padding: "var(--space-3) var(--space-4)",
                border: "1px solid var(--line)", borderRadius: 8, background: "#fff",
              }}>
                無料登録する
              </Link>
            </div>
          </div>

          {/* Trust */}
          <div style={{ display: "flex", gap: "var(--space-5)", flexWrap: "wrap" as const, fontSize: "var(--text-sm)", color: "var(--ink-soft)" }}>
            {["完全無料", "営業電話なし", "登録はメールのみ"].map((t) => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                {t}
              </span>
            ))}
          </div>

          {/* ② Stats row */}
          <div style={{
            display: "flex", gap: 28, flexWrap: "wrap" as const,
            marginTop: 20, paddingTop: 18,
            borderTop: "1px solid rgba(0,35,102,0.08)",
          }}>
            {[
              { num: "79社+", label: "掲載企業" },
              { num: "155件+", label: "公開求人" },
              { num: "無料", label: "登録・閲覧" },
            ].map(({ num, label }) => (
              <div key={label} style={{ display: "flex", flexDirection: "column" as const, gap: 1 }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 22, fontWeight: 800, color: "var(--ink)", lineHeight: 1 }}>{num}</span>
                <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: search mockup */}
        <div className="hidden md:flex justify-center hero-fade-right" style={{ position: "relative" }}>
          <div style={{
            background: "#fff", borderRadius: 20,
            boxShadow: "0 20px 60px rgba(0,35,102,0.10), 0 4px 16px rgba(15,23,42,0.06)",
            padding: "var(--space-6)", width: "100%", maxWidth: 400,
            border: "1px solid var(--line)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "var(--text-md)", color: "var(--royal)" }}>OPINIO</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--ink-soft)" }}>
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
              display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)",
            }}>
              <SearchIcon />
              <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)" }}>フルリモート・副業OKのSaaS企業</span>
            </div>

            {/* Result count */}
            {jobs.length > 0 && (
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontSize: 12, marginBottom: "var(--space-3)", color: "var(--ink-soft)",
              }}>
                <span><strong style={{ color: "var(--ink)", fontSize: 14 }}>{jobs.length}</strong> 件が該当</span>
                <span style={{ color: "var(--success)", fontSize: 11 }}>今日更新</span>
              </div>
            )}

            {/* Job list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {jobs.length === 0
                ? (
                    <div style={{
                      padding: "20px 16px", borderRadius: 12,
                      background: "var(--bg-tint)", textAlign: "center",
                      border: "1px solid var(--line)",
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 10 }}>
                        求人を読み込み中…
                      </div>
                      <Link href="/jobs" style={{
                        display: "inline-block", padding: "7px 16px",
                        borderRadius: 20, background: "var(--royal-50)", color: "var(--royal)",
                        fontSize: 12, fontWeight: 600, textDecoration: "none",
                        border: "1px solid var(--royal-100)",
                      }}>
                        すべての求人を見る →
                      </Link>
                    </div>
                  )
                : jobs.map((job) => {
                    const salary = formatSalary(job.salaryMin, job.salaryMax);
                    return (
                      <Link key={job.id} href={`/jobs/${job.id}`} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", borderRadius: 10,
                        background: "var(--bg-tint)",
                        border: "1px solid var(--line)",
                        textDecoration: "none",
                        transition: "background 0.15s",
                      }}>
                        {/* ロゴ */}
                        <div style={{
                          width: 34, height: 34, borderRadius: 8,
                          background: job.logoGradient,
                          color: "#fff", fontSize: 13, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, overflow: "hidden",
                        }}>
                          {job.logoUrl
                            ? <Image src={job.logoUrl} alt={job.companyName} width={34} height={34} style={{ objectFit: "contain" }} />
                            : (job.logoLetter || job.companyName[0])}
                        </div>
                        {/* テキスト */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.companyName}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.title}</div>
                          <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
                            {job.workStyle && (
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                                background: "var(--royal-50)", color: "var(--royal)",
                                border: "1px solid var(--royal-100)",
                              }}>{job.workStyle}</span>
                            )}
                            {job.employmentType && (
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                                background: "var(--line-soft)", color: "var(--ink-mute)",
                              }}>{job.employmentType}</span>
                            )}
                          </div>
                        </div>
                        {/* 年収 */}
                        {salary && (
                          <div style={{
                            fontSize: 13, fontWeight: 800,
                            color: "var(--success)", flexShrink: 0,
                            fontFamily: "Inter, sans-serif",
                            textAlign: "right",
                          }}>
                            {salary}
                            <div style={{ fontSize: 9, fontWeight: 500, color: "var(--ink-mute)", textAlign: "right" }}>万円</div>
                          </div>
                        )}
                      </Link>
                    );
                  })
              }
            </div>

            {/* Footer: 件数 + 全件リンク */}
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter" }}>
                全 31 件掲載中
              </span>
              <Link href="/jobs" style={{
                fontSize: 11, fontWeight: 600, color: "var(--royal)",
                textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
              }}>
                すべて見る <ArrowIcon />
              </Link>
            </div>
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
          {/* OPINIO取材済みバッジ（記事が紐づいている場合） */}
          {(c.articleCount ?? 0) > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px var(--space-2)", borderRadius: 100,
              background: "var(--warm-soft)", color: "#92400E",
              border: "1px solid #FDE68A",
              display: "flex", alignItems: "center", gap: 3,
              whiteSpace: "nowrap" as const,
            }}>
              ✍️ 取材済み
            </span>
          )}
          {/* 登録メンバーバッジ */}
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
          ) : (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "3px var(--space-2)", borderRadius: 100,
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
          {c.employeeCount && (
            <span style={{
              fontSize: 10, color: "var(--ink-mute)", fontFamily: "Inter",
              display: "flex", alignItems: "center", gap: 3,
              marginLeft: "auto",
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
              {c.employeeCount.toLocaleString()}名
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

function TrustStrip() {
  const STATS = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2} strokeLinecap="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
      num: "79社+",
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
      step: "STEP 02", title: "カジュアル面談", en: "Talk",
      desc: "気になった会社に、カジュアル面談を申し込んで現役社員に直接話を聞けます。完全無料。",
      action: "→ 企業を探す",
      href: "/companies",
      iconBg: "linear-gradient(135deg, #F59E0B, #D97706)",
      icon: <ChatIcon />,
      highlight: true,
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
                background: s.highlight ? "linear-gradient(135deg, var(--royal-50) 0%, #fff 100%)" : "#fff",
                border: `1px solid ${s.highlight ? "var(--royal-100)" : "var(--line)"}`,
                borderRadius: 16, padding: 28,
                cursor: "default",
                position: "relative", overflow: "hidden",
              }}>
                {/* 背景ステップ数字 */}
                <div style={{
                  position: "absolute", top: -4, right: 12,
                  fontSize: 96, fontWeight: 900,
                  color: s.highlight ? "var(--royal)" : "var(--ink)",
                  opacity: 0.04,
                  fontFamily: "Inter, sans-serif",
                  lineHeight: 1,
                  userSelect: "none" as const,
                  pointerEvents: "none",
                }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", marginBottom: "var(--space-3)" }}>{s.step}</div>
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
              <div style={{ padding: "22px 22px 18px" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: "#FEF2F2", color: "#DC2626",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: "var(--space-3)", flexShrink: 0,
                }}>
                  {p.icon}
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 8, lineHeight: 1.5 }}>{p.q}</p>
                <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--ink-mute)" }}>{p.pain}</p>
              </div>
              {/* 解決部分 */}
              <div style={{
                background: "var(--royal-50)",
                borderTop: "1px solid var(--royal-100)",
                padding: "14px 22px 18px",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "var(--royal)",
                  letterSpacing: "0.06em", marginBottom: 6,
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  OPINIOなら
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.8, color: "#1e3a6e", fontWeight: 500 }}>{p.resolution}</p>
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

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section style={{
      background: `linear-gradient(155deg, #002980 0%, #002366 45%, #1a3a8f 100%)`,
      padding: "96px 48px", textAlign: "center",
    }} className="px-5 py-16 md:py-24 md:px-12">
      <h2 style={{
        fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 700, color: "#fff",
        marginBottom: "var(--space-3)", fontFamily: 'var(--font-noto-serif)', lineHeight: 1.35,
      }}>
        今のキャリアを変えなくてもいい。<br />
        <span style={{ opacity: 0.85, fontSize: "0.75em" }}>ただ、知ることから始めよう。</span>
      </h2>
      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", marginBottom: 40, lineHeight: 1.8 }}>
        IT/SaaS業界の企業情報・求人が、ひとつの場所に。<br />
        完全無料・メールアドレスのみで登録。
      </p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
        {/* ⑨ Larger, more prominent amber CTA */}
        <Link href="/companies" style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "18px 52px",
          background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", color: "#fff",
          fontWeight: 800, fontSize: 17, borderRadius: 10, textDecoration: "none",
          boxShadow: "0 8px 32px rgba(245,158,11,0.45), 0 2px 8px rgba(0,0,0,0.12)",
          letterSpacing: "-0.01em",
        }}>
          まず企業を見てみる <ArrowIcon />
        </Link>
        <Link href="/auth" style={{
          fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          無料会員登録はこちら →
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
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-8)", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-noto-serif)',
              fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 500,
              color: "var(--ink)", letterSpacing: "0.04em", marginBottom: 6,
            }}>
              現場から届く、キャリアの声。
            </h2>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-mute)", lineHeight: 1.7 }}>
              OPINIO編集部が IT/SaaS 業界の現場に会いに行く、4種類の取材コンテンツ。
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
                    {/* タイトルプレビュー（下端オーバーレイ） */}
                    <p style={{
                      fontSize: 12, fontWeight: 700, color: "#fff",
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      margin: 0,
                      position: "relative", zIndex: 1,
                    } as React.CSSProperties}>
                      {article.title}
                    </p>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <FeaturedCompaniesSection />
      <PainPoints />
      <StoryFeedSection />
      <ArticlesPreview />
      <HomeFaq />
      <FinalCta />
    </>
  );
}
