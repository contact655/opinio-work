"use client";

import type { MeetingStatus } from "@/lib/business/mockMeetings";
import { STATUS_TABS } from "@/lib/business/mockMeetings";

const STATUS_COLORS: Record<MeetingStatus, { bg: string; border: string; color: string }> = {
  pending:           { bg: "#FFFBEB",             border: "#FCD34D", color: "var(--warm-ink)" },
  company_contacted: { bg: "var(--royal-50)",      border: "var(--royal)", color: "var(--royal)" },
  scheduled:         { bg: "var(--purple-soft)",   border: "var(--purple)", color: "var(--purple)" },
  completed:         { bg: "#F1F5F9",              border: "#94A3B8", color: "#475569" },
  declined:          { bg: "var(--error-soft)",    border: "var(--error)", color: "var(--error-ink)" },
};

type Props = {
  counts: Record<MeetingStatus, number>;
  activeStatus: MeetingStatus;
  onStatusChange: (s: MeetingStatus) => void;
};

export function MeetingStatusTabs({ counts, activeStatus, onStatusChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="面談ステータス"
      style={{
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
        const cfg = STATUS_COLORS[status];
        return (
          <button
            type="button"
            key={status}
            role="tab"
            aria-selected={active}
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
              border: `1px solid ${active ? cfg.border : "var(--line)"}`,
              background: active ? cfg.bg : "var(--bg-tint)",
              color: active ? cfg.color : "var(--ink-soft)",
            }}
          >
            {label}
            <span style={{
              fontFamily: "var(--font-inter), var(--font-noto)",
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
