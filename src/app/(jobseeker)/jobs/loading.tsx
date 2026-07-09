export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      {/* Page header skeleton */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "40px 48px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="skeleton-shimmer" style={{ height: 11, width: 120, marginBottom: 14, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ height: 36, width: 280, marginBottom: 14, borderRadius: 6 }} />
          <div className="skeleton-shimmer" style={{ height: 14, width: 400, borderRadius: 4 }} />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "12px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div className="skeleton-shimmer" style={{ height: 36, width: 220, borderRadius: 8 }} />
          {[80, 100, 90, 80].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 36, width: w, borderRadius: 8 }} />
          ))}
        </div>
      </div>

      {/* 2カラム器（サイドバー + 縦リスト） */}
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto", padding: "32px 20px 64px" }}
        className="px-5 py-6 md:px-12 md:py-8">
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}
          className="jobs-loading-layout">
          <style>{`
            @media (min-width: 1024px) {
              .jobs-loading-layout {
                display: grid !important;
                grid-template-columns: 220px minmax(0, 1fr);
                gap: 24px;
                align-items: start;
              }
            }
          `}</style>

          {/* Sidebar skeleton */}
          <div style={{ display: "none" }} className="jobs-loading-sidebar">
            <style>{`
              @media (min-width: 1024px) {
                .jobs-loading-sidebar { display: block !important; }
              }
            `}</style>
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid var(--line)", padding: "12px", overflow: "hidden" }}>
              <div className="skeleton-shimmer" style={{ height: 32, borderRadius: 6, marginBottom: 10 }} />
              {[100, 80, 90, 70, 85].map((w, i) => (
                <div key={i} className="skeleton-shimmer" style={{ height: 28, width: `${w}%`, borderRadius: 4, marginBottom: 6 }} />
              ))}
            </div>
          </div>

          {/* 縦リスト skeleton */}
          <div>
            {/* Count bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div className="skeleton-shimmer" style={{ height: 14, width: 100, borderRadius: 4 }} />
              <div className="skeleton-shimmer" style={{ height: 28, width: 90, borderRadius: 8 }} />
            </div>

            {/* リスト行 */}
            <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px",
                  borderBottom: i < 9 ? "1px solid var(--line-soft)" : "none",
                }}>
                  <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="skeleton-shimmer" style={{ height: 14, width: "70%", borderRadius: 4, marginBottom: 6 }} />
                    <div style={{ display: "flex", gap: 6, marginBottom: 5 }}>
                      <div className="skeleton-shimmer" style={{ height: 11, width: 80, borderRadius: 4 }} />
                      <div className="skeleton-shimmer" style={{ height: 11, width: 50, borderRadius: 100 }} />
                    </div>
                    <div className="skeleton-shimmer" style={{ height: 11, width: "55%", borderRadius: 4 }} />
                  </div>
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div className="skeleton-shimmer" style={{ width: 32, height: 32, borderRadius: "50%" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
