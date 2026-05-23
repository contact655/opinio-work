export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* Profile header */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "32px 32px", border: "1px solid var(--line)", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div className="skeleton-shimmer" style={{ width: 80, height: 80, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-shimmer" style={{ height: 24, width: "40%", borderRadius: 4, marginBottom: 10 }} />
              <div className="skeleton-shimmer" style={{ height: 14, width: "60%", borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ height: 14, width: "45%", borderRadius: 4 }} />
            </div>
          </div>
          {/* Bio */}
          <div style={{ marginTop: 20 }}>
            <div className="skeleton-shimmer" style={{ height: 14, width: "100%", borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 14, width: "80%", borderRadius: 4 }} />
          </div>
        </div>

        {/* Career section */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", border: "1px solid var(--line)", marginBottom: 16 }}>
          <div className="skeleton-shimmer" style={{ height: 16, width: 80, borderRadius: 4, marginBottom: 20 }} />
          {[1, 2].map((i) => (
            <div key={i} style={{
              display: "flex", gap: 14, paddingBottom: i < 2 ? 20 : 0, marginBottom: i < 2 ? 20 : 0,
              borderBottom: i < 2 ? "1px solid var(--line-soft)" : "none",
            }}>
              <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton-shimmer" style={{ height: 15, width: "50%", borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton-shimmer" style={{ height: 13, width: "35%", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Skills */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", border: "1px solid var(--line)" }}>
          <div className="skeleton-shimmer" style={{ height: 16, width: 60, borderRadius: 4, marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[80, 64, 96, 72, 56, 88].map((w, i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 26, width: w, borderRadius: 100 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
