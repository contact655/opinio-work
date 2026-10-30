import { BusinessLayout } from "@/components/business/BusinessLayout";

export default function Loading() {
  return (
    <BusinessLayout userName="">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="skeleton-shimmer" style={{ height: 22, width: 120, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 13, width: 200, borderRadius: 4 }} />
          </div>
          <div className="skeleton-shimmer" style={{ height: 38, width: 120, borderRadius: 10 }} />
        </div>

        {/* Members list */}
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              display: "flex", gap: 14, alignItems: "center", padding: "16px 20px",
              borderBottom: i < 3 ? "1px solid var(--line-soft)" : "none",
            }}>
              <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton-shimmer" style={{ height: 14, width: "30%", borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton-shimmer" style={{ height: 12, width: "45%", borderRadius: 4 }} />
              </div>
              <div className="skeleton-shimmer" style={{ height: 22, width: 56, borderRadius: 100 }} />
            </div>
          ))}
        </div>

        {/* Pending invites */}
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 20 }}>
          <div className="skeleton-shimmer" style={{ height: 16, width: 140, borderRadius: 4, marginBottom: 16 }} />
          {[1, 2].map((i) => (
            <div key={i} style={{
              display: "flex", gap: 12, alignItems: "center", paddingBottom: i < 2 ? 12 : 0,
              marginBottom: i < 2 ? 12 : 0,
              borderBottom: i < 2 ? "1px solid var(--line-soft)" : "none",
            }}>
              <div className="skeleton-shimmer" style={{ height: 12, width: "50%", borderRadius: 4 }} />
              <div className="skeleton-shimmer" style={{ height: 20, width: 64, borderRadius: 100, marginLeft: "auto" }} />
            </div>
          ))}
        </div>
      </div>
    </BusinessLayout>
  );
}
