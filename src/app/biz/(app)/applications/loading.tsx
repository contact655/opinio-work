import { BusinessLayout } from "@/components/business/BusinessLayout";

export default function Loading() {
  return (
    <BusinessLayout userName="">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div style={{ marginBottom: 4 }}>
          <div className="skeleton-shimmer" style={{ height: 24, width: 140, borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 13, width: 260, borderRadius: 4 }} />
        </div>

        {/* Filter row */}
        <div style={{ display: "flex", gap: 8 }}>
          {[100, 80, 90, 80].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 34, width: w, borderRadius: 8 }} />
          ))}
        </div>

        {/* Application cards */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 14, padding: "16px 22px",
          }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                  <div className="skeleton-shimmer" style={{ height: 14, width: 72, borderRadius: 4 }} />
                  <div className="skeleton-shimmer" style={{ height: 20, width: 56, borderRadius: 100 }} />
                </div>
                <div className="skeleton-shimmer" style={{ height: 12, width: "45%", borderRadius: 4 }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div className="skeleton-shimmer" style={{ height: 32, width: 88, borderRadius: 8 }} />
                <div className="skeleton-shimmer" style={{ height: 32, width: 88, borderRadius: 8 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </BusinessLayout>
  );
}
