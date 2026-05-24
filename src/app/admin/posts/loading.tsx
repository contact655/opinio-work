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
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="skeleton-shimmer" style={{ height: 24, width: 160, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 13, width: 200, borderRadius: 4 }} />
          </div>
          <div className="skeleton-shimmer" style={{ height: 36, width: 100, borderRadius: 8 }} />
        </div>

        {/* Card grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 12,
              overflow: "hidden",
            }}>
              {/* Card image area */}
              <div className="skeleton-shimmer" style={{ height: 160, width: "100%" }} />
              {/* Card content */}
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <div className="skeleton-shimmer" style={{ height: 18, width: 50, borderRadius: 100 }} />
                  <div className="skeleton-shimmer" style={{ height: 18, width: 60, borderRadius: 100 }} />
                </div>
                <div className="skeleton-shimmer" style={{ height: 16, width: "90%", borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton-shimmer" style={{ height: 16, width: "70%", borderRadius: 4, marginBottom: 14 }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="skeleton-shimmer" style={{ height: 12, width: 80, borderRadius: 4 }} />
                  <div className="skeleton-shimmer" style={{ height: 28, width: 60, borderRadius: 6 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
