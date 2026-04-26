"use client";

import type { JobStatus } from "@/lib/business/mockJobs";
import type { JobStatusCounts } from "@/lib/business/mockJobs";

type SummaryCard = {
  status: JobStatus;
  label: string;
  urgent?: boolean;
};

const CARDS: SummaryCard[] = [
  { status: "published",      label: "公開中" },
  { status: "pending_review", label: "審査中" },
  { status: "draft",          label: "下書き" },
  { status: "rejected",       label: "差し戻し", urgent: true },
  { status: "private",        label: "非公開" },
];

type Props = {
  counts: JobStatusCounts;
  activeStatus: JobStatus | "all";
  onStatusClick: (status: JobStatus | "all") => void;
};

export function JobStatusSummary({ counts, activeStatus, onStatusClick }: Props) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 10,
      marginBottom: 24,
    }}>
      {CARDS.map((card) => {
        const isActive = activeStatus === card.status;
        const isUrgent = card.urgent && counts[card.status] > 0;
        return (
          <button
            key={card.status}
            onClick={() => onStatusClick(card.status)}
            style={{
              background: isActive ? "var(--royal-50)" : isUrgent ? "var(--error-soft)" : "#fff",
              border: `1px solid ${isActive ? "var(--royal)" : isUrgent ? "#FCA5A5" : "var(--line)"}`,
              borderRadius: 10,
              padding: "14px 16px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 8px rgba(15,23,42,0.04)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = isUrgent ? "#F87171" : "var(--royal-100)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                (e.currentTarget as HTMLButtonElement).style.borderColor = isUrgent ? "#FCA5A5" : "var(--line)";
              }
            }}
          >
            <div style={{
              fontSize: 11,
              color: isUrgent ? "var(--error)" : "var(--ink-soft)",
              fontWeight: isUrgent ? 600 : 400,
              marginBottom: 4,
            }}>
              {isUrgent ? `⚠ ${card.label}` : card.label}
            </div>
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 24,
              fontWeight: 700,
              color: isUrgent ? "var(--error)" : "var(--ink)",
              lineHeight: 1.2,
            }}>
              {counts[card.status]}
            </div>
          </button>
        );
      })}
    </div>
  );
}
