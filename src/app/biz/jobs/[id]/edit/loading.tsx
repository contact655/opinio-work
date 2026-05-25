export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 840, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div className="skeleton-shimmer" style={{ width: 160, height: 26, borderRadius: 6, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ width: 220, height: 13, borderRadius: 4 }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="skeleton-shimmer" style={{ width: 80, height: 36, borderRadius: 8 }} />
            <div className="skeleton-shimmer" style={{ width: 80, height: 36, borderRadius: 8 }} />
          </div>
        </div>

        {/* Form area */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--line)", padding: "28px 32px" }}>
          {/* Section heading */}
          <div className="skeleton-shimmer" style={{ width: 140, height: 18, borderRadius: 4, marginBottom: 20 }} />

          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              <div className="skeleton-shimmer" style={{ width: i % 3 === 0 ? 100 : i % 3 === 1 ? 140 : 80, height: 13, borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: "100%", height: i === 5 ? 180 : i === 7 ? 120 : 42, borderRadius: 8 }} />
            </div>
          ))}

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
            <div className="skeleton-shimmer" style={{ width: 100, height: 40, borderRadius: 8 }} />
            <div className="skeleton-shimmer" style={{ width: 120, height: 40, borderRadius: 8 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
