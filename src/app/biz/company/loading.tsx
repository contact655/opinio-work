import { BusinessLayout } from "@/components/business/BusinessLayout";

export default function Loading() {
  return (
    <BusinessLayout userName="">
      <div style={{ display: "flex", gap: 24 }}>
        {/* Sidebar tabs */}
        <div style={{ width: 200, flexShrink: 0 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-shimmer" style={{
              height: 36, width: "100%", borderRadius: 8, marginBottom: 6,
            }} />
          ))}
        </div>

        {/* Main form area */}
        <div style={{ flex: 1 }}>
          {/* Section header */}
          <div className="skeleton-shimmer" style={{ height: 22, width: 160, borderRadius: 4, marginBottom: 24 }} />

          {/* Form fields */}
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              <div className="skeleton-shimmer" style={{ height: 13, width: 80, borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ height: 42, width: "100%", borderRadius: 8 }} />
            </div>
          ))}

          {/* Textarea */}
          <div style={{ marginBottom: 20 }}>
            <div className="skeleton-shimmer" style={{ height: 13, width: 100, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ height: 120, width: "100%", borderRadius: 8 }} />
          </div>

          {/* Photo grid */}
          <div>
            <div className="skeleton-shimmer" style={{ height: 13, width: 80, borderRadius: 4, marginBottom: 12 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton-shimmer" style={{ height: 120, borderRadius: 10 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </BusinessLayout>
  );
}
