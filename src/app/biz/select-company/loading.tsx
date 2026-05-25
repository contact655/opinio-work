export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div className="skeleton-shimmer" style={{ width: 180, height: 26, borderRadius: 6, margin: "0 auto 8px" }} />
        <div className="skeleton-shimmer" style={{ width: 240, height: 14, borderRadius: 4, margin: "0 auto 28px" }} />

        {[1, 2, 3].map((i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--line)", padding: "16px 20px", marginBottom: 12, display: "flex", alignItems: "center", gap: 14 }}>
            <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-shimmer" style={{ width: "60%", height: 15, borderRadius: 4, marginBottom: 6 }} />
              <div className="skeleton-shimmer" style={{ width: "40%", height: 12, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
