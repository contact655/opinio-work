"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MeetingApplication } from "@/lib/business/mockMeetings";
import type { BizApplication } from "@/lib/business/applications";
import { MeetingsClient } from "./MeetingsClient";
import type { MeetingAcceptance } from "@/components/business/MeetingEmptyState";
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
  /** 空状態の文言に使う。⚠️ 既定 false（fail-closed） */
  hasPublishedJobs?: boolean;
  /** ★面談タブの空状態の文言に使う（2026-10-08） */
  acceptance?: MeetingAcceptance | null;
  /** ★決まった面談（ow_meetings。今日以降・取り消し除く。2026-10-10 / 段4）。取れなければ null */
  scheduled?: ScheduledMeetingRow[] | null;
};

export type ScheduledMeetingRow = {
  id: string; conversationId: string; candidateName: string; whenText: string;
  formatLabel: string; duration: number; origin: "approach" | "proposal" | null;
};

export function PipelineClient({ meetings, applications, tenantName, currentUser, initialTab = "meetings", hasPublishedJobs = false, acceptance = null, scheduled = null }: Props) {
  const [tab, setTab] = useState<"meetings" | "applications">(initialTab);
  const router = useRouter();
  /* ★タブを URL（?tab=）に合わせる（2026-09-21）。それまでは切り替えても URL が変わらず、
        再読み込みすると必ず「カジュアル面談」に戻っていた。
        ⚠️ push ではなく replace（タブの切り替えで履歴を積まない）。scroll も動かさない */
  function switchTab(next: "meetings" | "applications") {
    setTab(next);
    router.replace(next === "applications" ? "/biz/meetings?tab=applications" : "/biz/meetings", { scroll: false });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* タブ切り替え */}
      <div style={{
        display: "flex", gap: 0, alignItems: "center",
        background: "#fff", borderBottom: "1px solid var(--line)",
        padding: "0 24px",
      }}>
        {/* ★見出し（2026-09-21）。サイドバーの「選考管理」と同じ名前にする */}
        <h1 style={{ margin: "0 20px 0 0", fontSize: 16, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>選考管理</h1>
        {[
          { key: "meetings" as const, label: "カジュアル面談", count: meetings.length },
          { key: "applications" as const, label: "選考・応募", count: applications.length },
        ].map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTab(t.key)}
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

      {/* ★決まった面談（2026-10-10 / 段4）。声かけ・提案から始まった会話には印を付ける（柴さんの判断）。
             ⚠️ 面談申込の行は作らない。ow_meetings をそのまま並べる */}
      {tab === "meetings" && scheduled && scheduled.length > 0 && (
        <div data-state="scheduled-meetings" style={{ padding: "10px 20px", borderBottom: "1px solid var(--line)", background: "#fff", maxHeight: 220, overflowY: "auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>決まった面談（今日以降）</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {scheduled.map((m) => (
              <li key={m.id}>
                <a href={`/biz/conversations/${m.conversationId}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px", fontSize: 13, color: "var(--ink)", textDecoration: "none", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{m.whenText}</span>
                  <span style={{ minWidth: 0 }}>{m.candidateName} さん</span>
                  <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{m.formatLabel}・{m.duration}分</span>
                  {m.origin && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 100, background: "var(--line-soft)", color: "var(--ink-soft)" }}>
                      {m.origin === "approach" ? "声かけから" : "提案から"}
                    </span>
                  )}
                  <span aria-hidden="true" style={{ marginLeft: "auto", color: "var(--ink-mute)" }}>→</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* コンテンツ */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "meetings" ? (
          <MeetingsClient
            meetings={meetings}
            tenantName={tenantName}
            currentUser={currentUser}
            acceptance={acceptance}
          />
        ) : (
          <ApplicationsClient applications={applications} hasPublishedJobs={hasPublishedJobs} />
        )}
      </div>
    </div>
  );
}
