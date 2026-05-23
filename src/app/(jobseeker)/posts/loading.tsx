export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "32px 48px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="skeleton-shimmer" style={{ height: 11, width: 100, borderRadius: 4, marginBottom: 14 }} />
          <div className="skeleton-shimmer" style={{ height: 30, width: 240, borderRadius: 6, marginBottom: 12 }} />
          <div className="skeleton-shimmer" style={{ height: 14, width: 360, borderRadius: 4 }} />
        </div>
      </div>

      {/* Post cards grid */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 48px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, overflow: "hidden",
            }}>
              {/* Thumbnail */}
              <div className="skeleton-shimmer" style={{ height: 160, width: "100%" }} />
              <div style={{ padding: "14px 16px 18px" }}>
                {/* Type badge + company */}
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <div className="skeleton-shimmer" style={{ height: 20, width: 56, borderRadius: 100 }} />
                  <div className="skeleton-shimmer" style={{ height: 20, width: 80, borderRadius: 4 }} />
                </div>
                {/* Title */}
                <div className="skeleton-shimmer" style={{ height: 15, width: "90%", borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton-shimmer" style={{ height: 15, width: "70%", borderRadius: 4, marginBottom: 12 }} />
                {/* Date */}
                <div className="skeleton-shimmer" style={{ height: 11, width: 80, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
