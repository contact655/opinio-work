import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "OPINIOについて | OPINIO",
  description:
    "IT/SaaS業界に特化したキャリアインフラ「OPINIO」の運営理念・コンセプトについて。",
};

export default function AboutPage() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      {/* Breadcrumb */}
      <nav aria-label="パンくずリスト" style={{
        background: "var(--bg-tint)", borderBottom: "1px solid var(--line)", padding: "10px 0",
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5 }}>
            <Link href="/" style={{ color: "var(--ink-mute)" }}>OPINIO</Link>
            <span>/</span>
            <span aria-current="page" style={{ color: "var(--ink-soft)" }}>OPINIOについて</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, #002366 55%, #1a3569 100%)",
        padding: "48px 0 44px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", right: -80, top: -80, width: 340, height: 340, borderRadius: "50%", background: "rgba(59,95,217,0.1)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: -40, bottom: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(245,158,11,0.06)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 860, margin: "0 auto", position: "relative" }} className="px-5 md:px-12">
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.5)", marginBottom: 12, textTransform: "uppercase",
          }}>
            ABOUT OPINIO
          </div>
          <h1 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: "clamp(24px, 3.5vw, 36px)",
            fontWeight: 700, color: "#fff",
            marginBottom: 14, lineHeight: 1.4,
          }}>
            OPINIOについて
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.72)", lineHeight: 1.9, maxWidth: 500, margin: "0 0 20px" }}>
            IT/SaaS業界に特化したキャリアインフラ。<br />
            企業の「今」を知り、先輩と話し、自分で決める。
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["対話から始まる採用", "電話一切なし", "メンター30分無料"].map((tag) => (
              <span key={tag} style={{
                fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 100,
                background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px 96px" }}>
        {/* Mission */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: "40px 40px",
          border: "1px solid var(--line)",
          boxShadow: "0 2px 12px rgba(0,35,102,0.06)",
          marginBottom: 32,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", textTransform: "uppercase", marginBottom: 12 }}>
            MISSION
          </div>
          <h2 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: "clamp(20px, 2.5vw, 26px)",
            fontWeight: 700, color: "var(--ink)", marginBottom: 16, lineHeight: 1.5,
          }}>
            対話の、産業を作る。
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.9, color: "var(--ink-soft)" }}>
            私たちは、採用を「スカウト」で済ませる時代に疑問を持っています。<br />
            OPINIOは「対話から始まる採用」を産業として確立することを目指します。<br />
            求職者が能動的に情報を集め、先輩に相談し、納得して動く。そんなキャリアの作り方を支えるインフラでありたい。
          </p>
        </div>

        {/* Values */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: "40px 40px",
          border: "1px solid var(--line)",
          boxShadow: "0 2px 12px rgba(0,35,102,0.06)",
          marginBottom: 32,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", textTransform: "uppercase", marginBottom: 20 }}>
            VALUES
          </div>
          {[
            { title: "電話しない", desc: "登録してもエージェントから電話がかかってくることはありません。すべてオンライン・テキストで完結します。" },
            { title: "スカウトしない", desc: "企業から求職者へのスカウト送信機能はありません。対話は求職者側から始まります。" },
            { title: "キャリアを考え続ける人のために", desc: "「転職活動中」かどうかに関係なく使えます。情報収集・先輩相談だけでも大歓迎です。" },
            { title: "運営の丁寧な介在", desc: "メンター登録は個別声がけ、相談は編集部が精査してから転送します。品質を担保するために、量より質を選びます。" },
          ].map((v, i) => (
            <div key={i} style={{
              display: "flex", gap: 16, alignItems: "flex-start",
              paddingBottom: i < 3 ? 20 : 0,
              marginBottom: i < 3 ? 20 : 0,
              borderBottom: i < 3 ? "1px solid var(--line-soft)" : "none",
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "var(--royal)", flexShrink: 0, marginTop: 8,
              }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{v.title}</div>
                <div style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink-soft)" }}>{v.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Sub-page navigation */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 32 }}>
          <Link href="/about/scope" style={{ textDecoration: "none" }}>
            <div style={{
              background: "#fff", borderRadius: 14, padding: "24px 24px",
              border: "1px solid var(--line)",
              boxShadow: "0 1px 6px rgba(0,35,102,0.05)",
              transition: "box-shadow 0.15s",
              cursor: "pointer",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", textTransform: "uppercase", marginBottom: 10 }}>SCOPE</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>対象業界</div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                OPINIOがカバーするIT/SaaS業界の定義と、対象外の業界について。
              </div>
              <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: "var(--royal)" }}>詳しく見る →</div>
            </div>
          </Link>
          <Link href="/about/selection-criteria" style={{ textDecoration: "none" }}>
            <div style={{
              background: "#fff", borderRadius: 14, padding: "24px 24px",
              border: "1px solid var(--line)",
              boxShadow: "0 1px 6px rgba(0,35,102,0.05)",
              transition: "box-shadow 0.15s",
              cursor: "pointer",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", textTransform: "uppercase", marginBottom: 10 }}>CRITERIA</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>掲載企業の審査基準</div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                編集部による審査プロセスと3軸の評価基準を公開しています。
              </div>
              <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: "var(--royal)" }}>詳しく見る →</div>
            </div>
          </Link>
        </div>

        {/* Articles CTA */}
        <div style={{
          background: "var(--royal-50)", borderRadius: 12, padding: "24px 28px",
          border: "1px solid var(--royal-100)",
          textAlign: "center",
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 14, color: "var(--royal)", fontWeight: 500 }}>
            OPINIOの取り組みについてさらに詳しくは
            <Link href="/articles" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none", margin: "0 4px" }}>
              記事ページ
            </Link>
            でもご覧いただけます。
          </p>
        </div>

        {/* Mentor CTA */}
        <div style={{
          background: "var(--warm-soft)", border: "1.5px solid #FDE68A",
          borderRadius: 14, padding: "28px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#B45309", marginBottom: 8, textTransform: "uppercase" as const }}>
              OPINIO MENTOR
            </div>
            <p style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(14px, 2vw, 16px)", fontWeight: 500, color: "var(--ink)", margin: 0, lineHeight: 1.55 }}>
              「丁寧な介在」を体感してみませんか？
            </p>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.7 }}>
              編集部が個別に声がけした現役・元社員のみ。30分・完全無料で相談できます。
            </p>
          </div>
          <Link href="/mentors" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700,
            background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
            color: "#fff", textDecoration: "none", flexShrink: 0,
          }}>
            先輩メンターを見る →
          </Link>
        </div>
      </div>
    </div>
  );
}
