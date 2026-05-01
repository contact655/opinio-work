export type ActivityItem = {
  id: string;
  type: "application" | "meeting_scheduled" | "message" | "job_published" | "offer";
  body: string;
  time: string;
};

const DOT_COLORS: Record<ActivityItem["type"], string> = {
  application: "var(--warm)",
  meeting_scheduled: "var(--purple)",
  message: "var(--accent)",
  job_published: "var(--success)",
  offer: "var(--royal)",
};

type Props = { activities: ActivityItem[] };

export function ActivityList({ activities }: Props) {
  return (
    <section style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "22px 26px",
    }}>
      <div style={{
        fontFamily: "var(--font-noto-serif)",
        fontSize: 15, fontWeight: 600, color: "var(--ink)",
        display: "flex", alignItems: "baseline", gap: 8,
        marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--line)",
      }}>
        最近のアクティビティ
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 9, fontWeight: 700,
          color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase",
        }}>Activity</span>
      </div>

      {activities.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--ink-mute)", fontSize: 13 }}>
          アクティビティはありません
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {activities.map((a, i) => (
            <div key={a.id} style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr auto",
              alignItems: "start",
              gap: 10,
              paddingBottom: i < activities.length - 1 ? 12 : 0,
              marginBottom: i < activities.length - 1 ? 12 : 0,
              borderBottom: i < activities.length - 1 ? "1px solid var(--line-soft)" : "none",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: `${DOT_COLORS[a.type]}20`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: DOT_COLORS[a.type],
                }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                {a.body}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap", marginTop: 2 }}>
                {a.time}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
