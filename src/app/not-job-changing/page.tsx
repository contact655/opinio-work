import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import Link from "next/link";

export const metadata = {
  title: { absolute: "転職しない人のために | OPINIO" },
  description: "転職を急がない方へ。社内キャリアの作り方、市場価値を上げる学び方、半年後にもう一度相談する選択肢。",
  alternates: { canonical: "https://opinio.jp/not-job-changing" },
  openGraph: {
    title: "転職しない人のために | OPINIO",
    description: "転職を急がない方への、OPINIOからの提案です。",
    url: "https://opinio.jp/not-job-changing",
  },
};

const PATHS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    title: "社内キャリアを作る",
    desc: "今の会社で次のステップを踏むには。異動希望の伝え方、上司との対話、評価制度の見極め方。",
    tag: "社内キャリア",
    color: "var(--royal)",
    bg: "var(--royal-50)",
    border: "var(--royal-100)",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: "市場価値を上げる",
    desc: "業界・職種別に、半年〜1年で着実にスキルを伸ばすための書籍・コミュニティ・実践課題をまとめました。",
    tag: "スキルアップ",
    color: "#7C3AED",
    bg: "#F3E8FF",
    border: "#DDD6FE",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    title: "転職市場の相場感を知る",
    desc: "今の年収は妥当か、転職するなら何年後がよいか。市場価値の測り方を、業界データとともに解説します。",
    tag: "市場価値",
    color: "var(--success)",
    bg: "var(--success-soft)",
    border: "#A7F3D0",
  },
];

export default function NotJobChangingPage() {
  return (
    <>
      <JobseekerHeader />
      <main className="pt-16 min-h-screen" style={{ background: "var(--bg-tint)" }}>

        {/* Breadcrumb */}
        <nav aria-label="パンくずリスト" style={{
          background: "var(--bg-tint)", borderBottom: "1px solid var(--line)", padding: "10px 0",
        }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }} className="px-5 md:px-12">
            <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5 }}>
              <Link href="/" style={{ color: "var(--ink-mute)" }}>OPINIO</Link>
              <span>/</span>
              <span aria-current="page" style={{ color: "var(--ink-soft)" }}>転職しない人のために</span>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg, #001233 0%, var(--royal) 55%, #1a3569 100%)",
          padding: "48px 0 44px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Decorative circles */}
          <div style={{ position: "absolute", right: -80, top: -80, width: 360, height: 360, borderRadius: "50%", background: "rgba(59,95,217,0.1)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: -60, bottom: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(245,158,11,0.06)", pointerEvents: "none" }} />
          <div style={{ maxWidth: 860, margin: "0 auto", position: "relative" }} className="px-5 md:px-12">
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.5)", marginBottom: 12, textTransform: "uppercase",
            }}>
              FOR THOSE NOT JOB-CHANGING
            </div>
            <h1 style={{
              fontFamily: "var(--font-noto-serif)",
              fontSize: "clamp(24px, 3.5vw, 34px)",
              fontWeight: 700, color: "#fff",
              marginBottom: 16, lineHeight: 1.4,
            }}>
              転職しない人のために
            </h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", lineHeight: 1.9, maxWidth: 540, margin: "0 0 24px" }}>
              転職するか、しないか——答えを急がなくていい。<br />
              OPINIOは「今すぐ転職しない」あなたにも、価値ある情報と対話を届けます。
            </p>
            {/* Key choices */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["情報収集中", "現職でのキャリアアップ", "半年後に再考"].map((tag) => (
                <span key={tag} style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 100,
                  background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 0 80px" }} className="px-5 md:px-12">

          {/* 3 paths */}
          <section style={{ marginBottom: 40 }}>
            <h2 style={{
              fontSize: "clamp(17px, 2vw, 21px)", fontWeight: 700, color: "var(--ink)",
              marginBottom: 20, fontFamily: "var(--font-noto-serif)",
            }}>
              今できる3つのこと
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {PATHS.map((p) => (
                <div key={p.title} style={{
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: 16,
                  padding: "24px 24px 20px",
                  display: "flex",
                  gap: 20,
                  alignItems: "flex-start",
                  boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
                }}>
                  {/* Icon */}
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: p.bg, color: p.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, border: `1px solid ${p.border}`,
                  }}>
                    {p.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                        background: p.bg, color: p.color, border: `1px solid ${p.border}`,
                      }}>
                        {p.tag}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
                      {p.title}
                    </h3>
                    <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.75, margin: "0 0 12px" }}>
                      {p.desc}
                    </p>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 11, color: p.color, fontWeight: 700,
                      padding: "3px 10px", borderRadius: 100,
                      background: p.bg, border: `1px solid ${p.border}`,
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                      </svg>
                      近日公開
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* カジュアル面談 CTA */}
          <div style={{
            background: "var(--royal-50)", border: "1.5px solid var(--royal-100)",
            borderRadius: 16, padding: "28px 32px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 20, flexWrap: "wrap", marginBottom: 24,
            boxShadow: "0 4px 20px rgba(0,35,102,0.08)",
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", marginBottom: 8, textTransform: "uppercase" }}>
                CASUAL MEETING
              </div>
              <p style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(15px,2vw,18px)", fontWeight: 500,
                color: "var(--ink)", margin: "0 0 6px", lineHeight: 1.55,
              }}>
                気になる企業の現役社員に話を聞く
              </p>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.7 }}>
                転職するか迷っている段階でも大丈夫。カジュアル面談は完全無料です。
              </p>
            </div>
            <Link
              href="/companies"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "13px 24px", borderRadius: 10,
                fontSize: 14, fontWeight: 700,
                background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
                color: "#fff", textDecoration: "none",
                boxShadow: "0 4px 16px rgba(0,35,102,0.25)",
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              企業を見てみる（無料）
            </Link>
          </div>

          {/* 半年後リマインド */}
          <div style={{
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 16, padding: "28px 32px",
            boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
                  半年後にまた相談する
                </h2>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, margin: "0 0 16px" }}>
                  「今は動かないけど、半年後に状況を整理したい」<br />
                  そんなときは、OPINIOに登録だけしておいてください。半年後にメールでお知らせします。タイミングが来たら企業にカジュアル面談を申し込めます。
                </p>
                <Link
                  href="/auth?mode=signup"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "11px 24px", borderRadius: 8,
                    fontSize: 13, fontWeight: 700,
                    background: "var(--royal)", color: "#fff", textDecoration: "none",
                  }}
                >
                  半年後リマインドに登録する →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <JobseekerFooter />
    </>
  );
}
