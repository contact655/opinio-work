export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "64px 24px 96px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", gap: 8, marginBottom: 40 }}>
          <div className="skeleton-shimmer" style={{ height: 13, width: 40, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ height: 13, width: 8, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ height: 13, width: 100, borderRadius: 4 }} />
        </div>

        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <div className="skeleton-shimmer" style={{ height: 11, width: 60, borderRadius: 4, marginBottom: 16 }} />
          <div className="skeleton-shimmer" style={{ height: 40, width: "50%", borderRadius: 6, marginBottom: 20 }} />
          <div className="skeleton-shimmer" style={{ height: 17, width: "80%", borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 17, width: "60%", borderRadius: 4 }} />
        </div>

        {/* Mission card */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: "40px 40px",
          border: "1px solid var(--line)", marginBottom: 32,
        }}>
          <div className="skeleton-shimmer" style={{ height: 11, width: 70, borderRadius: 4, marginBottom: 12 }} />
          <div className="skeleton-shimmer" style={{ height: 26, width: "40%", borderRadius: 6, marginBottom: 16 }} />
          <div className="skeleton-shimmer" style={{ height: 15, width: "100%", borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 15, width: "90%", borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 15, width: "75%", borderRadius: 4 }} />
        </div>

        {/* Values card */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: "40px 40px",
          border: "1px solid var(--line)", marginBottom: 32,
        }}>
          <div className="skeleton-shimmer" style={{ height: 11, width: 60, borderRadius: 4, marginBottom: 20 }} />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              display: "flex", gap: 16, paddingBottom: i < 4 ? 20 : 0, marginBottom: i < 4 ? 20 : 0,
              borderBottom: i < 4 ? "1px solid var(--line-soft)" : "none",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--line)", flexShrink: 0, marginTop: 8 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton-shimmer" style={{ height: 15, width: "30%", borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton-shimmer" style={{ height: 14, width: "85%", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Sub-page nav */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 32 }}>
          {[1, 2].map((i) => (
            <div key={i} style={{
              background: "#fff", borderRadius: 14, padding: "24px 24px",
              border: "1px solid var(--line)",
            }}>
              <div className="skeleton-shimmer" style={{ height: 11, width: 60, borderRadius: 4, marginBottom: 10 }} />
              <div className="skeleton-shimmer" style={{ height: 16, width: "50%", borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ height: 13, width: "90%", borderRadius: 4, marginBottom: 6 }} />
              <div className="skeleton-shimmer" style={{ height: 13, width: "70%", borderRadius: 4, marginBottom: 14 }} />
              <div className="skeleton-shimmer" style={{ height: 13, width: 80, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
