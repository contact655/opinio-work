"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// ── Role data: typewriter labels + synced search placeholders ─────────────────
const ROLES = [
  { label: "エンタープライズ営業", placeholder: "エンタープライズ営業 経験5年以上" },
  { label: "カスタマーサクセス",   placeholder: "カスタマーサクセス + SaaS経験" },
  { label: "プロダクトマネージャー", placeholder: "PM経験あり、IT業界10年以上" },
  { label: "インサイドセールス",   placeholder: "インサイドセールス + BtoB経験" },
  { label: "BizDev",              placeholder: "BizDev + 事業立ち上げ経験" },
];

// ── Mock Candidates (right side preview) ─────────────────────────────────────
const MOCK_CANDIDATES = [
  {
    init: "山",
    color: "linear-gradient(135deg, #002366, #3B5FD9)",
    name: "山田 健太郎",
    role: "フィールドセールス",
    company: "SmartHR 出身",
    tags: ["SaaS営業", "エンタープライズ"],
  },
  {
    init: "中",
    color: "linear-gradient(135deg, #059669, #047857)",
    name: "中村 さやか",
    role: "カスタマーサクセス",
    company: "Salesforce Japan 出身",
    tags: ["CS", "オンボーディング"],
  },
  {
    init: "佐",
    color: "linear-gradient(135deg, #7C3AED, #6D28D9)",
    name: "佐々木 拓也",
    role: "プロダクトマネージャー",
    company: "Money Forward 出身",
    tags: ["BtoB SaaS", "PM"],
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ color: "var(--royal)", fontWeight: 700, marginTop: 1, flexShrink: 0 }}>✓</span>
      <span style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

function CtaButton() {
  return (
    <div>
      <Link
        href="/biz/auth"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "16px 36px",
          background: "var(--royal)",
          color: "#fff",
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
      <p style={{ marginTop: 10, fontSize: 12, color: "var(--ink-mute)", textAlign: "center" }}>
        クレジットカード登録不要 · 自動課金なし
      </p>
    </div>
  );
}

// ── Hero Component ────────────────────────────────────────────────────────────
export function BusinessHero() {
  const [wordIndex, setWordIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);
  // placeholder fades out while deleting, fades in when new word starts typing
  const [phVisible, setPhVisible] = useState(true);

  useEffect(() => {
    const target = ROLES[wordIndex].label;
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && displayed.length < target.length) {
      // typing — same speed as jobseeker LP (60ms per char)
      timeout = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 60);
    } else if (!deleting && displayed.length === target.length) {
      // pause at full word — same as jobseeker LP (1800ms)
      timeout = setTimeout(() => {
        setDeleting(true);
        setPhVisible(false); // fade out placeholder as we start deleting
      }, 1800);
    } else if (deleting && displayed.length > 0) {
      // deleting — same speed as jobseeker LP (35ms per char)
      timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 35);
    } else if (deleting && displayed.length === 0) {
      // advance to next word
      setDeleting(false);
      setWordIndex((i) => (i + 1) % ROLES.length);
    }

    return () => clearTimeout(timeout);
  }, [displayed, deleting, wordIndex]);

  // fade placeholder back in once we start typing the new word
  useEffect(() => {
    if (!deleting && displayed.length === 1) {
      setPhVisible(true);
    }
  }, [deleting, displayed]);

  const currentRole = ROLES[wordIndex];

  return (
    <section
      style={{
        background: `
          radial-gradient(ellipse 60% 50% at 85% 30%, rgba(30,64,175,0.07) 0%, transparent 60%),
          radial-gradient(ellipse 50% 40% at 15% 80%, rgba(0,35,102,0.05) 0%, transparent 60%),
          linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)
        `,
      }}
      className="px-6 pt-20 pb-24 md:px-12 md:pt-24 md:pb-28"
    >
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

      <div
        style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
        className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16 items-center"
      >
        {/* ── Left: Copy ── */}
        <div>
          {/* Badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 14px",
            background: "var(--royal-50)",
            border: "1px solid var(--royal-100)",
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--royal)",
            marginBottom: 28,
            letterSpacing: "0.04em",
          }}>
            IT/SaaS業界 採用担当者の方へ
          </div>

          {/* H1 — typewriter on line 1, fixed suffix on line 2 */}
          <h1 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: "clamp(32px, 4.5vw, 52px)",
            fontWeight: 500,
            lineHeight: 1.3,
            color: "var(--ink)",
            letterSpacing: "-0.02em",
            marginBottom: 16,
          }}>
            {/* Typewriter line — royal blue, mirrors jobseeker LP HeroTypewriter */}
            <span style={{ color: "var(--royal)" }}>
              {displayed}
              <span style={{
                display: "inline-block",
                width: 2,
                height: "0.9em",
                background: "var(--royal)",
                marginLeft: 2,
                verticalAlign: "middle",
                animation: "blink 1s step-end infinite",
              }} />
            </span>
            <br />
            の即戦力に出会う。
          </h1>

          {/* Sub headline */}
          <p style={{
            fontSize: "clamp(17px, 2vw, 21px)",
            fontWeight: 700,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
            marginBottom: 28,
          }}>
            採用コスト、ゼロから。
          </p>

          {/* Checklist */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 40 }}>
            <CheckItem>完全無料で求人掲載</CheckItem>
            <CheckItem>営業電話なし</CheckItem>
            <CheckItem>入社まで一切請求なし</CheckItem>
          </div>

          {/* CTA */}
          <CtaButton />
        </div>

        {/* ── Right: Search mockup (synced with typewriter) ── */}
        <div className="hidden md:flex justify-center" style={{ position: "relative" }}>

          {/* Floating mentor bubble */}
          <div style={{
            position: "absolute",
            bottom: -16,
            right: -8,
            zIndex: 10,
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 8px 24px rgba(0,35,102,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: 240,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #059669, #047857)",
              color: "#fff", fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>田</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>田中さん（元Sansan）</div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>この方をご紹介できます</div>
            </div>
          </div>

          {/* Main search mockup card */}
          <div style={{
            background: "#fff",
            borderRadius: 20,
            boxShadow: "0 30px 60px rgba(0,35,102,0.12), 0 8px 24px rgba(15,23,42,0.06)",
            padding: 24,
            width: "100%",
            maxWidth: 400,
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 15, color: "var(--royal)" }}>OPINIO</span>
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 9, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Business</span>
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-soft)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", flexShrink: 0, display: "inline-block" }} />
                新着候補者
              </span>
            </div>

            {/* Search label */}
            <div style={{
              fontSize: 10, fontWeight: 600, color: "var(--ink-mute)",
              letterSpacing: "0.06em", textTransform: "uppercase",
              marginBottom: 8,
            }}>
              経験で絞り込む
            </div>

            {/* Search bar — placeholder synced with typewriter wordIndex */}
            <div style={{
              border: "1.5px solid var(--royal)", borderRadius: 8, padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              {/* Placeholder fades with phVisible */}
              <span style={{
                fontSize: 13,
                color: "var(--ink-soft)",
                opacity: phVisible ? 1 : 0,
                transition: "opacity 0.25s ease",
              }}>
                {currentRole.placeholder}
              </span>
            </div>

            {/* Result count */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 12, marginBottom: 12, color: "var(--ink-soft)",
            }}>
              <span><strong style={{ color: "var(--ink)", fontSize: 14 }}>47</strong> 件が該当</span>
              <span style={{ color: "var(--success)", fontSize: 11 }}>今日更新</span>
            </div>

            {/* Candidate list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MOCK_CANDIDATES.map((c, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 8, background: "var(--line-soft)",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: c.color,
                    color: "#fff", fontSize: 13, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {c.init}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{c.company}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{c.name} · {c.role}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                      {c.tags.map((t) => (
                        <span key={t} style={{
                          fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
                          background: "var(--royal-50)", color: "var(--royal)",
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 2,
                    padding: "3px 7px",
                    background: "var(--success-soft)", color: "var(--success)",
                    borderRadius: 100, fontSize: 9, fontWeight: 700,
                    flexShrink: 0, whiteSpace: "nowrap",
                  }}>
                    ★ 面談済
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)",
              fontSize: 11, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 6,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              すべての候補者に「OPINIO編集部の推薦コメント」付き
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
