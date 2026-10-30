export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", padding: "32px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="skeleton-shimmer" style={{ width: 200, height: 26, borderRadius: 6, marginBottom: 28 }} />

        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--line)", padding: "28px 32px" }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ marginBottom: 24 }}>
              <div className="skeleton-shimmer" style={{ width: i % 2 === 0 ? 100 : 140, height: 13, borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: "100%", height: i === 4 ? 160 : 42, borderRadius: 8 }} />
            </div>
          ))}
          <div className="skeleton-shimmer" style={{ width: 160, height: 44, borderRadius: 10, marginTop: 8 }} />
        </div>
      </div>
    </div>
  );
}
