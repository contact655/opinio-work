/**
 * Fix 15: 「25社しか掲載しない」を強みに変える
 */

import Link from "next/link";

const axes = [
  {
    title: "プロダクト成長性",
    desc: "事業フェーズ・ARR・市場ポテンシャルから、中長期で伸びる企業を選定。",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    title: "カルチャー",
    desc: "経営層・現場メンバーへの取材で、働き方と意思決定の透明性を確認。",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    ),
  },
  {
    title: "待遇",
    desc: "給与・リモート率・残業・福利厚生が業界水準を満たすか実態ベースで検証。",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
];

export function WhyOnly25() {
  return (
    <section style={{ background: "#fff", paddingTop: 64, paddingBottom: 64 }}>
      <div className="max-w-5xl mx-auto px-8">
        <p style={{ fontSize: 12, color: "#1D9E75", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 8 }}>
          OUR EDITORIAL POLICY
        </p>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 10, letterSpacing: "-0.01em" }}>
          なぜ25社しか掲載しないのか
        </h2>
        <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.8, marginBottom: 28, maxWidth: 720 }}>
          数ではなく、本当にマッチする1社を。<br />
          Opinio編集部が3軸で評価し、審査を通過した企業のみを掲載しています。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {axes.map((a) => (
            <div key={a.title} style={{ display: "flex", gap: 14, padding: 18, borderRadius: 12, background: "#fafaf7", border: "0.5px solid #e8e4dc" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {a.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{a.title}</div>
                <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.7, margin: 0 }}>{a.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <Link
            href="/about/selection-criteria"
            style={{ display: "inline-block", fontSize: 13, fontWeight: 600, color: "#1D9E75", textDecoration: "none" }}
          >
            審査基準について詳しく見る →
          </Link>
        </div>
      </div>
    </section>
  );
}
