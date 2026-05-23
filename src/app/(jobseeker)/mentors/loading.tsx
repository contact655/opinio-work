export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      {/* Page header skeleton */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "40px 48px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="skeleton-shimmer" style={{ height: 11, width: 120, marginBottom: 14, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ height: 36, width: 280, marginBottom: 14, borderRadius: 6 }} />
          <div className="skeleton-shimmer" style={{ height: 14, width: 400, borderRadius: 4 }} />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "12px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 8 }}>
          {[90, 80, 100, 80, 90, 70].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 32, width: w, borderRadius: 100 }} />
          ))}
        </div>
      </div>

      {/* Mentor cards grid */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 48px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 16, padding: "20px 22px",
            }}>
              {/* Avatar + name */}
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
                <div className="skeleton-shimmer" style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 15, width: "60%", borderRadius: 4, marginBottom: 7 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: "80%", borderRadius: 4 }} />
                </div>
              </div>
              {/* Bio */}
              <div className="skeleton-shimmer" style={{ height: 12, width: "100%", borderRadius: 4, marginBottom: 6 }} />
              <div className="skeleton-shimmer" style={{ height: 12, width: "85%", borderRadius: 4, marginBottom: 14 }} />
              {/* Tags */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                <div className="skeleton-shimmer" style={{ height: 22, width: 72, borderRadius: 100 }} />
                <div className="skeleton-shimmer" style={{ height: 22, width: 56, borderRadius: 100 }} />
                <div className="skeleton-shimmer" style={{ height: 22, width: 64, borderRadius: 100 }} />
              </div>
              {/* CTA button */}
              <div className="skeleton-shimmer" style={{ height: 36, width: "100%", borderRadius: 10 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
