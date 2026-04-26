"use client";

import { useState, useMemo } from "react";
import type { MeetingApplication, MeetingStatus } from "@/lib/business/mockMeetings";
import { STATUS_TABS } from "@/lib/business/mockMeetings";
import { MeetingsLayout } from "@/components/business/MeetingsLayout";
import { MeetingStatusTabs } from "@/components/business/MeetingStatusTabs";
import { MeetingCard } from "@/components/business/MeetingCard";
import { MeetingSearchBar } from "@/components/business/MeetingSearchBar";
import { MeetingDetailPanel } from "@/components/business/MeetingDetailPanel";

type Props = {
  meetings: MeetingApplication[];
  tenantName?: string;
};

export function MeetingsClient({ meetings }: Props) {
  const [activeStatus, setActiveStatus] = useState<MeetingStatus>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(
    meetings.find((m) => m.status === "pending")?.id ?? null
  );
  const [searchQuery, setSearchQuery] = useState("");

  // ステータス別カウント
  const counts = useMemo(() => {
    const c = {} as Record<MeetingStatus, number>;
    for (const tab of STATUS_TABS) c[tab.status] = 0;
    for (const m of meetings) c[m.status] = (c[m.status] ?? 0) + 1;
    return c;
  }, [meetings]);

  // フィルタリング
  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      if (m.status !== activeStatus) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.applicantName.toLowerCase().includes(q) ||
        (m.jobTitle ?? "").toLowerCase().includes(q) ||
        m.applicantCurrentCompany.toLowerCase().includes(q)
      );
    });
  }, [meetings, activeStatus, searchQuery]);

  const selectedMeeting = meetings.find((m) => m.id === selectedId) ?? null;

  function handleStatusChange(s: MeetingStatus) {
    setActiveStatus(s);
    // 切り替え後、最初の件を自動選択
    const first = meetings.find((m) => m.status === s);
    setSelectedId(first?.id ?? null);
  }

  const listPanel = (
    <>
      {/* パネルヘッダ */}
      <div style={{
        padding: "16px 20px 12px",
        borderBottom: "1px solid var(--line)",
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: "'Noto Serif JP', serif",
          fontSize: 16, fontWeight: 600, color: "var(--ink)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          カジュアル面談
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 9, fontWeight: 700, letterSpacing: "0.15em",
            textTransform: "uppercase", color: "var(--ink-mute)",
          }}>Meetings</span>
        </div>
      </div>

      <MeetingStatusTabs
        counts={counts}
        activeStatus={activeStatus}
        onStatusChange={handleStatusChange}
      />

      <MeetingSearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* カードリスト */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: "40px 20px",
            textAlign: "center",
            color: "var(--ink-mute)",
            fontSize: 13,
          }}>
            {searchQuery ? "検索結果がありません" : "該当する申込はありません"}
          </div>
        ) : (
          filtered.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              isSelected={m.id === selectedId}
              onClick={() => setSelectedId(m.id)}
            />
          ))
        )}
      </div>
    </>
  );

  return (
    <MeetingsLayout
      listPanel={listPanel}
      detailPanel={<MeetingDetailPanel meeting={selectedMeeting} />}
    />
  );
}
