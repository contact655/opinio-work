export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      {/* Hero */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "36px 48px 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Breadcrumb */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[40, 8, 60, 8, 80].map((w, i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 13, width: w, borderRadius: 4 }} />
            ))}
          </div>

          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            {/* Company logo */}
            <div className="skeleton-shimmer" style={{ width: 56, height: 56, borderRadius: 14, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-shimmer" style={{ height: 13, width: 120, borderRadius: 4, marginBottom: 10 }} />
              <div className="skeleton-shimmer" style={{ height: 30, width: "55%", borderRadius: 6, marginBottom: 14 }} />
              {/* Tags */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[72, 88, 64, 96, 80].map((w, i) => (
                  <div key={i} className="skeleton-shimmer" style={{ height: 24, width: w, borderRadius: 100 }} />
                ))}
              </div>
            </div>
            {/* Salary + apply */}
            <div style={{ flexShrink: 0, textAlign: "right" }}>
              <div className="skeleton-shimmer" style={{ height: 28, width: 120, borderRadius: 4, marginBottom: 12 }} />
              <div className="skeleton-shimmer" style={{ height: 44, width: 140, borderRadius: 10 }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 48px 64px", display: "grid", gridTemplateColumns: "1fr 300px", gap: 28 }}>
        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Catch copy */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, border: "1px solid var(--line)" }}>
            <div className="skeleton-shimmer" style={{ height: 22, width: "70%", borderRadius: 4, marginBottom: 14 }} />
            <div className="skeleton-shimmer" style={{ height: 14, width: "100%", borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 14, width: "90%", borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 14, width: "75%", borderRadius: 4 }} />
          </div>

          {/* Requirements */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, border: "1px solid var(--line)" }}>
            <div className="skeleton-shimmer" style={{ height: 18, width: 100, borderRadius: 4, marginBottom: 16 }} />
            <div className="skeleton-shimmer" style={{ height: 14, width: "100%", borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 14, width: "85%", borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 14, width: "65%", borderRadius: 4 }} />
          </div>

          {/* Selection process */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, border: "1px solid var(--line)" }}>
            <div className="skeleton-shimmer" style={{ height: 18, width: 120, borderRadius: 4, marginBottom: 20 }} />
            <div style={{ display: "flex", gap: 16 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ textAlign: "center", flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 36, width: 36, borderRadius: "50%", margin: "0 auto 8px" }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: "80%", borderRadius: 4, margin: "0 auto" }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Job details */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid var(--line)" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", paddingBottom: 12, marginBottom: 12,
                borderBottom: i < 5 ? "1px solid var(--line-soft)" : "none",
              }}>
                <div className="skeleton-shimmer" style={{ height: 12, width: 56, borderRadius: 4 }} />
                <div className="skeleton-shimmer" style={{ height: 12, width: 80, borderRadius: 4 }} />
              </div>
            ))}
          </div>

          {/* Apply button */}
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid var(--line)" }}>
            <div className="skeleton-shimmer" style={{ height: 48, width: "100%", borderRadius: 10 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
