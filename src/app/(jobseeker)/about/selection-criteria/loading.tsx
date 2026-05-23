export default function Loading() {
  return (
    <div className="pt-16 min-h-screen" style={{ background: "var(--bg-tint)" }}>
      <div className="max-w-[820px] mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: 32, paddingBottom: 64 }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[40, 8, 80, 8, 60].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 13, width: w, borderRadius: 4 }} />
          ))}
        </div>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div className="skeleton-shimmer" style={{ height: 12, width: 180, borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 28, width: "50%", borderRadius: 4, marginBottom: 10 }} />
          <div className="skeleton-shimmer" style={{ height: 15, width: "90%", borderRadius: 4, marginBottom: 6 }} />
          <div className="skeleton-shimmer" style={{ height: 15, width: "75%", borderRadius: 4 }} />
        </div>

        {/* 3-axis criteria */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, marginBottom: 20 }}>
          <div className="skeleton-shimmer" style={{ height: 18, width: 140, borderRadius: 4, marginBottom: 6 }} />
          <div className="skeleton-shimmer" style={{ height: 13, width: "60%", borderRadius: 4, marginBottom: 20 }} />
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              display: "flex", gap: 14, padding: 16, borderRadius: 12,
              background: "var(--bg-tint)", border: "1px solid var(--line)",
              marginBottom: i < 3 ? 14 : 0,
            }}>
              <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton-shimmer" style={{ height: 15, width: "35%", borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton-shimmer" style={{ height: 13, width: "80%", borderRadius: 4, marginBottom: 4 }} />
                <div className="skeleton-shimmer" style={{ height: 13, width: "65%", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Process steps */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, marginBottom: 20 }}>
          <div className="skeleton-shimmer" style={{ height: 18, width: 180, borderRadius: 4, marginBottom: 24 }} />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: "flex", gap: 16, paddingBottom: i < 4 ? 22 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div className="skeleton-shimmer" style={{ width: 32, height: 32, borderRadius: "50%" }} />
                {i < 4 && <div className="skeleton-shimmer" style={{ width: 2, flex: 1, minHeight: 30, marginTop: 4, marginBottom: 4 }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div className="skeleton-shimmer" style={{ height: 15, width: "40%", borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton-shimmer" style={{ height: 13, width: "75%", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
