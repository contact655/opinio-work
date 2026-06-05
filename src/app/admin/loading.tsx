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
        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 12, padding: "18px 20px",
            }}>
              <div className="skeleton-shimmer" style={{ height: 12, width: 80, borderRadius: 4, marginBottom: 10 }} />
              <div className="skeleton-shimmer" style={{ height: 28, width: 56, borderRadius: 6 }} />
            </div>
          ))}
        </div>

        {/* Content grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {[1, 2].map((card) => (
            <div key={card} style={{
              background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 20,
            }}>
              <div className="skeleton-shimmer" style={{ height: 18, width: 140, borderRadius: 4, marginBottom: 18 }} />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{
                  display: "flex", gap: 10, paddingBottom: 12, marginBottom: 12,
                  borderBottom: i < 5 ? "1px solid var(--line-soft)" : "none",
                }}>
                  <div className="skeleton-shimmer" style={{ height: 13, width: "50%", borderRadius: 4 }} />
                  <div className="skeleton-shimmer" style={{ height: 13, width: "25%", borderRadius: 4, marginLeft: "auto" }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
