/**
 * Fix 19 (revised): Hiring policy
 * Displays company-published hiring principles as a checklist.
 *
 * Data shape (hiring_policy JSONB): string[]
 */

export function HiringPolicy({ data }: { data: unknown }) {
  if (!Array.isArray(data)) return null;
  const items = data.filter((x): x is string => typeof x === "string" && x.length > 0);
  if (items.length === 0) return null;

  return (
    <section style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>採用ポリシー</h2>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px 0" }}>
        企業が大事にしている採用方針です。
      </p>
      <ul style={{ display: "flex", flexDirection: "column", gap: 10, listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: "#f0fdf4", color: "#15803d",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginTop: 1,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.7 }}>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
