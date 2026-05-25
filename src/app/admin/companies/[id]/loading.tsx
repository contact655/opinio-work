export default function Loading() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="skeleton-shimmer" style={{ width: 60, height: 60, borderRadius: 12 }} />
        <div>
          <div className="skeleton-shimmer" style={{ width: 200, height: 22, borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 140, height: 14, borderRadius: 4 }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #e2e8f0" }}>
            <div className="skeleton-shimmer" style={{ width: 80, height: 12, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ width: 120, height: 20, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", border: "1px solid #e2e8f0" }}>
        <div className="skeleton-shimmer" style={{ width: 140, height: 18, borderRadius: 4, marginBottom: 16 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-shimmer" style={{ width: "100%", height: 14, borderRadius: 4, marginBottom: 8 }} />
        ))}
      </div>
    </div>
  );
}
