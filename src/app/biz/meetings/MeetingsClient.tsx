"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import type { MeetingApplication, MeetingStatus } from "@/lib/business/mockMeetings";
import { STATUS_TABS } from "@/lib/business/mockMeetings";
import { MeetingsLayout } from "@/components/business/MeetingsLayout";
import { MeetingStatusTabs } from "@/components/business/MeetingStatusTabs";
import { MeetingCard } from "@/components/business/MeetingCard";
import { MeetingSearchBar } from "@/components/business/MeetingSearchBar";
import { MeetingDetailPanel } from "@/components/business/MeetingDetailPanel";
import { MeetingEmptyState } from "@/components/business/MeetingEmptyState";

// 自分（アサイン用モック担当者）
const SELF = {
  id: "member-1",
  name: "柴 尚人",
  initial: "柴",
  gradient: "linear-gradient(135deg, var(--royal), var(--accent))",
};

type MemoSaveState = "idle" | "saving" | "saved";

type Props = {
  meetings: MeetingApplication[];
  tenantName?: string;
};

export function MeetingsClient({ meetings: initialMeetings }: Props) {
  // ── Core state ──────────────────────────────────────────────
  const [meetings, setMeetings] = useState<MeetingApplication[]>(initialMeetings);
  const [activeStatus, setActiveStatus] = useState<MeetingStatus>("pending");
  const [searchQuery, setSearchQuery] = useState("");

  const firstPending = initialMeetings.find((m) => m.status === "pending");
  const [selectedId, setSelectedId] = useState<string | null>(firstPending?.id ?? null);

  // メモ管理
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});
  const [memoSaveStates, setMemoSaveStates] = useState<Record<string, MemoSaveState>>({});
  const memoTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Derived ─────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = {} as Record<MeetingStatus, number>;
    for (const tab of STATUS_TABS) c[tab.status] = 0;
    for (const m of meetings) c[m.status] = (c[m.status] ?? 0) + 1;
    return c;
  }, [meetings]);

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

  const selectedIndex = filtered.findIndex((m) => m.id === selectedId);
  const isPrevDisabled = selectedIndex <= 0;
  const isNextDisabled = selectedIndex < 0 || selectedIndex >= filtered.length - 1;

  // ── Handlers ────────────────────────────────────────────────

  const handleStatusChange = useCallback((meetingId: string, newStatus: MeetingStatus) => {
    setMeetings((prev) =>
      prev.map((m) => m.id === meetingId ? { ...m, status: newStatus } : m)
    );
    // ステータス変更で現在のタブから消えるなら次の件を自動選択
    setSelectedId((curId) => {
      if (curId !== meetingId) return curId;
      const remaining = filtered.filter((m) => m.id !== meetingId);
      // 同じ位置か、なければ前の件
      const idx = filtered.findIndex((m) => m.id === meetingId);
      const next = remaining[idx] ?? remaining[idx - 1] ?? null;
      return next?.id ?? null;
    });
  }, [filtered]);

  const handleAssignToMe = useCallback((meetingId: string) => {
    setMeetings((prev) =>
      prev.map((m) =>
        m.id === meetingId
          ? {
              ...m,
              assigneeId: SELF.id,
              assigneeName: SELF.name,
              assigneeInitial: SELF.initial,
              assigneeGradient: SELF.gradient,
            }
          : m
      )
    );
  }, []);

  const handleMemoChange = useCallback((meetingId: string, text: string) => {
    setMemoDrafts((prev) => ({ ...prev, [meetingId]: text }));
    setMemoSaveStates((prev) => ({ ...prev, [meetingId]: "saving" }));

    // debounce 1500ms
    if (memoTimers.current[meetingId]) {
      clearTimeout(memoTimers.current[meetingId]);
    }
    memoTimers.current[meetingId] = setTimeout(() => {
      setMeetings((prev) =>
        prev.map((m) => m.id === meetingId ? { ...m, companyMemo: text } : m)
      );
      setMemoSaveStates((prev) => ({ ...prev, [meetingId]: "saved" }));
      // 2秒後に saved 表示を消す
      setTimeout(() => {
        setMemoSaveStates((prev) => ({ ...prev, [meetingId]: "idle" }));
      }, 2000);
    }, 1500);
  }, []);

  const handlePrev = useCallback(() => {
    if (selectedIndex > 0) setSelectedId(filtered[selectedIndex - 1].id);
  }, [filtered, selectedIndex]);

  const handleNext = useCallback(() => {
    if (selectedIndex < filtered.length - 1) setSelectedId(filtered[selectedIndex + 1].id);
  }, [filtered, selectedIndex]);

  const handleStatusChange2 = useCallback((newStatus: MeetingStatus) => {
    if (!selectedId) return;
    handleStatusChange(selectedId, newStatus);
  }, [selectedId, handleStatusChange]);

  const handleAssignToMe2 = useCallback(() => {
    if (!selectedId) return;
    handleAssignToMe(selectedId);
  }, [selectedId, handleAssignToMe]);

  const handleMemoChange2 = useCallback((text: string) => {
    if (!selectedId) return;
    handleMemoChange(selectedId, text);
  }, [selectedId, handleMemoChange]);

  const handleReply = useCallback(() => {
    alert("返信機能は今後実装予定です。");
  }, []);

  const handleScheduleAdjust = useCallback(() => {
    if (!selectedId) return;
    handleStatusChange(selectedId, "scheduling");
  }, [selectedId, handleStatusChange]);

  const handleProfileDetail = useCallback(() => {
    alert("プロフィール詳細ページは Phase 4（Supabase 接続後）で実装予定です。");
  }, []);

  function handleStatusTabChange(s: MeetingStatus) {
    setActiveStatus(s);
    const first = meetings.find((m) => m.status === s);
    setSelectedId(first?.id ?? null);
  }

  // ── Render ──────────────────────────────────────────────────

  const currentMemoDraft = selectedId !== null
    ? (memoDrafts[selectedId] ?? selectedMeeting?.companyMemo ?? "")
    : "";
  const currentMemoSaveState = selectedId ? (memoSaveStates[selectedId] ?? "idle") : "idle";

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
        onStatusChange={handleStatusTabChange}
      />

      <MeetingSearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* カードリスト */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <MeetingEmptyState isSearch={!!searchQuery.trim()} />
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
      detailPanel={
        <MeetingDetailPanel
          meeting={selectedMeeting}
          memoDraft={currentMemoDraft}
          memoSaveState={currentMemoSaveState}
          isPrevDisabled={isPrevDisabled}
          isNextDisabled={isNextDisabled}
          onStatusChange={handleStatusChange2}
          onAssignToMe={handleAssignToMe2}
          onMemoChange={handleMemoChange2}
          onReply={handleReply}
          onScheduleAdjust={handleScheduleAdjust}
          onProfileDetail={handleProfileDetail}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      }
    />
  );
}
