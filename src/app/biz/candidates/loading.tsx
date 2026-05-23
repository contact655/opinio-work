import { BusinessLayout } from "@/components/business/BusinessLayout";

export default function Loading() {
  return (
    <BusinessLayout userName="">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="skeleton-shimmer" style={{ height: 24, width: 160, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 13, width: 240, borderRadius: 4 }} />
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[80, 72, 88, 64, 80, 96].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 32, width: w, borderRadius: 16 }} />
          ))}
        </div>

        {/* Candidate cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "18px 20px",
            }}>
              {/* Avatar + name */}
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 14, width: "60%", borderRadius: 4, marginBottom: 6 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: "80%", borderRadius: 4 }} />
                </div>
              </div>
              {/* Tags */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                <div className="skeleton-shimmer" style={{ height: 20, width: 64, borderRadius: 100 }} />
                <div className="skeleton-shimmer" style={{ height: 20, width: 56, borderRadius: 100 }} />
                <div className="skeleton-shimmer" style={{ height: 20, width: 48, borderRadius: 100 }} />
              </div>
              {/* CTA */}
              <div className="skeleton-shimmer" style={{ height: 34, width: "100%", borderRadius: 8 }} />
            </div>
          ))}
        </div>
      </div>
    </BusinessLayout>
  );
}
