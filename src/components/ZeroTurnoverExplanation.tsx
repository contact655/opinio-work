/**
 * Fix 14: Why Zero Turnover — 3 reasons.
 */

export function ZeroTurnoverExplanation() {
  const reasons = [
    {
      n: 1,
      title: "取材による深い理解",
      desc: "120社以上を実際に訪問し、現場の声を聞いています。",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      n: 2,
      title: "Opinioの見解の開示",
      desc: "フィットしやすい点・注意点を包み隠さず伝えます。",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      n: 3,
      title: "メンターによる第三者視点",
      desc: "IT業界経験者が、冷静にマッチを見極めます。",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
  ];

  return (
    <section style={{ background: "#f0fdf4", paddingTop: 56, paddingBottom: 56, borderTop: "0.5px solid #b7e4c7", borderBottom: "0.5px solid #b7e4c7" }}>
      <div className="max-w-5xl mx-auto px-8">
        <p style={{ fontSize: 12, color: "#1D9E75", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 8, textAlign: "center" }}>
          OUR PROMISE
        </p>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", textAlign: "center", marginBottom: 8, letterSpacing: "-0.01em" }}>
          なぜ早期離職ゼロなのか
        </h2>
        <p style={{ fontSize: 13, color: "#475569", textAlign: "center", marginBottom: 32, lineHeight: 1.7 }}>
          創業以来200名以上の転職を支援し、早期離職は0件。<br />
          その理由は、3つの取り組みにあります。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {reasons.map((r) => (
            <div
              key={r.n}
              style={{
                background: "#fff",
                border: "0.5px solid #b7e4c7",
                borderRadius: 14,
                padding: "24px 22px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "#f0fdf4", border: "0.5px solid #b7e4c7",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {r.icon}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1D9E75" }}>0{r.n}</span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0, marginBottom: 6 }}>{r.title}</h3>
              <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: 0 }}>{r.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, padding: "18px 24px", background: "#fff", borderRadius: 12, border: "1px solid #1D9E75", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "#0f172a", fontWeight: 600, margin: 0, lineHeight: 1.7 }}>
            この約束は、Opinio代表 柴悠人の責任において宣言します。
          </p>
        </div>
      </div>
    </section>
  );
}
