export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      {/* Page header skeleton */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "40px 48px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="skeleton-shimmer" style={{ height: 11, width: 80, marginBottom: 14, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ height: 36, width: 240, marginBottom: 14, borderRadius: 6 }} />
          <div className="skeleton-shimmer" style={{ height: 14, width: 360, borderRadius: 4 }} />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "12px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 8 }}>
          {[80, 90, 70, 80, 90].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 32, width: w, borderRadius: 100 }} />
          ))}
        </div>
      </div>

      {/* Article cards grid */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 48px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 16, overflow: "hidden",
            }}>
              {/* Eyecatch image area */}
              <div className="skeleton-shimmer" style={{ height: 180, width: "100%" }} />
              <div style={{ padding: "16px 18px 20px" }}>
                {/* Badge + read time */}
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <div className="skeleton-shimmer" style={{ height: 20, width: 64, borderRadius: 100 }} />
                  <div className="skeleton-shimmer" style={{ height: 20, width: 48, borderRadius: 100 }} />
                </div>
                {/* Title */}
                <div className="skeleton-shimmer" style={{ height: 16, width: "90%", borderRadius: 4, marginBottom: 8 }} />
                <div className="skeleton-shimmer" style={{ height: 16, width: "70%", borderRadius: 4, marginBottom: 14 }} />
                {/* Company + date */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="skeleton-shimmer" style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: 100, borderRadius: 4 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: 60, borderRadius: 4, marginLeft: "auto" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
