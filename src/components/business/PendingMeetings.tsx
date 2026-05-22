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
        <div style={{ textAlign: "center", padding: "28px 16px" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "var(--warm-soft)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
            まだ申込がありません
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.6, marginBottom: 14 }}>
            カジュアル面談を受け付けることで<br />候補者からの申込が届きます
          </div>
          <Link
            href="/biz/company"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "8px 16px", borderRadius: 8,
              fontSize: 12, fontWeight: 600,
              background: "var(--warm-soft)", color: "#92400E",
              border: "1px solid #FDE68A", textDecoration: "none",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            企業情報を設定する →
          </Link>
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
