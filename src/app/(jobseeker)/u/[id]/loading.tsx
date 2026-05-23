export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <style>{`
        .u-loading-grid {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .u-loading-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Cover + Avatar header — full width */}
        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 16, overflow: "hidden", marginBottom: 24,
        }}>
          <div className="skeleton-shimmer" style={{ height: 180, width: "100%" }} />
          <div style={{ padding: "0 32px 28px", marginTop: -56 }}>
            <div className="skeleton-shimmer" style={{
              width: 112, height: 112, borderRadius: "50%",
              border: "5px solid var(--bg-tint)", marginBottom: 16,
            }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div>
                <div className="skeleton-shimmer" style={{ height: 28, width: 200, borderRadius: 6, marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                  <div className="skeleton-shimmer" style={{ height: 14, width: 60, borderRadius: 4 }} />
                  <div className="skeleton-shimmer" style={{ height: 14, width: 80, borderRadius: 4 }} />
                </div>
                <div style={{ display: "flex", gap: 20 }}>
                  <div className="skeleton-shimmer" style={{ height: 13, width: 70, borderRadius: 4 }} />
                  <div className="skeleton-shimmer" style={{ height: 13, width: 60, borderRadius: 4 }} />
                </div>
              </div>
              <div className="skeleton-shimmer" style={{ height: 36, width: 140, borderRadius: 8, flexShrink: 0 }} />
            </div>
          </div>
        </div>

        {/* Two-column grid */}
        <div className="u-loading-grid">

          {/* Main column */}
          <div>
            {/* About Me */}
            <div style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "24px 28px", marginBottom: 20,
            }}>
              <div className="skeleton-shimmer" style={{ height: 18, width: 100, borderRadius: 4, marginBottom: 20 }} />
              <div className="skeleton-shimmer" style={{ height: 14, width: "100%", borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ height: 14, width: "88%", borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ height: 14, width: "72%", borderRadius: 4 }} />
            </div>

            {/* Timeline */}
            <div style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "24px 28px", marginBottom: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
                <div className="skeleton-shimmer" style={{ height: 18, width: 60, borderRadius: 4 }} />
                <div className="skeleton-shimmer" style={{ height: 11, width: 70, borderRadius: 4 }} />
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "64px 44px 1fr",
                  gap: 0, marginBottom: i < 3 ? 24 : 0, minHeight: 60,
                }}>
                  {/* Date col */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, paddingTop: 8, paddingRight: 8 }}>
                    <div className="skeleton-shimmer" style={{ height: 11, width: 42, borderRadius: 3 }} />
                    <div className="skeleton-shimmer" style={{ height: 11, width: 36, borderRadius: 3 }} />
                  </div>
                  {/* Icon */}
                  <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
                    <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: 7 }} />
                  </div>
                  {/* Content */}
                  <div style={{ paddingTop: 8, paddingLeft: 12, paddingBottom: 20 }}>
                    <div className="skeleton-shimmer" style={{ height: 16, width: "55%", borderRadius: 4, marginBottom: 6 }} />
                    <div className="skeleton-shimmer" style={{ height: 13, width: "38%", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Current company */}
            <div style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "18px 20px",
            }}>
              <div className="skeleton-shimmer" style={{ height: 11, width: 80, borderRadius: 3, marginBottom: 14 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 14, width: "80%", borderRadius: 4, marginBottom: 6 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: "60%", borderRadius: 4 }} />
                </div>
              </div>
            </div>

            {/* Skills */}
            <div style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "18px 20px",
            }}>
              <div className="skeleton-shimmer" style={{ height: 11, width: 50, borderRadius: 3, marginBottom: 14 }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[72, 56, 88, 64, 80].map((w, i) => (
                  <div key={i} className="skeleton-shimmer" style={{ height: 26, width: w, borderRadius: 100 }} />
                ))}
              </div>
            </div>

            {/* Social links */}
            <div style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "18px 20px",
            }}>
              <div className="skeleton-shimmer" style={{ height: 11, width: 50, borderRadius: 3, marginBottom: 14 }} />
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: 8 }} />
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
