import type React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "採用担当者の方へ | OPINIO Business",
  description: "IT/SaaS業界の優秀な人材と出会う。企業情報・求人を掲載して、求職者と対話を始めましょう。OPINIO Business は無料でご利用いただけます。",
  robots: { index: true },
};

const FEATURES: { icon: React.ReactNode; title: string; desc: string }[] = [
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    title: "企業情報を掲載する",
    desc: "会社の文化・働き方・フィット感を丁寧に伝えられます。採用ページよりも「素」の企業を表現できます。",
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
    title: "求人を掲載する",
    desc: "IT/SaaS 業界に特化したプラットフォームで、経験者へ直接リーチ。求人票の作成・公開を無料で始められます。",
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "カジュアル面談で接点を作る",
    desc: "転職意欲に関わらず興味を持った求職者と対話。スカウトではなく、求職者が選んで来ます。",
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    title: "応募を管理する",
    desc: "応募者の一覧・選考ステータス管理・メッセージのやり取りをワンストップで。",
  },
];

const STEPS = [
  { num: "01", title: "アカウント作成", desc: "メールアドレスで登録。1分で完了します。" },
  { num: "02", title: "企業情報を入力", desc: "会社名・業界・働き方などの基本情報を設定します。" },
  { num: "03", title: "求人・情報を公開", desc: "審査後に公開。求職者が企業を閲覧・応募できるようになります。" },
];

export default function BizLandingPage() {
  return (
    <div style={{
      minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans JP', sans-serif",
      color: "#0f172a",
    }}>
      <style>{`
        @media (max-width: 767px) {
          .biz-lp-hero-grid { grid-template-columns: 1fr !important; }
          .biz-lp-features-grid { grid-template-columns: 1fr !important; }
          .biz-lp-steps { flex-direction: column !important; }
          .biz-lp-step-connector { display: none !important; }
          .biz-lp-cta-btns { flex-direction: column !important; align-items: stretch !important; }
          .biz-lp-hero-title { font-size: 28px !important; }
        }
      `}</style>

      {/* Nav */}
      <nav style={{
        background: "#fff",
        borderBottom: "1px solid #e2e8f0",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 60,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <Link href="/biz" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#002366", letterSpacing: "-0.02em" }}>OPINIO</span>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.12em",
            padding: "2px 7px",
            background: "#eff3fc",
            color: "#3B5FD9",
            borderRadius: 4,
            border: "1px solid #dce5f7",
          }}>BUSINESS</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ fontSize: 13, color: "#64748b", textDecoration: "none" }}>
            求職者の方はこちら
          </Link>
          <Link href="/biz/auth?mode=login" style={{
            fontSize: 13,
            color: "#002366",
            textDecoration: "none",
            padding: "7px 16px",
            border: "1.5px solid #002366",
            borderRadius: 8,
            fontWeight: 600,
          }}>
            ログイン
          </Link>
          <Link href="/biz/auth" style={{
            fontSize: 13,
            color: "#fff",
            textDecoration: "none",
            padding: "7px 16px",
            background: "#002366",
            borderRadius: 8,
            fontWeight: 700,
          }}>
            無料で始める
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        background: "linear-gradient(135deg, #001A4D 0%, #002366 50%, #1e3a8a 100%)",
        color: "#fff",
        padding: "80px 40px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="biz-lp-hero-grid" style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 60,
            alignItems: "center",
          }}>
            <div>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 20,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 24,
              }}>
                ✦ 掲載・利用無料（βプログラム）
              </div>
              <h1 className="biz-lp-hero-title" style={{
                fontSize: 36,
                fontWeight: 800,
                lineHeight: 1.25,
                margin: "0 0 20px",
                letterSpacing: "-0.02em",
              }}>
                IT/SaaS業界の優秀な人材と、<br />
                対話から始める採用を。
              </h1>
              <p style={{ fontSize: 16, lineHeight: 1.8, color: "rgba(255,255,255,0.8)", margin: "0 0 36px" }}>
                OPINIO は、転職活動中かどうかに関わらず、<br />
                キャリアを考え続けている人たちが集まるプラットフォームです。<br />
                スカウトではなく「来てもらう」採用を実現します。
              </p>
              <div className="biz-lp-cta-btns" style={{ display: "flex", gap: 12 }}>
                <Link href="/biz/auth" style={{
                  display: "inline-block",
                  background: "#fff",
                  color: "#002366",
                  padding: "14px 32px",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontWeight: 800,
                  fontSize: 15,
                }}>
                  無料でアカウントを作成 →
                </Link>
                <Link href="/biz/auth?mode=login" style={{
                  display: "inline-block",
                  background: "transparent",
                  color: "#fff",
                  padding: "14px 24px",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                  border: "1.5px solid rgba(255,255,255,0.4)",
                }}>
                  ログイン
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div style={{
              background: "rgba(255,255,255,0.08)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.15)",
              padding: 32,
            }}>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>プラットフォーム実績（2026年5月）</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                {[
                  { value: "36社", label: "掲載企業数" },
                  { value: "30件+", label: "公開中の求人" },
                  { value: "10件", label: "取材記事" },
                  { value: "無料", label: "掲載・利用費" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{stat.value}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "72px 40px", background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 12px", color: "#002366" }}>
              OPINIO でできること
            </h2>
            <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
              IT/SaaS 業界に特化した採用プラットフォームの機能をご紹介します。
            </p>
          </div>
          <div className="biz-lp-features-grid" style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 20,
          }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "24px 28px",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: "rgba(0,35,102,0.06)", color: "#002366",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 16,
                }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", color: "#0f172a" }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: "72px 40px", background: "#f8fafc" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 12px", color: "#002366" }}>
              はじめるのは3ステップ
            </h2>
          </div>
          <div className="biz-lp-steps" style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
            {STEPS.map((step, i) => (
              <>
                <div key={step.num} style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "0 16px",
                }}>
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #002366, #3B5FD9)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}>{step.num}</div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>{step.title}</h3>
                  <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="biz-lp-step-connector" style={{
                    alignSelf: "center",
                    color: "#cbd5e1",
                    marginTop: -24,
                    flexShrink: 0,
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                )}
              </>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        background: "linear-gradient(135deg, #002366, #3B5FD9)",
        color: "#fff",
        padding: "64px 40px",
        textAlign: "center",
      }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 12px" }}>
          採用担当者の方、まずは無料で試してみてください
        </h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", margin: "0 0 32px", lineHeight: 1.7 }}>
          βプログラム期間中は全機能を無料でご利用いただけます。<br />
          アカウント作成は1分で完了します。
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/biz/auth" style={{
            display: "inline-block",
            background: "#fff",
            color: "#002366",
            padding: "14px 36px",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 800,
            fontSize: 15,
          }}>
            無料でアカウントを作成 →
          </Link>
          <Link href="/companies" style={{
            display: "inline-block",
            background: "transparent",
            color: "#fff",
            padding: "14px 24px",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
            border: "1.5px solid rgba(255,255,255,0.4)",
          }}>
            掲載企業を見る
          </Link>
        </div>
        <p style={{ marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          法人のお問い合わせは{" "}
          <a href="mailto:info@opinio.jp" style={{ color: "rgba(255,255,255,0.8)" }}>info@opinio.jp</a>{" "}
          まで
        </p>
      </section>

      {/* Footer */}
      <footer style={{
        background: "#0f172a",
        color: "#64748b",
        padding: "28px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>OPINIO</span>
        <div style={{ display: "flex", gap: 20, fontSize: 12 }}>
          <Link href="/terms" style={{ color: "#64748b", textDecoration: "none" }}>利用規約</Link>
          <Link href="/privacy" style={{ color: "#64748b", textDecoration: "none" }}>プライバシーポリシー</Link>
          <Link href="/" style={{ color: "#64748b", textDecoration: "none" }}>求職者向けトップ</Link>
        </div>
        <span style={{ fontSize: 12 }}>© 2026 OPINIO Inc.</span>
      </footer>
    </div>
  );
}
