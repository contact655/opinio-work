export default function Loading() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
    }}>
      {/* Header bar placeholder */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid var(--line)",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        <div className="skeleton-shimmer" style={{ height: 20, width: 80, borderRadius: 4 }} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <div className="skeleton-shimmer" style={{ height: 32, width: 80, borderRadius: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 32, width: 80, borderRadius: 8 }} />
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px", width: "100%" }}>
        {/* Cover + avatar area */}
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          {/* Cover */}
          <div className="skeleton-shimmer" style={{ height: 140, width: "100%" }} />
          {/* Avatar + name row */}
          <div style={{ padding: "0 24px 24px", marginTop: -36 }}>
            <div className="skeleton-shimmer" style={{ height: 72, width: 72, borderRadius: "50%", border: "3px solid #fff", marginBottom: 12 }} />
            <div className="skeleton-shimmer" style={{ height: 22, width: 160, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 14, width: 220, borderRadius: 4, marginBottom: 6 }} />
            <div className="skeleton-shimmer" style={{ height: 13, width: 140, borderRadius: 4 }} />
          </div>
        </div>

        {/* Content cards */}
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 16,
            padding: "24px",
            marginBottom: 16,
          }}>
            <div className="skeleton-shimmer" style={{ height: 18, width: 120, borderRadius: 4, marginBottom: 20 }} />
            {[1, 2].map((j) => (
              <div key={j} style={{
                display: "flex",
                gap: 12,
                paddingBottom: j < 2 ? 16 : 0,
                marginBottom: j < 2 ? 16 : 0,
                borderBottom: j < 2 ? "1px solid var(--line-soft)" : "none",
              }}>
                <div className="skeleton-shimmer" style={{ height: 40, width: 40, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 14, width: "50%", borderRadius: 4, marginBottom: 8 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: "80%", borderRadius: 4, marginBottom: 6 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: "60%", borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
