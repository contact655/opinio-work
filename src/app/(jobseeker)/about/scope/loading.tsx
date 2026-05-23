export default function Loading() {
  return (
    <div className="pt-16 min-h-screen" style={{ background: "var(--bg-tint)" }}>
      <div className="max-w-[820px] mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: 32, paddingBottom: 64 }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[40, 8, 80, 8, 64].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 13, width: w, borderRadius: 4 }} />
          ))}
        </div>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div className="skeleton-shimmer" style={{ height: 12, width: 120, borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 28, width: "55%", borderRadius: 4, marginBottom: 10 }} />
          <div className="skeleton-shimmer" style={{ height: 15, width: "85%", borderRadius: 4, marginBottom: 6 }} />
          <div className="skeleton-shimmer" style={{ height: 15, width: "70%", borderRadius: 4 }} />
        </div>

        {/* In-scope section */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, marginBottom: 16 }}>
          <div className="skeleton-shimmer" style={{ height: 18, width: 140, borderRadius: 4, marginBottom: 16 }} />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < 5 ? 14 : 0 }}>
              <div className="skeleton-shimmer" style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton-shimmer" style={{ height: 14, width: "35%", borderRadius: 4, marginBottom: 4 }} />
                <div className="skeleton-shimmer" style={{ height: 13, width: "70%", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Out-of-scope section */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, marginBottom: 24 }}>
          <div className="skeleton-shimmer" style={{ height: 18, width: 120, borderRadius: 4, marginBottom: 16 }} />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < 4 ? 10 : 0 }}>
              <div className="skeleton-shimmer" style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0 }} />
              <div className="skeleton-shimmer" style={{ height: 13, width: "25%", borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
