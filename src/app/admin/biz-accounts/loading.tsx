export default function Loading() {
  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 52, height: 20, background: "#E2E8F0", borderRadius: 4 }} />
          <div style={{ width: 180, height: 28, background: "#E2E8F0", borderRadius: 6 }} />
        </div>
        <div style={{ width: 380, height: 14, background: "#F1F5F9", borderRadius: 4 }} />
      </div>

      {/* Summary cards skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{
            background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14,
            padding: "20px 22px",
          }}>
            <div style={{ width: 48, height: 34, background: "#F1F5F9", borderRadius: 6, marginBottom: 10 }} />
            <div style={{ width: 80, height: 14, background: "#F1F5F9", borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ background: "#F8FAFC", height: 40, borderBottom: "1px solid #E2E8F0" }} />
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 16,
            padding: "14px 16px", borderBottom: "1px solid #F8FAFC",
          }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F1F5F9", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ width: 120, height: 13, background: "#F1F5F9", borderRadius: 4, marginBottom: 6 }} />
              <div style={{ width: 180, height: 11, background: "#F8FAFC", borderRadius: 4 }} />
            </div>
            <div style={{ width: 100, height: 13, background: "#F1F5F9", borderRadius: 4 }} />
            <div style={{ width: 80, height: 24, background: "#F1F5F9", borderRadius: 100 }} />
            <div style={{ width: 70, height: 13, background: "#F1F5F9", borderRadius: 4 }} />
            <div style={{ width: 80, height: 13, background: "#F1F5F9", borderRadius: 4 }} />
            <div style={{ width: 90, height: 24, background: "#F1F5F9", borderRadius: 100 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
