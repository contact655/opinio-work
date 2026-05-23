import { BusinessLayout } from "@/components/business/BusinessLayout";

export default function Loading() {
  return (
    <BusinessLayout userName="">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="skeleton-shimmer" style={{ height: 22, width: 140, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 13, width: 220, borderRadius: 4 }} />
          </div>
          <div className="skeleton-shimmer" style={{ height: 38, width: 120, borderRadius: 10 }} />
        </div>

        {/* Post cards */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 14, padding: "18px 22px",
          }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div className="skeleton-shimmer" style={{ width: 80, height: 56, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <div className="skeleton-shimmer" style={{ height: 20, width: 64, borderRadius: 100 }} />
                  <div className="skeleton-shimmer" style={{ height: 20, width: 48, borderRadius: 100 }} />
                </div>
                <div className="skeleton-shimmer" style={{ height: 15, width: "70%", borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton-shimmer" style={{ height: 13, width: "50%", borderRadius: 4 }} />
              </div>
              <div className="skeleton-shimmer" style={{ height: 11, width: 56, borderRadius: 4, flexShrink: 0 }} />
            </div>
          </div>
        ))}
      </div>
    </BusinessLayout>
  );
}
