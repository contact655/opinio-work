export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "56px 24px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 48, textAlign: "center" }}>
          <div className="skeleton-shimmer" style={{ height: 36, width: "50%", borderRadius: 6, margin: "0 auto 16px" }} />
          <div className="skeleton-shimmer" style={{ height: 16, width: "70%", borderRadius: 4, margin: "0 auto 8px" }} />
          <div className="skeleton-shimmer" style={{ height: 16, width: "55%", borderRadius: 4, margin: "0 auto" }} />
        </div>

        {/* Case cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 16, padding: "28px 32px",
            }}>
              <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
                <div className="skeleton-shimmer" style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 20, width: "50%", borderRadius: 4, marginBottom: 8 }} />
                  <div className="skeleton-shimmer" style={{ height: 14, width: "40%", borderRadius: 4 }} />
                </div>
                <div className="skeleton-shimmer" style={{ height: 24, width: 80, borderRadius: 100 }} />
              </div>
              <div className="skeleton-shimmer" style={{ height: 15, width: "100%", borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ height: 15, width: "85%", borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ height: 15, width: "70%", borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
