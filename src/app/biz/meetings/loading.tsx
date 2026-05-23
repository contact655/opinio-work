import { BusinessLayout } from "@/components/business/BusinessLayout";

export default function Loading() {
  return (
    <BusinessLayout userName="">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div style={{ marginBottom: 4 }}>
          <div className="skeleton-shimmer" style={{ height: 24, width: 160, borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 13, width: 280, borderRadius: 4 }} />
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 8 }}>
          {[60, 80, 80, 80].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 34, width: w, borderRadius: 8 }} />
          ))}
        </div>

        {/* Meeting cards */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 14, padding: "18px 22px",
          }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <div className="skeleton-shimmer" style={{ height: 14, width: 80, borderRadius: 4 }} />
                  <div className="skeleton-shimmer" style={{ height: 14, width: 64, borderRadius: 100 }} />
                </div>
                <div className="skeleton-shimmer" style={{ height: 12, width: "50%", borderRadius: 4 }} />
              </div>
              <div className="skeleton-shimmer" style={{ height: 34, width: 90, borderRadius: 8, flexShrink: 0 }} />
            </div>
          </div>
        ))}
      </div>
    </BusinessLayout>
  );
}
