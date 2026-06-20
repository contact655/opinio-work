export default function PeopleLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      {/* ヘッダースケルトン */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, #002366 60%, #0f3280 100%)",
        padding: "48px 24px 40px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ width: 60, height: 14, background: "rgba(255,255,255,0.15)", borderRadius: 4, marginBottom: 12 }} />
          <div style={{ width: 200, height: 36, background: "rgba(255,255,255,0.15)", borderRadius: 6, marginBottom: 12 }} />
          <div style={{ width: 380, height: 16, background: "rgba(255,255,255,0.1)", borderRadius: 4 }} />
        </div>
      </div>

      {/* カードスケルトン */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 24px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[80, 120, 100].map((w, i) => (
            <div key={i} style={{ width: w, height: 32, background: "var(--line)", borderRadius: 100 }} />
          ))}
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "24px 20px 20px",
            }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, background: "var(--line)", borderRadius: 6 }} />
              </div>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--line)", marginBottom: 14 }} />
              <div style={{ width: "60%", height: 16, background: "var(--line)", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ width: "80%", height: 12, background: "var(--line-soft)", borderRadius: 4, marginBottom: 6 }} />
              <div style={{ width: "50%", height: 12, background: "var(--line-soft)", borderRadius: 4, marginBottom: 20 }} />
              <div style={{ height: 38, background: "var(--line-soft)", borderRadius: 8 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
