export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* Profile card */}
        <div style={{
          background: "#fff", borderRadius: 20, padding: "36px 36px",
          border: "1px solid var(--line)", marginBottom: 24,
        }}>
          {/* Avatar + name */}
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", marginBottom: 24 }}>
            <div className="skeleton-shimmer" style={{ width: 88, height: 88, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-shimmer" style={{ height: 26, width: "45%", borderRadius: 4, marginBottom: 10 }} />
              <div className="skeleton-shimmer" style={{ height: 14, width: "65%", borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ height: 14, width: "50%", borderRadius: 4 }} />
            </div>
          </div>

          {/* Bio */}
          <div className="skeleton-shimmer" style={{ height: 14, width: "100%", borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 14, width: "85%", borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 14, width: "70%", borderRadius: 4, marginBottom: 24 }} />

          {/* CTA */}
          <div className="skeleton-shimmer" style={{ height: 52, width: "100%", borderRadius: 12 }} />
        </div>

        {/* Themes section */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: "28px 28px",
          border: "1px solid var(--line)", marginBottom: 20,
        }}>
          <div className="skeleton-shimmer" style={{ height: 16, width: 120, borderRadius: 4, marginBottom: 16 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                display: "flex", gap: 12, padding: 14, borderRadius: 10,
                background: "var(--bg-tint)", border: "1px solid var(--line)",
              }}>
                <div className="skeleton-shimmer" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 14, width: "50%", borderRadius: 4, marginBottom: 6 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: "75%", borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Career section */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: "28px 28px",
          border: "1px solid var(--line)",
        }}>
          <div className="skeleton-shimmer" style={{ height: 16, width: 80, borderRadius: 4, marginBottom: 16 }} />
          {[1, 2].map((i) => (
            <div key={i} style={{
              display: "flex", gap: 14, paddingBottom: i < 2 ? 16 : 0, marginBottom: i < 2 ? 16 : 0,
              borderBottom: i < 2 ? "1px solid var(--line-soft)" : "none",
            }}>
              <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton-shimmer" style={{ height: 15, width: "45%", borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton-shimmer" style={{ height: 13, width: "30%", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
