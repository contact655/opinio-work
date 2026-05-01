"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/common";
import HomeFaq from "@/app/HomeFaq";
import { MOCK_ARTICLES, TYPE_BADGE, TYPE_EYECATCH_ICON } from "@/app/articles/mockArticleData";

// ─── Mock data ────────────────────────────────────────────────────────────────

const LOGOS = [
  "SmartHR", "LayerX", "Ubie", "Sansan", "Salesforce",
  "HubSpot", "freee", "Money Forward", "kubell", "PKSHA", "Datadog",
];

const MENTORS = [
  {
    name: "田中 翔太",
    path: "元 Salesforce → スタートアップ CRO",
    tags: ["SaaS営業", "外資IT", "年収交渉"],
    msg: "SaaS営業への転職は、経験よりも思考力。面接で何を話すべきか、一緒に整理しましょう。",
    gradient: "royal" as const,
  },
  {
    name: "佐藤 美咲",
    path: "元 HubSpot → SaaSスタートアップ CSM",
    tags: ["カスタマーサクセス", "キャリアチェンジ", "未経験転職"],
    msg: "未経験からCSに転職したい方の相談が得意。何から始めるべきか整理します。",
    gradient: "pink" as const,
  },
  {
    name: "鈴木 健太",
    path: "元 Datadog → ITコンサル マネージャー",
    tags: ["外資IT", "フィールドセールス", "面接対策"],
    msg: "外資IT転職の面接対策・オファー交渉まで、実体験をもとにフィードバックします。",
    gradient: "green" as const,
  },
];

const PAIN_POINTS = [
  {
    icon: <ClockIcon />,
    q: "情報が古い気がして、応募に踏み切れない",
    a: "求人票がいつ更新されたのか分からない。Opinioでは編集部の取材と企業アンケートで情報を更新し続け、更新日も明示します。",
  },
  {
    icon: <SearchIcon />,
    q: "「フルリモートで副業OK」の条件が探しにくい",
    a: "働き方が多様化したのに、複数条件での検索が機能しない。Opinioは働き方×勤務地×企業タイプの組み合わせで、抜け漏れなく探せる設計です。",
  },
  {
    icon: <ShieldIcon />,
    q: "どの求人サイトを見れば、抜け漏れないか分からない",
    a: "サービスによって掲載企業がバラバラ。OpinioはIT/SaaS業界の求人を網羅的に集め、ここを見れば済む場所を目指します。",
  },
  {
    icon: <ChatIcon />,
    q: "求人票には書けない「本当の組織文化」が知りたい",
    a: "公式情報だけでは、入社後のギャップが怖い。Opinio編集部が現場メンバーへ直接取材した、生の組織文化レポートを各企業ページで公開しています。",
  },
  {
    icon: <PhoneOffIcon />,
    q: "エージェントに登録すると、営業電話が止まらない",
    a: "登録したら電話・メールラッシュで、冷静に比較できない。Opinioは電話一切なし、すべてオンラインで自分のペースで進められる設計です。",
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

// ─── Hero Typewriter ──────────────────────────────────────────────────────────

const TYPEWRITER_WORDS = [
  "SaaS営業への転職",
  "フルリモート勤務",
  "外資ITへのチャレンジ",
  "カスタマーサクセスへの転向",
  "スタートアップの選び方",
];

function HeroTypewriter() {
  const [wordIndex, setWordIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const target = TYPEWRITER_WORDS[wordIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && displayed.length < target.length) {
      timeout = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 60);
    } else if (!deleting && displayed.length === target.length) {
      timeout = setTimeout(() => setDeleting(true), 1800);
    } else if (deleting && displayed.length > 0) {
      timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 35);
    } else if (deleting && displayed.length === 0) {
      setDeleting(false);
      setWordIndex((i) => (i + 1) % TYPEWRITER_WORDS.length);
    }

    return () => clearTimeout(timeout);
  }, [displayed, deleting, wordIndex]);

  return (
    <span style={{ color: "var(--royal)" }}>
      {displayed}
      <span style={{
        display: "inline-block", width: 2, height: "0.9em",
        background: "var(--royal)", marginLeft: 2, verticalAlign: "middle",
        animation: "blink 1s step-end infinite",
      }} />
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </span>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const MOCK_JOBS = [
    { init: "L", color: "linear-gradient(135deg,#002366,#3B5FD9)", company: "LayerX", title: "Product Manager", tags: ["フルリモート", "副業OK"], salary: "¥700-1,200万" },
    { init: "H", color: "linear-gradient(135deg,#059669,#047857)", company: "HubSpot Japan", title: "Customer Success", tags: ["フルリモート", "フレックス"], salary: "¥650-950万" },
    { init: "U", color: "linear-gradient(135deg,#DB2777,#BE185D)", company: "Ubie", title: "フィールドセールス", tags: ["リモート可"], salary: "¥600-1,000万" },
  ];

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
            borderRadius: 100, fontSize: 13, fontWeight: 500, marginBottom: 32,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
            IT・SaaS業界のキャリアインフラ
          </div>

          {/* Title with typewriter */}
          <h1 style={{
            fontSize: "clamp(32px,4.5vw,54px)",
            fontWeight: 500, lineHeight: 1.4, letterSpacing: "0.01em",
            color: "var(--ink)", marginBottom: 24,
            fontFamily: 'var(--font-noto-serif)',
          }}>
            <HeroTypewriter />
            <br />
            <span style={{ color: "var(--ink)" }}>について、先輩に話を聞く。</span>
          </h1>

          {/* Lead */}
          <p style={{ fontSize: 17, lineHeight: 1.9, color: "var(--ink-soft)", marginBottom: 40, maxWidth: "var(--max-w-form)" }}>
            企業の<strong style={{ color: "var(--royal)" }}>今</strong>を知り、先輩と<strong style={{ color: "var(--royal)" }}>話し</strong>、自分で決める。<br />
            IT/SaaS業界に特化した、対話から始まる新しいキャリアの作り方。
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const, marginBottom: 40 }}>
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
            <Link href="/companies" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "16px 28px", background: "#fff", color: "var(--ink)",
              fontWeight: 600, fontSize: 15, borderRadius: 8, textDecoration: "none",
              border: "1.5px solid var(--line)",
            }}>
              企業を探す
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
              <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 16, color: "var(--royal)" }}>Opinio</span>
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
              {MOCK_JOBS.map((job, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 8, background: "var(--line-soft)",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: job.color,
                    color: "#fff", fontSize: 13, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {job.init}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{job.company}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{job.title}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                      {job.tags.map((t) => (
                        <span key={t} style={{
                          fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
                          background: "var(--royal-50)", color: "var(--royal)",
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", flexShrink: 0 }}>{job.salary}</div>
                </div>
              ))}
            </div>

            {/* Footer note */}
            <div style={{
              marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)",
              fontSize: 11, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 6,
            }}>
              <ChatIcon />
              すべての求人に「Opinio編集部の見解」付き
            </div>
          </div>
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
        IT/SaaS業界の求人情報を、網羅的に集めています
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
            Opinioが、キャリアインフラになる理由
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.9, color: "var(--ink-soft)", maxWidth: 600, margin: "0 auto" }}>
            私たちは企業の<strong>「今」</strong>を知り続け、<br />
            あなたの<strong>「これから」</strong>に必要な情報を、抜け漏れなく揃えます。
          </p>
        </div>

        {/* Block 01: FRESH */}
        <InfraBlock
          num="01 / FRESH"
          title={<>企業の<em style={{ fontStyle: "normal", color: "var(--royal)" }}>「今」</em>を、<br />取材とアンケートで更新し続ける。</>}
          desc="求人票に書かれている情報は、いつのものか分からない──そんな不安を解消します。Opinio編集部が企業を定期的に取材し、企業からも定期アンケートで最新情報を集めます。"
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
          desc="働き方が多様化した今、「フルリモートで副業OK」「子育てと両立できる週4日勤務」──条件の組み合わせで求人を探すのが難しくなっています。Opinioは、ライフスタイル起点で絞り込める場所を目指します。"
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
          desc="キャリアの悩みは、家族や社内の人には聞きづらい。Opinioには、あなたと似た経歴を持ち、少し先を歩く先輩がいます。30分のオンライン対話で気軽に話せます。"
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
            Opinioの、使い方
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
            }}>
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
    </section>
  );
}

// ─── Mentors Section ──────────────────────────────────────────────────────────

function MentorsSection() {
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
          {MENTORS.map((m, i) => (
            <div key={i} style={{
              background: "#fff", borderRadius: 20, padding: 28,
              border: "1px solid var(--line)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
                <Avatar name={m.name} size="lg" gradient={m.gradient} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2, lineHeight: 1.5 }}>{m.path}</div>
                </div>
              </div>
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
              <p style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink-soft)", marginBottom: 16 }}>{m.msg}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--success)", fontWeight: 600 }}>
                <CheckMark /> 相談料 0円・何度でも無料
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 40 }}>
          <Link href="/career-consultation" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "14px 28px", borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: "#fff", color: "var(--royal)",
            border: "1.5px solid var(--royal)", textDecoration: "none",
          }}>
            先輩一覧を見る →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section style={{
      background: `linear-gradient(135deg, var(--royal-deep) 0%, var(--royal) 60%, var(--accent) 100%)`,
      padding: "96px 48px", textAlign: "center",
    }} className="px-5 py-16 md:py-24 md:px-12">
      <h2 style={{
        fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 700, color: "#fff",
        marginBottom: 16, fontFamily: 'var(--font-noto-serif)', lineHeight: 1.35,
      }}>
        キャリアに、第三者の目を。
      </h2>
      <p style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", marginBottom: 40 }}>
        完全無料・メールアドレスのみで登録
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
        <Link href="/career-consultation" style={{
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

function ArticlesPreview() {
  const latest = MOCK_ARTICLES.slice(0, 3);
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
              Opinio編集部が IT/SaaS 業界の現場に会いに行く、4種類の取材コンテンツ。
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
            const badge = TYPE_BADGE[article.type];
            const icon  = TYPE_EYECATCH_ICON[article.type];
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
                        {article.date.slice(2).replace(/-/g, "/")}
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
      <LogoMarquee />
      <InfraSection />
      <HowItWorks />
      <PainPoints />
      <MentorsSection />
      <ArticlesPreview />
      <HomeFaq />
      <FinalCta />
    </>
  );
}
