export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "56px 24px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div className="skeleton-shimmer" style={{ height: 11, width: 60, borderRadius: 4, marginBottom: 16 }} />
          <div className="skeleton-shimmer" style={{ height: 36, width: "50%", borderRadius: 6, marginBottom: 16 }} />
          <div className="skeleton-shimmer" style={{ height: 16, width: "80%", borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 16, width: "65%", borderRadius: 4 }} />
        </div>

        {/* Industry cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 16, padding: "24px 24px",
            }}>
              <div className="skeleton-shimmer" style={{ height: 40, width: 40, borderRadius: 10, marginBottom: 14 }} />
              <div className="skeleton-shimmer" style={{ height: 18, width: "60%", borderRadius: 4, marginBottom: 10 }} />
              <div className="skeleton-shimmer" style={{ height: 13, width: "90%", borderRadius: 4, marginBottom: 6 }} />
              <div className="skeleton-shimmer" style={{ height: 13, width: "75%", borderRadius: 4, marginBottom: 18 }} />
              <div className="skeleton-shimmer" style={{ height: 13, width: 80, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
