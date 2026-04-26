/**
 * Fix 13: Founder message section.
 * Hardcoded message — content updates rarely.
 */

export function FounderMessage() {
  return (
    <section style={{ background: "#fff", paddingTop: 72, paddingBottom: 72 }}>
      <div className="max-w-4xl mx-auto px-8">
        <p style={{ fontSize: 12, color: "#1D9E75", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 8, textAlign: "left" }}>
          MESSAGE FROM OPINIO
        </p>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 24, lineHeight: 1.4 }}>
          転職に、もっと真実を。
        </h2>

        <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Left: Avatar */}
          <div style={{ flexShrink: 0, width: 160 }}>
            <div style={{
              width: 160, height: 160, borderRadius: "50%",
              background: "#f5f5f5",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
              border: "1px solid #e8e4dc",
            }}>
              {/* Silhouette icon (replace with real photo when available) */}
              <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>柴 悠人</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>株式会社Opinio 代表</div>
              {/* Social links (optional) */}
              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10 }}>
                <a
                  href="https://x.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X"
                  style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff", border: "0.5px solid #e5e7eb", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#0f172a", textDecoration: "none" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://www.linkedin.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff", border: "0.5px solid #e5e7eb", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#0a66c2", textDecoration: "none" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z" />
                  </svg>
                </a>
                <a
                  href="https://note.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="note"
                  style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff", border: "0.5px solid #e5e7eb", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#41c9b4", textDecoration: "none" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Right: Body */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.95, margin: 0, whiteSpace: "pre-wrap" }}>
{`Opinio代表の柴悠人です。
新卒で株式会社リクルートに入社し4年、その後Salesforce Japanで6年営業を経験しました。

10年間のHR業界で見てきたのは、「情報の非対称性」に翻弄される候補者の姿。求人票に書けない事実、エージェントが言えない本音、面接では分からないカルチャーミスマッチ。

この課題を、テクノロジーと取材の力で解決したくて、2023年9月に株式会社Opinioを創業しました。

IT/SaaS業界に絞って120社以上を取材し、Opinioの独自見解をお届けしています。早期離職ゼロ。それが私たちの約束です。`}
            </p>
            <div style={{ marginTop: 20, fontSize: 13, color: "#0f172a", fontWeight: 500 }}>
              Opinio代表　柴 悠人
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
