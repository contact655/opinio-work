export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      {/* Eyecatch */}
      <div className="skeleton-shimmer" style={{ height: 420, width: "100%", borderRadius: 0 }} />

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Badge + read time */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div className="skeleton-shimmer" style={{ height: 24, width: 80, borderRadius: 100 }} />
          <div className="skeleton-shimmer" style={{ height: 24, width: 56, borderRadius: 100 }} />
        </div>

        {/* Title */}
        <div className="skeleton-shimmer" style={{ height: 36, width: "90%", borderRadius: 6, marginBottom: 10 }} />
        <div className="skeleton-shimmer" style={{ height: 36, width: "65%", borderRadius: 6, marginBottom: 24 }} />

        {/* Author */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 36 }}>
          <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0 }} />
          <div>
            <div className="skeleton-shimmer" style={{ height: 14, width: 100, borderRadius: 4, marginBottom: 6 }} />
            <div className="skeleton-shimmer" style={{ height: 12, width: 80, borderRadius: 4 }} />
          </div>
        </div>

        {/* Article body */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[100, 95, 85, 100, 90, 70, 100, 95, 80, 60].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 15, width: `${w}%`, borderRadius: 4 }} />
          ))}

          {/* Sub-heading */}
          <div className="skeleton-shimmer" style={{ height: 22, width: "50%", borderRadius: 4, marginTop: 12, marginBottom: 4 }} />

          {[100, 90, 85, 95, 75].map((w, i) => (
            <div key={i + 10} className="skeleton-shimmer" style={{ height: 15, width: `${w}%`, borderRadius: 4 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
