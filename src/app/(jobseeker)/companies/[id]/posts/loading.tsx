export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 48px 64px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[80, 8, 100].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 13, width: w, borderRadius: 4 }} />
          ))}
        </div>

        {/* Header */}
        <div className="skeleton-shimmer" style={{ height: 24, width: 200, borderRadius: 4, marginBottom: 24 }} />

        {/* Post cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <div className="skeleton-shimmer" style={{ height: 160, width: "100%" }} />
              <div style={{ padding: "14px 16px 18px" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <div className="skeleton-shimmer" style={{ height: 20, width: 56, borderRadius: 100 }} />
                </div>
                <div className="skeleton-shimmer" style={{ height: 15, width: "90%", borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton-shimmer" style={{ height: 15, width: "65%", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
