"use client";

import { useState } from "react";
import type { MeetingApplication } from "@/lib/business/mockMeetings";
import type { BizApplication } from "@/lib/business/applications";
import { MeetingsClient } from "./MeetingsClient";
import { ApplicationsClient } from "../applications/ApplicationsClient";

type CurrentUser = {
  owUserId: string;
  name: string;
  initial: string;
  gradient: string;
};

type Props = {
  meetings: MeetingApplication[];
  applications: BizApplication[];
  tenantName: string;
  currentUser: CurrentUser;
  initialTab?: "meetings" | "applications";
};

function FunnelBar({
  meetingCount,
  appCount,
  hiredCount,
}: {
  meetingCount: number;
  appCount: number;
  hiredCount: number;
}) {
  const steps = [
    { label: "カジュアル面談", count: meetingCount, color: "var(--royal)", bg: "var(--royal-50)" },
    { label: "応募", count: appCount, color: "var(--accent)", bg: "#EEF2FF" },
    { label: "採用確定", count: hiredCount, color: "var(--success)", bg: "var(--success-soft)" },
  ];

  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      background: "#fff", borderBottom: "1px solid var(--line)",
      padding: "12px 24px", flexWrap: "wrap", gap: 0,
    }}>
      {steps.map((s, i) => (
        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            background: s.bg, borderRadius: 8, padding: "8px 20px",
            minWidth: 100,
          }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: "Inter" }}>
              {s.count}
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-soft)", fontWeight: 500, marginTop: 1 }}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              display: "flex", alignItems: "center", padding: "0 6px",
              color: "var(--ink-mute)", fontSize: 16, userSelect: "none",
            }}>
              →
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function PipelineClient({ meetings, applications, tenantName, currentUser, initialTab = "meetings" }: Props) {
  const [tab, setTab] = useState<"meetings" | "applications">(initialTab);

  const hiredCount = applications.filter(a => a.status === "hired").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ファネルサマリー */}
      <FunnelBar
        meetingCount={meetings.length}
        appCount={applications.length}
        hiredCount={hiredCount}
      />

      {/* タブ切り替え */}
      <div style={{
        display: "flex", gap: 0,
        background: "#fff", borderBottom: "1px solid var(--line)",
        padding: "0 24px",
      }}>
        {[
          { key: "meetings" as const, label: "カジュアル面談", count: meetings.length },
          { key: "applications" as const, label: "選考・応募", count: applications.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "12px 20px", border: "none", background: "none", cursor: "pointer",
              fontSize: 14, fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? "var(--royal)" : "var(--ink-soft)",
              borderBottom: tab === t.key ? "2px solid var(--royal)" : "2px solid transparent",
              marginBottom: -1,
              display: "flex", alignItems: "center", gap: 6,
              transition: "color 0.15s",
            }}
          >
            {t.label}
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 100,
              background: tab === t.key ? "var(--royal)" : "var(--line)",
              color: tab === t.key ? "#fff" : "var(--ink-soft)",
            }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "meetings" ? (
          <MeetingsClient
            meetings={meetings}
            tenantName={tenantName}
            currentUser={currentUser}
          />
        ) : (
          <ApplicationsClient applications={applications} />
        )}
      </div>
    </div>
  );
}
