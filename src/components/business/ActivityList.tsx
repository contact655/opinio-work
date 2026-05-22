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
        <div style={{ textAlign: "center", padding: "28px 16px" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "var(--royal-50)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
            アクティビティはありません
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.6, marginBottom: 14 }}>
            求人を公開したり面談を受け付けると<br />ここに活動履歴が表示されます
          </div>
          <a
            href="/biz/jobs/new"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "8px 16px", borderRadius: 8,
              fontSize: 12, fontWeight: 600,
              background: "var(--royal)", color: "#fff",
              textDecoration: "none",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            最初の求人を作成する →
          </a>
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
