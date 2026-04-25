/**
 * Fix 19 (revised): Selection process transparency
 * Displays company-published selection steps + summary.
 *
 * Data shape (selection_process JSONB):
 * {
 *   steps: [{ name, duration?, note? }],
 *   total_duration?: string,
 *   interview_count?: number,
 *   online_available?: boolean,
 * }
 */

type Step = {
  name: string;
  duration?: string;
  note?: string;
};

type SelectionProcessData = {
  steps?: Step[];
  total_duration?: string;
  interview_count?: number;
  online_available?: boolean;
};

export function SelectionProcess({ data }: { data: SelectionProcessData | null | undefined }) {
  if (!data || typeof data !== "object") return null;
  const steps = Array.isArray(data.steps) ? data.steps.filter((s) => s && s.name) : [];
  if (steps.length === 0) return null;

  return (
    <section style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>選考プロセス</h2>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 20px 0" }}>
        企業が公表している選考フローと所要期間です。
      </p>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 16 }}>
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <div key={i} style={{ display: "flex", gap: 14, position: "relative" }}>
              {/* Number + connecting line */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "#1D9E75", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                {!isLast && (
                  <div style={{ width: 2, flex: 1, background: "#e5e7eb", marginTop: 4, marginBottom: 4, minHeight: 24 }} />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingBottom: isLast ? 0 : 18 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: step.note ? 4 : 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{step.name}</div>
                  {step.duration && (
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{step.duration}</div>
                  )}
                </div>
                {step.note && (
                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{step.note}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {(data.total_duration || data.interview_count != null || data.online_available != null) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 14, borderTop: "0.5px solid #f3f4f6" }}>
          {data.total_duration && (
            <span style={{
              fontSize: 12, fontWeight: 500,
              padding: "5px 12px", borderRadius: 999,
              background: "#f9fafb", color: "#374151",
              border: "0.5px solid #e5e7eb",
            }}>
              所要期間: {data.total_duration}
            </span>
          )}
          {data.interview_count != null && data.interview_count > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 500,
              padding: "5px 12px", borderRadius: 999,
              background: "#f9fafb", color: "#374151",
              border: "0.5px solid #e5e7eb",
            }}>
              計{data.interview_count}回の面接
            </span>
          )}
          {data.online_available && (
            <span style={{
              fontSize: 12, fontWeight: 500,
              padding: "5px 12px", borderRadius: 999,
              background: "#f0fdf4", color: "#15803d",
              border: "0.5px solid #b7e4c7",
            }}>
              オンライン対応可
            </span>
          )}
        </div>
      )}
    </section>
  );
}
