export default function Loading() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Admin header bar */}
      <div style={{
        background: "#002366",
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        <div className="skeleton-shimmer" style={{ height: 20, width: 80, borderRadius: 4, opacity: 0.4 }} />
        <div className="skeleton-shimmer" style={{ height: 14, width: 48, borderRadius: 100, opacity: 0.3 }} />
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", width: "100%" }}>
        {/* Page title */}
        <div style={{ marginBottom: 24 }}>
          <div className="skeleton-shimmer" style={{ height: 24, width: 160, borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 13, width: 240, borderRadius: 4 }} />
        </div>

        {/* Search bar */}
        <div style={{ marginBottom: 20 }}>
          <div className="skeleton-shimmer" style={{ height: 40, width: "100%", borderRadius: 8 }} />
        </div>

        {/* Table */}
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
            gap: 16,
            padding: "14px 20px",
            background: "#f8fafc",
            borderBottom: "1px solid var(--line)",
          }}>
            {[140, 80, 80, 80, 80].map((w, i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 12, width: w, borderRadius: 4 }} />
            ))}
          </div>

          {/* Table rows */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
              gap: 16,
              padding: "16px 20px",
              borderBottom: i < 6 ? "1px solid var(--line-soft)" : "none",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="skeleton-shimmer" style={{ height: 32, width: 32, borderRadius: 8, flexShrink: 0 }} />
                <div className="skeleton-shimmer" style={{ height: 14, width: 120, borderRadius: 4 }} />
              </div>
              <div className="skeleton-shimmer" style={{ height: 13, width: 70, borderRadius: 4 }} />
              <div className="skeleton-shimmer" style={{ height: 20, width: 60, borderRadius: 100 }} />
              <div className="skeleton-shimmer" style={{ height: 13, width: 60, borderRadius: 4 }} />
              <div className="skeleton-shimmer" style={{ height: 28, width: 64, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
