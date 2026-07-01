export default function CareerTrajectoryUserLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", padding: "40px 16px 80px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Back link skeleton */}
        <div className="skeleton-shimmer" style={{ height: 16, width: 120, borderRadius: 4, marginBottom: 28 }} />

        {/* Profile header */}
        <div style={{
          background: "#fff", borderRadius: 16, border: "1px solid var(--line)",
          padding: 24, marginBottom: 24, display: "flex", alignItems: "center", gap: 16,
        }}>
          <div className="skeleton-shimmer" style={{ width: 64, height: 64, borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton-shimmer" style={{ height: 22, width: 160, borderRadius: 6, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 14, width: 240, borderRadius: 4, marginBottom: 6 }} />
            <div className="skeleton-shimmer" style={{ height: 14, width: 180, borderRadius: 4 }} />
          </div>
        </div>

        {/* Timeline steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              background: "#fff", borderRadius: 14, border: "1px solid var(--line)", padding: 20,
            }}>
              {/* Company + period */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 16, width: `${40 + i * 12}%`, borderRadius: 4, marginBottom: 6 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: 100, borderRadius: 4 }} />
                </div>
                <div className="skeleton-shimmer" style={{ height: 20, width: 80, borderRadius: 100 }} />
              </div>
              {/* Description lines */}
              <div style={{ paddingLeft: 48 }}>
                <div className="skeleton-shimmer" style={{ height: 12, width: "90%", borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton-shimmer" style={{ height: 12, width: "75%", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
