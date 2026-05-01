import Link from "next/link";

export type MeetingApplication = {
  id: string;
  candidateName: string;
  candidateInitial: string;
  candidateGradient: string;
  jobTitle: string | null;
  appliedAt: string;
  status: "pending" | "company_contacted" | "scheduled" | "declined";
};

const STATUS_LABELS: Record<MeetingApplication["status"], string> = {
  pending: "未対応",
  company_contacted: "連絡済み",
  scheduled: "日程調整中",
  declined: "辞退",
};

const STATUS_COLORS: Record<MeetingApplication["status"], { bg: string; color: string }> = {
  pending: { bg: "var(--warm-soft)", color: "#92400E" },
  company_contacted: { bg: "var(--royal-50)", color: "var(--royal)" },
  scheduled: { bg: "var(--purple-soft)", color: "var(--purple)" },
  declined: { bg: "var(--error-soft)", color: "var(--error)" },
};

type Props = { meetings: MeetingApplication[] };

export function PendingMeetings({ meetings }: Props) {
  return (
    <section style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "22px 26px",
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--line)",
      }}>
        <div style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: 15, fontWeight: 600, color: "var(--ink)",
          display: "flex", alignItems: "baseline", gap: 8,
        }}>
          カジュアル面談申込
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 9, fontWeight: 700,
            color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase",
          }}>Meetings</span>
        </div>
        <Link href="/biz/meetings" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
          すべて見る →
        </Link>
      </div>

      {meetings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--ink-mute)", fontSize: 13 }}>
          申込はありません
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {meetings.map((m) => {
            const sc = STATUS_COLORS[m.status];
            return (
              <div key={m.id} style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr auto",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--line-soft)",
                background: "var(--bg-tint)",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: m.candidateGradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: "#fff",
                  flexShrink: 0,
                }}>
                  {m.candidateInitial}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
                    {m.candidateName}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.jobTitle ? `${m.jobTitle}宛` : "求人なし"} · {m.appliedAt}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  padding: "3px 10px", borderRadius: 100,
                  background: sc.bg, color: sc.color,
                  whiteSpace: "nowrap",
                }}>
                  {STATUS_LABELS[m.status]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
