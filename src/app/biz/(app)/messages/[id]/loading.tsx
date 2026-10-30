"use client";

export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: "50%" }} />
          <div>
            <div className="skeleton-shimmer" style={{ width: 160, height: 16, borderRadius: 4, marginBottom: 6 }} />
            <div className="skeleton-shimmer" style={{ width: 100, height: 12, borderRadius: 4 }} />
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Remote message */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
          <div className="skeleton-shimmer" style={{ width: "50%", height: 64, borderRadius: "12px 12px 12px 4px" }} />
        </div>
        {/* Own message */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div className="skeleton-shimmer" style={{ width: "40%", height: 48, borderRadius: "12px 12px 4px 12px" }} />
        </div>
        {/* Remote message */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
          <div className="skeleton-shimmer" style={{ width: "60%", height: 88, borderRadius: "12px 12px 12px 4px" }} />
        </div>
      </div>

      {/* Reply input */}
      <div style={{ background: "#fff", borderTop: "1px solid var(--line)", padding: "16px 24px", display: "flex", gap: 12 }}>
        <div className="skeleton-shimmer" style={{ flex: 1, height: 44, borderRadius: 10 }} />
        <div className="skeleton-shimmer" style={{ width: 80, height: 44, borderRadius: 10 }} />
      </div>
    </div>
  );
}
