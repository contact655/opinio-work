import type { MeetingStatus } from "@/lib/business/mockMeetings";
import { STATUS_TABS } from "@/lib/business/mockMeetings";

type Props = {
  counts: Record<MeetingStatus, number>;
  activeStatus: MeetingStatus;
  onStatusChange: (s: MeetingStatus) => void;
};

export function MeetingStatusTabs({ counts, activeStatus, onStatusChange }: Props) {
  return (
    <div style={{
      padding: "10px 20px 8px",
      borderBottom: "1px solid var(--line)",
      display: "flex",
      gap: 3,
      overflowX: "auto",
      scrollbarWidth: "none",
    }}>
      {STATUS_TABS.map(({ status, label }) => {
        const active = status === activeStatus;
        const count = counts[status] ?? 0;
        return (
          <button
            key={status}
            onClick={() => onStatusChange(status)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 11px",
              borderRadius: 100,
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: "nowrap",
              cursor: "pointer",
              transition: "all 0.15s",
              border: `1px solid ${active ? "var(--royal)" : "var(--line)"}`,
              background: active ? "var(--royal)" : "var(--bg-tint)",
              color: active ? "#fff" : "var(--ink-soft)",
            }}
          >
            {label}
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 10,
              fontWeight: 700,
              opacity: 0.8,
            }}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
