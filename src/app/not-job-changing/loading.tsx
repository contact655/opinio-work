export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "56px 24px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div className="skeleton-shimmer" style={{ height: 11, width: 100, borderRadius: 4, marginBottom: 16 }} />
          <div className="skeleton-shimmer" style={{ height: 36, width: "60%", borderRadius: 6, marginBottom: 16 }} />
          <div className="skeleton-shimmer" style={{ height: 16, width: "85%", borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 16, width: "70%", borderRadius: 4 }} />
        </div>

        {/* Article cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "24px 28px",
            }}>
              <div className="skeleton-shimmer" style={{ height: 20, width: "65%", borderRadius: 4, marginBottom: 12 }} />
              <div className="skeleton-shimmer" style={{ height: 14, width: "90%", borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ height: 14, width: "75%", borderRadius: 4, marginBottom: 16 }} />
              <div className="skeleton-shimmer" style={{ height: 13, width: 80, borderRadius: 100 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
