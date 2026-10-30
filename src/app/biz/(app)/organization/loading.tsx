import { BusinessLayout } from "@/components/business/BusinessLayout";

export default function Loading() {
  return (
    <BusinessLayout userName="">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div>
          <div className="skeleton-shimmer" style={{ height: 24, width: 160, borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 13, width: 260, borderRadius: 4 }} />
        </div>

        {/* Settings sections */}
        {[1, 2].map((section) => (
          <div key={section} style={{
            background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 28,
          }}>
            <div className="skeleton-shimmer" style={{ height: 18, width: 140, borderRadius: 4, marginBottom: 20 }} />
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ marginBottom: i < 3 ? 18 : 0 }}>
                <div className="skeleton-shimmer" style={{ height: 12, width: 80, borderRadius: 4, marginBottom: 8 }} />
                <div className="skeleton-shimmer" style={{ height: 40, width: "100%", borderRadius: 8 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </BusinessLayout>
  );
}
