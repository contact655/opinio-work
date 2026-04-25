import type { MonthlyStatsWithDelta } from "@/lib/business/dashboard";

const ITEMS: { key: keyof MonthlyStatsWithDelta["current"]; label: string }[] = [
  { key: "applications", label: "応募" },
  { key: "scouts",       label: "スカウト" },
  { key: "interviews",   label: "面接" },
  { key: "offers",       label: "内定" },
];

function formatDelta(delta: number) {
  if (delta === 0) return { text: "±0", color: "#9ca3af" };
  if (delta > 0) return { text: `+${delta}`, color: "#15803d" };
  return { text: `${delta}`, color: "#dc2626" };
}

export function StatsGrid({ stats }: { stats: MonthlyStatsWithDelta }) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>今月の採用サマリー</h2>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>前月比</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ITEMS.map((item) => {
          const value = stats.current[item.key];
          const delta = stats.delta[item.key];
          const d = formatDelta(delta);
          return (
            <div
              key={item.key}
              style={{
                background: "#fff",
                border: "0.5px solid #e5e7eb",
                borderRadius: 8,
                padding: "18px 16px",
              }}
            >
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{item.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {value}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: d.color }}>{d.text}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
