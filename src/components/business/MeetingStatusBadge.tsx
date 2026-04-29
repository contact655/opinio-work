import type { MeetingStatus } from "@/lib/business/mockMeetings";

const STATUS_CONFIG: Record<MeetingStatus, { label: string; bg: string; color: string }> = {
  pending:           { label: "新規受信", bg: "var(--warm-soft)",   color: "#B45309" },
  company_contacted: { label: "確認中",   bg: "var(--royal-50)",   color: "var(--royal)" },
  scheduled:         { label: "面談予定", bg: "var(--purple-soft)", color: "var(--purple)" },
  completed:         { label: "完了",     bg: "var(--line-soft)",  color: "var(--ink-soft)" },
  declined:          { label: "見送り",   bg: "var(--error-soft)", color: "var(--error)" },
};

type Props = {
  status: MeetingStatus;
  size?: "sm" | "md";
};

export function MeetingStatusBadge({ status, size = "md" }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      padding: size === "sm" ? "2px 7px" : "3px 10px",
      borderRadius: 100,
      fontFamily: "'Inter', sans-serif",
      fontSize: size === "sm" ? 9 : 10,
      fontWeight: 700,
      letterSpacing: "0.05em",
      background: cfg.bg,
      color: cfg.color,
      whiteSpace: "nowrap",
      display: "inline-block",
    }}>
      {cfg.label}
    </span>
  );
}
