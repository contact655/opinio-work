export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      {/* Page header skeleton */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "40px 48px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="skeleton-shimmer" style={{ height: 11, width: 140, marginBottom: 14, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ height: 36, width: 200, marginBottom: 14, borderRadius: 6 }} />
          <div className="skeleton-shimmer" style={{ height: 14, width: 380, borderRadius: 4 }} />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "10px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div className="skeleton-shimmer" style={{ height: 38, width: 200, borderRadius: 8, flex: "1 1 200px", maxWidth: 260 }} />
          <div className="skeleton-shimmer" style={{ height: 38, width: 100, borderRadius: 8 }} />
          {[90, 90].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 38, width: w, borderRadius: 8 }} />
          ))}
        </div>
      </div>

      {/* Company cards grid */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 48px 64px" }}>
        {/* Count bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div className="skeleton-shimmer" style={{ height: 20, width: 100, borderRadius: 4 }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 16, padding: "20px 22px",
            }}>
              {/* Logo + name + industry */}
              <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
                <div className="skeleton-shimmer" style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 15, width: "65%", borderRadius: 4, marginBottom: 8 }} />
                  <div className="skeleton-shimmer" style={{ height: 11, width: "45%", borderRadius: 4 }} />
                </div>
              </div>
              {/* Tagline */}
              <div className="skeleton-shimmer" style={{ height: 12, width: "100%", borderRadius: 4, marginBottom: 6 }} />
              <div className="skeleton-shimmer" style={{ height: 12, width: "70%", borderRadius: 4, marginBottom: 14 }} />
              {/* Tags */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                <div className="skeleton-shimmer" style={{ height: 22, width: 80, borderRadius: 100 }} />
                <div className="skeleton-shimmer" style={{ height: 22, width: 60, borderRadius: 100 }} />
                <div className="skeleton-shimmer" style={{ height: 22, width: 70, borderRadius: 100 }} />
              </div>
              {/* Footer: job count + freshness */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div className="skeleton-shimmer" style={{ height: 13, width: 70, borderRadius: 4 }} />
                <div className="skeleton-shimmer" style={{ height: 13, width: 60, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
