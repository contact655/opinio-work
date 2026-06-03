export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", padding: "40px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Mentor header */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "28px 28px", marginBottom: 20, border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div className="skeleton-shimmer" style={{ width: 72, height: 72, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-shimmer" style={{ width: 160, height: 22, borderRadius: 6, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: "60%", height: 14, borderRadius: 4, marginBottom: 6 }} />
              <div className="skeleton-shimmer" style={{ width: "40%", height: 13, borderRadius: 4 }} />
            </div>
          </div>
        </div>

        {/* Reserve form */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "28px 28px", border: "1px solid var(--line)" }}>
          <div className="skeleton-shimmer" style={{ width: 220, height: 24, borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ width: "75%", height: 14, borderRadius: 4, marginBottom: 28 }} />

          {/* Theme chips */}
          <div style={{ marginBottom: 24 }}>
            <div className="skeleton-shimmer" style={{ width: 100, height: 13, borderRadius: 4, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[90, 140, 110, 120].map((w, i) => (
                <div key={i} className="skeleton-shimmer" style={{ width: w, height: 34, borderRadius: 100 }} />
              ))}
            </div>
          </div>

          {/* Day checkboxes */}
          <div style={{ marginBottom: 24 }}>
            <div className="skeleton-shimmer" style={{ width: 130, height: 13, borderRadius: 4, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: 8 }} />
              ))}
            </div>
          </div>

          {/* Message */}
          <div style={{ marginBottom: 24 }}>
            <div className="skeleton-shimmer" style={{ width: 110, height: 13, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ width: "100%", height: 120, borderRadius: 8 }} />
          </div>

          {/* Email */}
          <div style={{ marginBottom: 28 }}>
            <div className="skeleton-shimmer" style={{ width: 140, height: 13, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ width: "100%", height: 42, borderRadius: 8 }} />
          </div>

          <div className="skeleton-shimmer" style={{ width: "100%", height: 52, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );
}
