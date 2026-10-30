import { BusinessLayout } from "@/components/business/BusinessLayout";

export default function Loading() {
  return (
    <BusinessLayout userName="">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div style={{ marginBottom: 4 }}>
          <div className="skeleton-shimmer" style={{ height: 24, width: 140, borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 13, width: 240, borderRadius: 4 }} />
        </div>

        {/* Conversation list */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 14, padding: "16px 20px",
          }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                  <div className="skeleton-shimmer" style={{ height: 14, width: 80, borderRadius: 4 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: 120, borderRadius: 4 }} />
                </div>
                <div className="skeleton-shimmer" style={{ height: 12, width: "55%", borderRadius: 4 }} />
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="skeleton-shimmer" style={{ height: 11, width: 48, borderRadius: 4, marginBottom: 8 }} />
                <div className="skeleton-shimmer" style={{ height: 20, width: 20, borderRadius: "50%" }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </BusinessLayout>
  );
}
