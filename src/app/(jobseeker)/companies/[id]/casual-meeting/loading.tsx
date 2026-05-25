export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", padding: "40px 16px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Company header card */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "28px 28px", marginBottom: 20, border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div className="skeleton-shimmer" style={{ width: 56, height: 56, borderRadius: 12 }} />
            <div>
              <div className="skeleton-shimmer" style={{ width: 160, height: 18, borderRadius: 6, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: 100, height: 13, borderRadius: 4 }} />
            </div>
          </div>
        </div>

        {/* Form card */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "28px 28px", border: "1px solid var(--line)" }}>
          <div className="skeleton-shimmer" style={{ width: 200, height: 24, borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ width: "80%", height: 14, borderRadius: 4, marginBottom: 28 }} />

          {/* Theme select */}
          <div style={{ marginBottom: 20 }}>
            <div className="skeleton-shimmer" style={{ width: 120, height: 13, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ width: "100%", height: 42, borderRadius: 8 }} />
          </div>

          {/* Message textarea */}
          <div style={{ marginBottom: 20 }}>
            <div className="skeleton-shimmer" style={{ width: 100, height: 13, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ width: "100%", height: 120, borderRadius: 8 }} />
          </div>

          {/* Contact email */}
          <div style={{ marginBottom: 28 }}>
            <div className="skeleton-shimmer" style={{ width: 140, height: 13, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ width: "100%", height: 42, borderRadius: 8 }} />
          </div>

          {/* CTA */}
          <div className="skeleton-shimmer" style={{ width: "100%", height: 48, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );
}
