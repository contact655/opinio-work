export default function CareerTrajectoriesLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", padding: "40px 16px 80px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header skeleton */}
        <div className="skeleton-shimmer" style={{ height: 32, width: 260, borderRadius: 8, marginBottom: 8 }} />
        <div className="skeleton-shimmer" style={{ height: 18, width: 380, borderRadius: 6, marginBottom: 32 }} />

        {/* Cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{
              background: "#fff", borderRadius: 16, border: "1px solid var(--line)",
              padding: 20, display: "flex", flexDirection: "column", gap: 12,
            }}>
              {/* Avatar + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="skeleton-shimmer" style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 16, width: "70%", borderRadius: 6, marginBottom: 6 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: "50%", borderRadius: 4 }} />
                </div>
              </div>
              {/* Steps */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 8 }}>
                {[1, 2, 3].map((j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="skeleton-shimmer" style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0 }} />
                    <div className="skeleton-shimmer" style={{ height: 12, width: `${60 + j * 10}%`, borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
