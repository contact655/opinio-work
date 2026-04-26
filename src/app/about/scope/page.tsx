import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Opinioが対象とする業界 | opinio.work",
  description:
    "opinio.workがカバーするIT/SaaS業界の定義と、対象外の業界について明示します。",
  openGraph: {
    title: "Opinioが対象とする業界 | opinio.work",
    description: "対象業界の定義と対象外領域について。",
    url: "https://opinio.work/about/scope",
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
    <>
      <Header />
      <main className="pt-16 min-h-screen" style={{ background: "#f8f9fa" }}>
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: 32, paddingBottom: 64 }}>
          <nav className="flex items-center gap-2" style={{ fontSize: 13, marginBottom: 20 }}>
            <Link href="/" style={{ color: "#1a6fd4", textDecoration: "none" }}>ホーム</Link>
            <span style={{ color: "#d1d5db" }}>›</span>
            <span style={{ color: "#6b7280" }}>対象業界</span>
          </nav>

          <header style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 12, color: "#1D9E75", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 8 }}>
              ABOUT — SCOPE
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", margin: 0, marginBottom: 10, lineHeight: 1.4 }}>
              Opinioが対象とする業界
            </h1>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.8, margin: 0 }}>
              Opinioは「IT/SaaS業界に特化した転職サイト」です。
              ここでは、対象とする業界の定義と、現時点で対象外としている領域を明示します。
            </p>
          </header>

          {/* 対象 */}
          <section style={{ background: "#fff", borderRadius: 14, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
              ✅ 対象とする業界
            </h2>
            <ul style={{ display: "flex", flexDirection: "column", gap: 14, listStyle: "none", margin: 0, padding: 0 }}>
              {inScope.map((item) => (
                <li key={item.name} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#f0fdf4", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{item.name}</div>
                    <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>{item.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* 対象外 */}
          <section style={{ background: "#fff", borderRadius: 14, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
              ❌ 対象外の業界
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14, lineHeight: 1.7 }}>
              編集部の取材リソースを集中させるため、現時点で以下の業界は対象外としています。
            </p>
            <ul style={{ display: "flex", flexDirection: "column", gap: 10, listStyle: "none", margin: 0, padding: 0 }}>
              {outOfScope.map((item) => (
                <li key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fef2f2", color: "#9ca3af", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </span>
                  <span style={{ fontSize: 13, color: "#475569" }}>{item}</span>
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
                fontSize: 14, fontWeight: 600, background: "#1D9E75", color: "#fff", textDecoration: "none",
              }}
            >
              対象業界の求人を見る →
            </Link>
            <Link
              href="/about/selection-criteria"
              style={{
                display: "inline-block", padding: "12px 28px", borderRadius: 10,
                fontSize: 14, fontWeight: 600, background: "#fff", color: "#1D9E75", border: "1.5px solid #1D9E75", textDecoration: "none",
              }}
            >
              審査基準を見る
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
