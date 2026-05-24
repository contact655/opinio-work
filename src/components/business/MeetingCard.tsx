"use client";

import type { MeetingApplication } from "@/lib/business/mockMeetings";
import { MeetingStatusBadge } from "./MeetingStatusBadge";

type Props = {
  meeting: MeetingApplication;
  isSelected: boolean;
  onClick: () => void;
};

export function MeetingCard({ meeting: m, isSelected, onClick }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${m.applicantName}の面談申請${m.isUnread ? "（未読）" : ""}`}
      aria-pressed={isSelected}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      style={{
        padding: isSelected ? "14px 20px 14px 17px" : "14px 20px",
        borderBottom: "1px solid var(--line)",
        cursor: "pointer",
        position: "relative",
        transition: "all 0.15s",
        borderLeft: isSelected ? "3px solid var(--royal)" : "3px solid transparent",
        background: isSelected ? "var(--royal-50)" : "#fff",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-tint)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#fff";
      }}
    >
      {/* 未読ドット */}
      {m.isUnread && (
        <div style={{
          position: "absolute",
          left: 6,
          top: "50%",
          transform: "translateY(-50%)",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--error)",
        }} />
      )}

      {/* Head: avatar + name + time */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 6,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: m.applicantGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 600,
          fontSize: 14,
          flexShrink: 0,
        }}>
          {m.applicantInitial}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
            {m.applicantName}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.5 }}>
            {m.applicantAge} · {m.applicantCurrentCompany} 在籍中
          </div>
        </div>

        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 10,
          color: "var(--ink-mute)",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {m.submittedAt}
        </div>
      </div>

      {/* 興味 */}
      <div style={{
        fontSize: 11,
        color: "var(--ink-soft)",
        paddingLeft: 46,
        marginTop: 2,
        lineHeight: 1.5,
      }}>
        興味：<strong style={{ color: "var(--royal)", fontWeight: 600 }}>
          {m.jobTitle ?? "企業全般（求人未指定）"}
        </strong>
      </div>

      {/* タグ行 */}
      <div style={{
        paddingLeft: 46,
        marginTop: 6,
        display: "flex",
        alignItems: "center",
        gap: 5,
        flexWrap: "wrap",
      }}>
        <MeetingStatusBadge status={m.status} size="sm" />
        {m.assigneeId ? (
          <span style={{
            padding: "2px 7px",
            borderRadius: 3,
            fontFamily: "'Inter', sans-serif",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.05em",
            background: "#EEF2FF",
            color: "var(--accent)",
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            {m.assigneeName}
          </span>
        ) : (
          <span style={{
            padding: "2px 7px",
            borderRadius: 3,
            fontFamily: "'Inter', sans-serif",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.05em",
            background: "var(--line-soft)",
            color: "var(--ink-mute)",
          }}>
            未アサイン
          </span>
        )}

        {/* 詳細を見る CTA — hover時に右側に表示 */}
        <span style={{
          marginLeft: "auto",
          fontSize: 10,
          fontWeight: 600,
          color: isSelected ? "var(--royal)" : "var(--ink-mute)",
          display: "flex",
          alignItems: "center",
          gap: 2,
          whiteSpace: "nowrap",
          opacity: isSelected ? 1 : 0.7,
          transition: "opacity 0.15s",
        }}>
          詳細
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>
      </div>
    </div>
  );
}
