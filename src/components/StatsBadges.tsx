/**
 * Fix 8 (b): Stats badges (interview count, zero turnover, etc.)
 * Server-fetched values are passed via props; falls back to defaults if missing.
 */

export type SiteStat = {
  key: string;
  value: number;
  label: string;
  unit?: string;
  note?: string;
  emoji?: string;
};

const DEFAULT_STATS: SiteStat[] = [
  { key: "interviewed_companies", value: 120, unit: "社+", label: "取材実績", emoji: "📊" },
  { key: "early_turnover", value: 0, unit: "件", label: "創業以来の早期離職", emoji: "🎯", note: "※2023年9月の創業以降、2026年4月現在まで200名以上の転職支援実績" },
  { key: "support_count", value: 200, unit: "名+", label: "相談・転職支援実績", emoji: "👥" },
  { key: "approved_companies", value: 25, unit: "社", label: "審査通過企業", emoji: "🌟" },
];

export function StatsBadges({ stats }: { stats?: SiteStat[] | null }) {
  const list = (stats && stats.length > 0 ? stats : DEFAULT_STATS).slice(0, 4);

  return (
    <section style={{ background: "#fff", paddingTop: 56, paddingBottom: 56 }}>
      <div className="max-w-5xl mx-auto px-8">
        <p style={{ fontSize: 12, color: "#1D9E75", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 8, textAlign: "center" }}>
          OUR TRACK RECORD
        </p>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", textAlign: "center", marginBottom: 28 }}>
          数字で見るOpinio
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {list.map((s) => (
            <div
              key={s.key}
              style={{
                background: "#fafaf7",
                border: "0.5px solid #e8e4dc",
                borderRadius: 14,
                padding: "20px 16px",
                textAlign: "center",
              }}
            >
              {s.emoji && <div style={{ fontSize: 22, marginBottom: 6 }}>{s.emoji}</div>}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: "#1D9E75", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {s.value.toLocaleString()}
                </span>
                {s.unit && (
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1D9E75" }}>{s.unit}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.5 }}>{s.label}</div>
              {s.note && (
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6, lineHeight: 1.4 }}>{s.note}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
