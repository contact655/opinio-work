"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { MeetingApplication, MeetingStatus } from "@/lib/business/mockMeetings";
import { STATUS_TABS } from "@/lib/business/mockMeetings";
import { MeetingsLayout } from "@/components/business/MeetingsLayout";
import { MeetingStatusTabs } from "@/components/business/MeetingStatusTabs";
import { MeetingCard } from "@/components/business/MeetingCard";
import { MeetingSearchBar } from "@/components/business/MeetingSearchBar";
import { MeetingDetailPanel } from "@/components/business/MeetingDetailPanel";
import { MeetingEmptyState } from "@/components/business/MeetingEmptyState";

type MemoSaveState = "idle" | "saving" | "saved";

type CurrentUser = {
  owUserId: string;
  name: string;
  initial: string;
  gradient: string;
};

type Props = {
  meetings: MeetingApplication[];
  tenantName?: string;
  currentUser: CurrentUser;
};

export function MeetingsClient({ meetings: initialMeetings, currentUser }: Props) {
  const router = useRouter();
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4000);
  };;

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

  const handleStatusChange = useCallback(async (meetingId: string, newStatus: MeetingStatus) => {
    const old = meetings.find((m) => m.id === meetingId);

    // optimistic update
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

    const res = await fetch(`/api/biz/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", value: newStatus }),
    });
    if (!res.ok && old) {
      // rollback
      setMeetings((prev) =>
        prev.map((m) => m.id === meetingId ? { ...m, status: old.status } : m)
      );
      console.error("[meetings] Failed to update status");
      showError("ステータス更新に失敗しました。再度お試しください。");
    }
  }, [meetings, filtered]);

  const handleAssignToMe = useCallback(async (meetingId: string) => {
    // optimistic update with real currentUser
    setMeetings((prev) =>
      prev.map((m) =>
        m.id === meetingId
          ? {
              ...m,
              assigneeId: currentUser.owUserId,
              assigneeName: currentUser.name,
              assigneeInitial: currentUser.initial,
              assigneeGradient: currentUser.gradient,
            }
          : m
      )
    );

    const res = await fetch(`/api/biz/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign_to_me" }),
    });
    if (!res.ok) {
      console.error("[meetings] Failed to assign meeting");
      // Roll back optimistic update and show error
      setMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId
            ? { ...m, assigneeId: null, assigneeName: null, assigneeInitial: null, assigneeGradient: null }
            : m
        )
      );
      setErrorMessage("担当者の設定に失敗しました。再度お試しください。");
      setTimeout(() => setErrorMessage(null), 4000);
    }
  }, [currentUser]);

  const handleMemoChange = useCallback((meetingId: string, text: string) => {
    setMemoDrafts((prev) => ({ ...prev, [meetingId]: text }));
    setMemoSaveStates((prev) => ({ ...prev, [meetingId]: "saving" }));

    // debounce 1500ms
    if (memoTimers.current[meetingId]) {
      clearTimeout(memoTimers.current[meetingId]);
    }
    memoTimers.current[meetingId] = setTimeout(async () => {
      setMeetings((prev) =>
        prev.map((m) => m.id === meetingId ? { ...m, companyMemo: text } : m)
      );
      setMemoSaveStates((prev) => ({ ...prev, [meetingId]: "saved" }));

      try {
        await fetch(`/api/biz/meetings/${meetingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "memo", value: text }),
        });
      } catch (err) {
        console.error("[meetings] Failed to save memo:", err);
      }

      // 2秒後に saved 表示を消す
      setTimeout(() => {
        setMemoSaveStates((prev) => ({ ...prev, [meetingId]: "idle" }));
      }, 2000);
    }, 1500);
  }, []);

  const handleSelectMeeting = useCallback((id: string) => {
    setSelectedId(id);
    const m = meetings.find((m) => m.id === id);
    if (!m?.isUnread) return;
    // optimistic: mark as read in UI immediately
    setMeetings((prev) => prev.map((m) => m.id === id ? { ...m, isUnread: false } : m));
    fetch(`/api/biz/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read" }),
    }).catch(console.error);
  }, [meetings]);

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

  /* ★その候補者との会話を直接開く（2026-09-21）。見つからないときだけ一覧へ。
        それまでは常に一覧（/biz/conversations）へ着いていた。 */
  const openConversation = useCallback(() => {
    const convId = meetings.find((m) => m.id === selectedId)?.conversationId;
    router.push(convId ? `/biz/conversations/${convId}` : "/biz/conversations");
  }, [router, meetings, selectedId]);
  const handleReply = openConversation;

  /* ★「日程を調整する」は会話を開くだけ。**状態は変えない**（2026-09-21）。
        ⚠️★それまでは押した瞬間に `scheduled` にしており、API が候補者へ
           「日程が確定しました」とメールを送っていた（決まっていないのに）。
        確定は詳細パネルの「日程が決まった」から、確認を挟んで行う。 */
  const handleScheduleAdjust = openConversation;

  // ── Keyboard navigation ─────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't intercept when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        if (selectedIndex < filtered.length - 1) setSelectedId(filtered[selectedIndex + 1].id);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        if (selectedIndex > 0) setSelectedId(filtered[selectedIndex - 1].id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtered, selectedIndex]);

  const handleProfileDetail = useCallback(() => {
    const userId = selectedMeeting?.applicantUserId;
    if (userId) {
      window.open(`/u/${userId}`, "_blank", "noopener,noreferrer");
    }
  }, [selectedMeeting?.applicantUserId]);

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

  const pendingCount = counts["pending"] ?? 0;
  const totalCount = meetings.length;

  const listPanel = (
    <>
      {/* パネルヘッダ。★2026-09-21 に明朝＋英語の小見出し・左の飾り線・点滅する印をやめた
             （ほかの /biz の画面と形を揃えた） */}
      <div style={{ padding: "14px 20px 10px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>カジュアル面談</span>
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            合計 <strong style={{ color: "var(--ink)", fontWeight: 700 }}>{totalCount}</strong> 件
          </span>
          {pendingCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--warm-ink)" }}>
              未対応 {pendingCount} 件
            </span>
          )}
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
          <MeetingEmptyState
            isSearch={!!searchQuery.trim()}
            isAllEmpty={meetings.length === 0 && activeStatus === "pending"}
          />
        ) : (
          <>
            {filtered.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                isSelected={m.id === selectedId}
                onClick={() => handleSelectMeeting(m.id)}
              />
            ))}
            {/* List footer */}
            <div style={{
              padding: "14px 0 18px",
              textAlign: "center",
              fontFamily: "var(--font-inter), var(--font-noto)",
              fontSize: 11,
              color: "var(--ink-mute)",
              letterSpacing: "0.05em",
              userSelect: "none",
            }}>
              ── 以上 {filtered.length} 件 ──
            </div>
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      {errorMessage && (
        <div role="alert" aria-live="polite" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", marginBottom: 16, borderRadius: 8,
          background: "var(--error-soft)", border: "1px solid #FCA5A5",
          fontSize: 13, color: "var(--error-ink)", fontWeight: 600,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} aria-label="エラーを閉じる" style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--error)", fontSize: 16, padding: "0 4px",
          }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      )}
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
    </>
  );
}
