import { BusinessLayout } from "@/components/business/BusinessLayout";

export default function Loading() {
  return (
    <BusinessLayout userName="">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="skeleton-shimmer" style={{ height: 24, width: 120, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 13, width: 200, borderRadius: 4 }} />
          </div>
          <div className="skeleton-shimmer" style={{ height: 40, width: 120, borderRadius: 10 }} />
        </div>

        {/* Job cards */}
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 14, padding: "20px 24px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div className="skeleton-shimmer" style={{ height: 16, width: "40%", borderRadius: 4, marginBottom: 8 }} />
                <div className="skeleton-shimmer" style={{ height: 13, width: "60%", borderRadius: 4 }} />
              </div>
              <div className="skeleton-shimmer" style={{ height: 26, width: 72, borderRadius: 100 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="skeleton-shimmer" style={{ height: 22, width: 80, borderRadius: 100 }} />
              <div className="skeleton-shimmer" style={{ height: 22, width: 64, borderRadius: 100 }} />
              <div className="skeleton-shimmer" style={{ height: 22, width: 56, borderRadius: 100 }} />
            </div>
          </div>
        ))}
      </div>
    </BusinessLayout>
  );
}
