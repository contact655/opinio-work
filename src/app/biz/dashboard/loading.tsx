import { BusinessLayout } from "@/components/business/BusinessLayout";

export default function Loading() {
  return (
    <BusinessLayout userName="">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Stat cards */}
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

        {/* Main content area */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Pending meetings */}
            <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 24 }}>
              <div className="skeleton-shimmer" style={{ height: 18, width: 160, borderRadius: 4, marginBottom: 20 }} />
              {[1, 2, 3].map((i) => (
                <div key={i} style={{
                  display: "flex", gap: 12, paddingBottom: 16, marginBottom: i < 3 ? 16 : 0,
                  borderBottom: i < 3 ? "1px solid var(--line-soft)" : "none",
                }}>
                  <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-shimmer" style={{ height: 14, width: "50%", borderRadius: 4, marginBottom: 6 }} />
                    <div className="skeleton-shimmer" style={{ height: 12, width: "70%", borderRadius: 4 }} />
                  </div>
                  <div className="skeleton-shimmer" style={{ height: 28, width: 72, borderRadius: 8, flexShrink: 0 }} />
                </div>
              ))}
            </div>

            {/* Activity list */}
            <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 24 }}>
              <div className="skeleton-shimmer" style={{ height: 18, width: 120, borderRadius: 4, marginBottom: 20 }} />
              {[1, 2, 4, 5].map((i) => (
                <div key={i} style={{
                  display: "flex", gap: 12, paddingBottom: 14, marginBottom: 14,
                  borderBottom: "1px solid var(--line-soft)",
                }}>
                  <div className="skeleton-shimmer" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-shimmer" style={{ height: 13, width: "60%", borderRadius: 4, marginBottom: 5 }} />
                    <div className="skeleton-shimmer" style={{ height: 11, width: "40%", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Company card */}
            <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 20 }}>
              <div className="skeleton-shimmer" style={{ height: 48, width: 48, borderRadius: 12, marginBottom: 12 }} />
              <div className="skeleton-shimmer" style={{ height: 16, width: "70%", borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ height: 12, width: "90%", borderRadius: 4, marginBottom: 16 }} />
              <div className="skeleton-shimmer" style={{ height: 36, width: "100%", borderRadius: 8 }} />
            </div>

            {/* Team members */}
            <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 20 }}>
              <div className="skeleton-shimmer" style={{ height: 14, width: 80, borderRadius: 4, marginBottom: 16 }} />
              {[1, 2].map((i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < 2 ? 12 : 0 }}>
                  <div className="skeleton-shimmer" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-shimmer" style={{ height: 13, width: "50%", borderRadius: 4, marginBottom: 5 }} />
                    <div className="skeleton-shimmer" style={{ height: 11, width: "70%", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </BusinessLayout>
  );
}
