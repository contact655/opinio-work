import { BusinessLayout } from "@/components/business/BusinessLayout";

export default function Loading() {
  return (
    <BusinessLayout userName="">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div>
          <div className="skeleton-shimmer" style={{ height: 24, width: 120, borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 13, width: 220, borderRadius: 4 }} />
        </div>

        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "20px 22px",
            }}>
              <div className="skeleton-shimmer" style={{ height: 12, width: 80, borderRadius: 4, marginBottom: 12 }} />
              <div className="skeleton-shimmer" style={{ height: 32, width: 64, borderRadius: 6, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ height: 10, width: 100, borderRadius: 4 }} />
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 24 }}>
          <div className="skeleton-shimmer" style={{ height: 18, width: 160, borderRadius: 4, marginBottom: 20 }} />
          <div className="skeleton-shimmer" style={{ height: 180, width: "100%", borderRadius: 8 }} />
        </div>

        {/* Table */}
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 24 }}>
          <div className="skeleton-shimmer" style={{ height: 18, width: 200, borderRadius: 4, marginBottom: 20 }} />
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              display: "flex", gap: 16, paddingBottom: 16, marginBottom: 16,
              borderBottom: i < 3 ? "1px solid var(--line-soft)" : "none",
            }}>
              <div className="skeleton-shimmer" style={{ height: 14, width: "30%", borderRadius: 4 }} />
              <div className="skeleton-shimmer" style={{ height: 14, width: "15%", borderRadius: 4 }} />
              <div className="skeleton-shimmer" style={{ height: 14, width: "15%", borderRadius: 4 }} />
              <div className="skeleton-shimmer" style={{ height: 14, width: "15%", borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </BusinessLayout>
  );
}
