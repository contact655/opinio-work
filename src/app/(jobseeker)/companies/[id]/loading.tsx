export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      {/* Hero */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "40px 48px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            {/* Logo */}
            <div className="skeleton-shimmer" style={{ width: 72, height: 72, borderRadius: 16, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-shimmer" style={{ height: 14, width: 80, borderRadius: 4, marginBottom: 10 }} />
              <div className="skeleton-shimmer" style={{ height: 32, width: "45%", borderRadius: 6, marginBottom: 12 }} />
              <div className="skeleton-shimmer" style={{ height: 16, width: "65%", borderRadius: 4, marginBottom: 16 }} />
              {/* Tags */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[80, 72, 96, 64].map((w, i) => (
                  <div key={i} className="skeleton-shimmer" style={{ height: 26, width: w, borderRadius: 100 }} />
                ))}
              </div>
            </div>
            {/* CTA area */}
            <div style={{ flexShrink: 0 }}>
              <div className="skeleton-shimmer" style={{ height: 44, width: 160, borderRadius: 10 }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 48px 64px", display: "grid", gridTemplateColumns: "1fr 300px", gap: 28 }}>
        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Mission */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, border: "1px solid var(--line)" }}>
            <div className="skeleton-shimmer" style={{ height: 16, width: 80, borderRadius: 4, marginBottom: 16 }} />
            <div className="skeleton-shimmer" style={{ height: 24, width: "60%", borderRadius: 4, marginBottom: 14 }} />
            <div className="skeleton-shimmer" style={{ height: 14, width: "100%", borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 14, width: "85%", borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 14, width: "70%", borderRadius: 4 }} />
          </div>

          {/* Editor section */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, border: "1px solid var(--line)" }}>
            <div className="skeleton-shimmer" style={{ height: 16, width: 140, borderRadius: 4, marginBottom: 16 }} />
            {[1, 2].map((i) => (
              <div key={i} style={{
                display: "flex", gap: 14, padding: "16px 0",
                borderBottom: i < 2 ? "1px solid var(--line-soft)" : "none",
              }}>
                <div className="skeleton-shimmer" style={{ width: 6, height: 6, borderRadius: "50%", marginTop: 8, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 14, width: "30%", borderRadius: 4, marginBottom: 6 }} />
                  <div className="skeleton-shimmer" style={{ height: 13, width: "80%", borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Jobs section */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, border: "1px solid var(--line)" }}>
            <div className="skeleton-shimmer" style={{ height: 16, width: 60, borderRadius: 4, marginBottom: 16 }} />
            {[1, 2].map((i) => (
              <div key={i} style={{
                padding: "14px 0", borderBottom: i < 2 ? "1px solid var(--line-soft)" : "none",
              }}>
                <div className="skeleton-shimmer" style={{ height: 15, width: "55%", borderRadius: 4, marginBottom: 8 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="skeleton-shimmer" style={{ height: 22, width: 72, borderRadius: 100 }} />
                  <div className="skeleton-shimmer" style={{ height: 22, width: 64, borderRadius: 100 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Company info card */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid var(--line)" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", paddingBottom: 12, marginBottom: 12,
                borderBottom: i < 5 ? "1px solid var(--line-soft)" : "none",
              }}>
                <div className="skeleton-shimmer" style={{ height: 12, width: 60, borderRadius: 4 }} />
                <div className="skeleton-shimmer" style={{ height: 12, width: 80, borderRadius: 4 }} />
              </div>
            ))}
          </div>

          {/* CTA card */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid var(--line)" }}>
            <div className="skeleton-shimmer" style={{ height: 14, width: "70%", borderRadius: 4, marginBottom: 14 }} />
            <div className="skeleton-shimmer" style={{ height: 44, width: "100%", borderRadius: 10 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
