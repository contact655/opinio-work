export default function Loading() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div className="skeleton-shimmer" style={{ height: 22, width: 160, borderRadius: 4, marginBottom: 8 }} />
        <div className="skeleton-shimmer" style={{ height: 13, width: 240, borderRadius: 4 }} />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <div className="skeleton-shimmer" style={{ height: 36, width: 200, borderRadius: 8 }} />
        {[80, 80, 90, 80].map((w, i) => (
          <div key={i} className="skeleton-shimmer" style={{ height: 36, width: w, borderRadius: 8 }} />
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr", gap: 0, padding: "12px 20px", borderBottom: "1px solid var(--line)", background: "var(--bg-tint)" }}>
          {[120, 100, 80, 80, 60].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 12, width: w, borderRadius: 4 }} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr", gap: 0,
            padding: "14px 20px", borderBottom: i < 7 ? "1px solid var(--line-soft)" : "none",
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="skeleton-shimmer" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
              <div className="skeleton-shimmer" style={{ height: 13, width: "60%", borderRadius: 4 }} />
            </div>
            <div className="skeleton-shimmer" style={{ height: 13, width: "70%", borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ height: 20, width: 60, borderRadius: 100 }} />
            <div className="skeleton-shimmer" style={{ height: 13, width: "60%", borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ height: 28, width: 56, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
