export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "56px 24px 80px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div className="skeleton-shimmer" style={{ height: 36, width: "55%", borderRadius: 6, margin: "0 auto 16px" }} />
          <div className="skeleton-shimmer" style={{ height: 16, width: "65%", borderRadius: 4, margin: "0 auto" }} />
        </div>

        {/* Mentor cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 16, padding: "20px 22px",
            }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                <div className="skeleton-shimmer" style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 15, width: "70%", borderRadius: 4, marginBottom: 6 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: "85%", borderRadius: 4 }} />
                </div>
              </div>
              <div className="skeleton-shimmer" style={{ height: 13, width: "100%", borderRadius: 4, marginBottom: 6 }} />
              <div className="skeleton-shimmer" style={{ height: 13, width: "80%", borderRadius: 4, marginBottom: 14 }} />
              <div className="skeleton-shimmer" style={{ height: 38, width: "100%", borderRadius: 10 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
