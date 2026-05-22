export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", height: 80 }} />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 48px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: 20 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 14, width: "60%", borderRadius: 4, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 11, width: "40%", borderRadius: 4 }} />
                </div>
              </div>
              <div className="skeleton" style={{ height: 12, width: "100%", borderRadius: 4, marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 12, width: "75%", borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
