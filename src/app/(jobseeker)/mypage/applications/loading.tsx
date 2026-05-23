export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px 64px" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div className="skeleton-shimmer" style={{ height: 24, width: 120, borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 13, width: 200, borderRadius: 4 }} />
        </div>

        {/* Application cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "20px 24px",
            }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
                <div className="skeleton-shimmer" style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 16, width: "50%", borderRadius: 4, marginBottom: 8 }} />
                  <div className="skeleton-shimmer" style={{ height: 13, width: "70%", borderRadius: 4 }} />
                </div>
                <div className="skeleton-shimmer" style={{ height: 24, width: 72, borderRadius: 100, flexShrink: 0 }} />
              </div>
              <div className="skeleton-shimmer" style={{ height: 13, width: "40%", borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
