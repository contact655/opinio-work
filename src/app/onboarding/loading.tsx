export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        {/* Step indicator */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 36 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer" style={{ width: i === 1 ? 28 : 10, height: 10, borderRadius: 100 }} />
          ))}
        </div>

        {/* Question card */}
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid var(--line)", padding: "36px 32px" }}>
          {/* Icon */}
          <div className="skeleton-shimmer" style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 20px" }} />

          {/* Question */}
          <div className="skeleton-shimmer" style={{ width: "70%", height: 24, borderRadius: 6, margin: "0 auto 8px" }} />
          <div className="skeleton-shimmer" style={{ width: "55%", height: 14, borderRadius: 4, margin: "0 auto 32px" }} />

          {/* Options */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-shimmer" style={{ width: "100%", height: 52, borderRadius: 12, marginBottom: 10 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
