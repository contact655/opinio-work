export default function Loading() {
  return (
    <div className="p-8">
      <div className="skeleton-shimmer" style={{ width: 60, height: 20, borderRadius: 4, marginBottom: 12 }} />
      <div className="skeleton-shimmer" style={{ width: 280, height: 26, borderRadius: 6, marginBottom: 8 }} />
      <div className="skeleton-shimmer" style={{ width: 180, height: 14, borderRadius: 4, marginBottom: 28 }} />

      <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", border: "1px solid #e2e8f0", marginBottom: 16 }}>
        <div className="skeleton-shimmer" style={{ width: 140, height: 18, borderRadius: 4, marginBottom: 16 }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
            <div className="skeleton-shimmer" style={{ width: 100, height: 13, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: 160, height: 13, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div className="skeleton-shimmer" style={{ width: 120, height: 36, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 120, height: 36, borderRadius: 8 }} />
      </div>
    </div>
  );
}
