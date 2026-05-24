import Link from "next/link";

export const metadata = {
  title: "対象業界 | OPINIO",
  description:
    "OPINIOがカバーするIT/SaaS業界の定義と、対象外の業界について明示します。",
  alternates: { canonical: "/about/scope" },
  openGraph: {
    title: "対象業界 | OPINIO",
    description: "対象業界の定義と対象外領域について。",
    url: "https://opinio.jp/about/scope",
  },
};

export default function ScopePage() {
  const inScope = [
    { name: "B2B SaaS", desc: "業務効率化・営業/マーケ/CS支援・HR Tech・FinTech 等" },
    { name: "PaaS / IaaS", desc: "開発者向けプラットフォーム・クラウドインフラ" },
    { name: "クラウドインフラ", desc: "AWS/GCP/Azureエコシステムを中心とした提供企業" },
    { name: "AI/ML系スタートアップ〜大手", desc: "プロダクト型のAI/ML企業（生成AI含む）" },
    { name: "外資IT", desc: "Salesforce, HubSpot, Datadog 等の日本法人" },
  ];
  const outOfScope = [
    "メディア事業",
    "ゲーム事業",
    "SIer・受託開発",
    "Web制作会社",
  ];

  return (
    <div className="pt-16 min-h-screen" style={{ background: "var(--bg-tint)" }}>
      <div className="max-w-[820px] mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <nav className="flex items-center gap-2" style={{ fontSize: 13, marginBottom: 20 }}>
          <Link href="/" style={{ color: "var(--royal)", textDecoration: "none" }}>ホーム</Link>
          <span style={{ color: "var(--line)" }}>›</span>
          <Link href="/about" style={{ color: "var(--royal)", textDecoration: "none" }}>OPINIOについて</Link>
          <span style={{ color: "var(--line)" }}>›</span>
          <span style={{ color: "var(--ink-soft)" }}>対象業界</span>
        </nav>

        <header style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 8 }}>
            ABOUT — SCOPE
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)", margin: 0, marginBottom: 10, lineHeight: 1.4 }}>
            OPINIOが対象とする業界
          </h1>
          <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.8, margin: 0 }}>
            OPINIOは「IT/SaaS業界に特化したキャリアプラットフォーム」です。
            ここでは、対象とする業界の定義と、現時点で対象外としている領域を明示します。
          </p>
        </header>

        {/* 対象 */}
        <section style={{ background: "#fff", borderRadius: 14, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--success-soft)", color: "var(--success)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            対象とする業界
          </h2>
          <ul style={{ display: "flex", flexDirection: "column", gap: 14, listStyle: "none", margin: 0, padding: 0 }}>
            {inScope.map((item) => (
              <li key={item.name} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--success-soft)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{item.name}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>{item.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 対象外 */}
        <section style={{ background: "#fff", borderRadius: 14, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--error-soft)", color: "var(--error)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
            対象外の業界
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 14, lineHeight: 1.7 }}>
            編集部の取材リソースを集中させるため、現時点で以下の業界は対象外としています。
          </p>
          <ul style={{ display: "flex", flexDirection: "column", gap: 10, listStyle: "none", margin: 0, padding: 0 }}>
            {outOfScope.map((item) => (
              <li key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--error-soft)", color: "var(--ink-mute)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
                <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/jobs"
            style={{
              display: "inline-block", padding: "12px 28px", borderRadius: 10,
              fontSize: 14, fontWeight: 600, background: "var(--royal)", color: "#fff", textDecoration: "none",
            }}
          >
            対象業界の求人を見る →
          </Link>
          <Link
            href="/about/selection-criteria"
            style={{
              display: "inline-block", padding: "12px 28px", borderRadius: 10,
              fontSize: 14, fontWeight: 600, background: "#fff", color: "var(--royal)", border: "1.5px solid var(--royal-100)", textDecoration: "none",
            }}
          >
            審査基準を見る
          </Link>
        </div>
      </div>
    </div>
  );
}
