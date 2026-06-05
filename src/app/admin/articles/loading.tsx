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
        background: "var(--royal)",
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
          <div className="skeleton-shimmer" style={{ height: 24, width: 120, borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 13, width: 220, borderRadius: 4 }} />
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
            gridTemplateColumns: "3fr 1.5fr 1fr 1fr 1fr",
            gap: 16,
            padding: "14px 20px",
            background: "#f8fafc",
            borderBottom: "1px solid var(--line)",
          }}>
            {[160, 100, 70, 70, 70].map((w, i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 12, width: w, borderRadius: 4 }} />
            ))}
          </div>

          {/* Table rows */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              display: "grid",
              gridTemplateColumns: "3fr 1.5fr 1fr 1fr 1fr",
              gap: 16,
              padding: "16px 20px",
              borderBottom: i < 4 ? "1px solid var(--line-soft)" : "none",
              alignItems: "center",
            }}>
              <div>
                <div className="skeleton-shimmer" style={{ height: 14, width: 220, borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton-shimmer" style={{ height: 11, width: 140, borderRadius: 4 }} />
              </div>
              <div className="skeleton-shimmer" style={{ height: 13, width: 100, borderRadius: 4 }} />
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
