export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      {/* Header area */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "28px 40px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", gap: 20, alignItems: "center" }}>
          <div className="skeleton-shimmer" style={{ width: 64, height: 64, borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton-shimmer" style={{ height: 20, width: 140, marginBottom: 10, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ height: 13, width: 200, borderRadius: 4 }} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 40px" }}>
        {/* Profile completion widget skeleton */}
        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 16, padding: "20px 24px", marginBottom: 24,
        }}>
          <div className="skeleton-shimmer" style={{ height: 14, width: 160, marginBottom: 12, borderRadius: 4 }} />
          <div style={{ background: "var(--bg-tint)", borderRadius: 8, height: 8, marginBottom: 10 }}>
            <div className="skeleton-shimmer" style={{ height: 8, width: "60%", borderRadius: 8 }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 32, flex: 1, borderRadius: 8 }} />
            ))}
          </div>
        </div>

        {/* Tab bar skeleton */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[80, 110, 90, 80, 80].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 36, width: w, borderRadius: 8 }} />
          ))}
        </div>

        {/* Content cards skeleton */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 12, padding: "18px 22px",
            }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 14, width: "55%", marginBottom: 8, borderRadius: 4 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: "35%", marginBottom: 14, borderRadius: 4 }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <div className="skeleton-shimmer" style={{ height: 22, width: 70, borderRadius: 100 }} />
                    <div className="skeleton-shimmer" style={{ height: 22, width: 90, borderRadius: 100 }} />
                  </div>
                </div>
                <div className="skeleton-shimmer" style={{ height: 32, width: 80, borderRadius: 8, flexShrink: 0 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
