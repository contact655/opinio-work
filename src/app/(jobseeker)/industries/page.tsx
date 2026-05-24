import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "対象業界 | OPINIO",
  description:
    "OPINIOが対象とするIT/SaaS業界の定義について。B2B SaaS・外資IT・AIスタートアップなどを網羅。",
  alternates: { canonical: "/industries" },
  openGraph: {
    title: "対象業界 | OPINIO",
    description: "OPINIOが対象とするIT/SaaS業界の定義。B2B SaaS・外資IT・AIスタートアップなどを網羅。",
    url: "https://opinio.jp/industries",
    type: "website",
  },
};

const IN_SCOPE = [
  {
    name: "B2B SaaS",
    desc: "業務効率化・営業/マーケ/CS支援・HR Tech・FinTech など、企業向けソフトウェア事業",
    examples: ["SmartHR", "LayerX", "freee", "Money Forward"],
  },
  {
    name: "外資IT",
    desc: "グローバルITプロダクト企業の日本法人・日本オフィス",
    examples: ["Salesforce", "HubSpot", "Datadog", "Notion"],
  },
  {
    name: "AI / ML系スタートアップ〜大手",
    desc: "プロダクト型のAI/ML企業（生成AI含む）",
    examples: ["PKSHA Technology", "Ubie"],
  },
  {
    name: "クラウドインフラ / PaaS / IaaS",
    desc: "開発者向けプラットフォーム・クラウドインフラ提供企業",
    examples: [],
  },
];

const OUT_OF_SCOPE = [
  "メディア事業（広告収益モデル）",
  "ゲーム事業",
  "SIer・受託開発中心の会社",
  "Web制作会社",
  "EC・小売業",
];

export default function IndustriesPage() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "64px 24px 96px" }}>
        {/* Breadcrumb */}
        <nav aria-label="パンくずリスト" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-mute)", marginBottom: 40 }}>
          <Link href="/" style={{ color: "var(--royal)", textDecoration: "none" }}>ホーム</Link>
          <span>›</span>
          <span aria-current="page">対象業界</span>
        </nav>

        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <div style={{
            display: "inline-block",
            fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
            color: "var(--royal)", textTransform: "uppercase",
            marginBottom: 16,
          }}>
            INDUSTRIES
          </div>
          <h1 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 700, lineHeight: 1.4,
            color: "var(--ink)", marginBottom: 20,
          }}>
            対象業界
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.9, color: "var(--ink-soft)", maxWidth: 600 }}>
            OPINIOはIT/SaaS業界に特化したプラットフォームです。<br />
            以下の定義に沿った企業の求人・情報を掲載しています。
          </p>
        </div>

        {/* In scope */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: "40px 40px",
          border: "1px solid var(--line)",
          boxShadow: "0 2px 12px rgba(0,35,102,0.06)",
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", textTransform: "uppercase", marginBottom: 20 }}>
            COVERED — 対象業界
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {IN_SCOPE.map((item, i) => (
              <div key={i} style={{
                paddingBottom: i < IN_SCOPE.length - 1 ? 24 : 0,
                borderBottom: i < IN_SCOPE.length - 1 ? "1px solid var(--line-soft)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "var(--success)", flexShrink: 0,
                  }} />
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{item.name}</div>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink-soft)", marginBottom: item.examples.length > 0 ? 10 : 0, paddingLeft: 18 }}>
                  {item.desc}
                </p>
                {item.examples.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 18 }}>
                    {item.examples.map((ex) => (
                      <span key={ex} style={{
                        display: "inline-block", padding: "2px 10px", borderRadius: 100,
                        fontSize: 12, fontWeight: 500,
                        background: "var(--royal-50)", color: "var(--royal)",
                        border: "1px solid var(--royal-100)",
                      }}>
                        {ex}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Out of scope */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: "40px 40px",
          border: "1px solid var(--line)",
          boxShadow: "0 2px 12px rgba(0,35,102,0.06)",
          marginBottom: 32,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-mute)", textTransform: "uppercase", marginBottom: 20 }}>
            NOT COVERED — 対象外
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {OUT_OF_SCOPE.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "var(--line)", flexShrink: 0,
                }} />
                <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            background: "var(--royal-50)", borderRadius: 12, padding: "28px 32px",
            border: "1px solid var(--royal-100)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 16,
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                対象企業の求人を探す
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                IT/SaaS業界の最新求人を、働き方・職種で絞り込めます
              </div>
            </div>
            <Link href="/companies" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "12px 24px", background: "var(--royal)", color: "#fff",
              fontWeight: 600, fontSize: 14, borderRadius: 8, textDecoration: "none",
              whiteSpace: "nowrap",
            }}>
              企業一覧を見る →
            </Link>
          </div>
          <div style={{
            background: "var(--warm-soft)", borderRadius: 12, padding: "28px 32px",
            border: "1px solid #FDE68A",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 16,
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                業界のことを先輩に直接聞く
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                OPINIOのメンターは編集部が声がけした現役・元社員のみ。30分・無料で相談できます
              </div>
            </div>
            <Link href="/mentors" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "12px 24px",
              background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
              color: "#fff",
              fontWeight: 600, fontSize: 14, borderRadius: 8, textDecoration: "none",
              whiteSpace: "nowrap",
            }}>
              先輩に相談する（無料）→
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
