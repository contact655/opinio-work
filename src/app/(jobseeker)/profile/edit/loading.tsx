export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", display: "flex" }}>
      {/* Sidebar skeleton */}
      <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--line)", background: "#fff", padding: "24px 16px" }}>
        <div className="skeleton-shimmer" style={{ width: 80, height: 80, borderRadius: "50%", margin: "0 auto 16px" }} />
        <div className="skeleton-shimmer" style={{ width: "70%", height: 14, borderRadius: 4, margin: "0 auto 8px" }} />
        <div className="skeleton-shimmer" style={{ width: "50%", height: 12, borderRadius: 4, margin: "0 auto 24px" }} />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-shimmer" style={{ width: "90%", height: 36, borderRadius: 8, marginBottom: 8 }} />
        ))}
      </div>

      {/* Main content skeleton */}
      <div style={{ flex: 1, padding: "32px 40px", maxWidth: 680 }}>
        {/* Tab bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-shimmer" style={{ width: 80, height: 32, borderRadius: 100 }} />
          ))}
        </div>

        {/* Section title */}
        <div className="skeleton-shimmer" style={{ width: 180, height: 22, borderRadius: 6, marginBottom: 20 }} />

        {/* Form fields */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <div className="skeleton-shimmer" style={{ width: 120, height: 13, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ width: "100%", height: i === 3 ? 100 : 42, borderRadius: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
