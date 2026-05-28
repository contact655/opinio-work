import { BusinessLayout } from "@/components/business/BusinessLayout";

export default function Loading() {
  return (
    <BusinessLayout userName="">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Page header skeleton */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div className="skeleton-shimmer" style={{ height: 28, width: 180, borderRadius: 6, marginBottom: 6 }} />
            <div className="skeleton-shimmer" style={{ height: 12, width: 80, borderRadius: 4 }} />
          </div>
          <div style={{ flex: 1 }} />
          <div className="skeleton-shimmer" style={{ height: 36, width: 120, borderRadius: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 36, width: 150, borderRadius: 8 }} />
        </div>

        {/* View switcher skeleton */}
        <div className="skeleton-shimmer" style={{ height: 34, width: 160, borderRadius: 8 }} />

        {/* Source filter skeleton */}
        <div style={{ display: "flex", gap: 6 }}>
          {[80, 70, 90, 80, 100, 80].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 28, width: w, borderRadius: 100 }} />
          ))}
        </div>

        {/* Kanban columns skeleton */}
        <div style={{ display: "flex", gap: 12, overflowX: "hidden" }}>
          {[1, 2, 3].map((col) => (
            <div key={col} style={{ minWidth: 270, flex: "0 0 270px", display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Column header */}
              <div style={{
                padding: "8px 12px", background: "#fff",
                border: "1px solid var(--line)", borderRadius: 10,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <div className="skeleton-shimmer" style={{ width: 8, height: 8, borderRadius: "50%" }} />
                <div className="skeleton-shimmer" style={{ height: 13, width: 80, borderRadius: 4, flex: 1 }} />
                <div className="skeleton-shimmer" style={{ height: 18, width: 24, borderRadius: 100 }} />
              </div>

              {/* Cards */}
              {[1, 2, 3].map((card) => (
                <div key={card} style={{
                  background: "#fff", border: "1px solid var(--line)",
                  borderRadius: 10, padding: "12px 14px",
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className="skeleton-shimmer" style={{ height: 14, width: 100, borderRadius: 4 }} />
                    <div className="skeleton-shimmer" style={{ height: 20, width: 60, borderRadius: 100 }} />
                  </div>
                  <div className="skeleton-shimmer" style={{ height: 12, width: "80%", borderRadius: 4 }} />
                  <div className="skeleton-shimmer" style={{ height: 11, width: 60, borderRadius: 4 }} />
                  <div className="skeleton-shimmer" style={{ height: 28, width: "100%", borderRadius: 6 }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </BusinessLayout>
  );
}
