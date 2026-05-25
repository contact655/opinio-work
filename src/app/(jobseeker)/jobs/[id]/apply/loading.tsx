export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", padding: "40px 16px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Job header card */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", marginBottom: 20, border: "1px solid var(--line)" }}>
          <div className="skeleton-shimmer" style={{ width: 80, height: 12, borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ width: "70%", height: 22, borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 140, height: 13, borderRadius: 4 }} />
        </div>

        {/* Application form card */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "28px 28px", border: "1px solid var(--line)" }}>
          <div className="skeleton-shimmer" style={{ width: 180, height: 24, borderRadius: 6, marginBottom: 24 }} />

          {[1, 2, 3].map((i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              <div className="skeleton-shimmer" style={{ width: 120, height: 13, borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: "100%", height: i === 2 ? 140 : 42, borderRadius: 8 }} />
            </div>
          ))}

          <div className="skeleton-shimmer" style={{ width: "100%", height: 48, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );
}
