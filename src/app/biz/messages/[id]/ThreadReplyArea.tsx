"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ReplyForm } from "./ReplyForm";

/** 検証用と実アカウントの間で送れないときの一行（返信欄の代わり） */
export const TEST_MISMATCH_SEND_NOTICE = "検証用の会社のため、このアカウントからは送れません";

/**
 * ★会話の下の返信欄（2026-10-12 / 柴さんの指示）。候補者を探すの右欄・/biz/messages の右側・/biz/messages/[id] が同じ部品を使う。
 *   参加者           … 返信欄
 *   参加者でない管理者 … 返信欄＋上にグレーで「返信すると、このやり取りに参加します」。送るとサーバーが参加と送信を1つの処理で行う
 *                       （`POST /api/biz/conversations/[id]/messages` → DB 関数 `join_and_send_company_message`）。
 *                       参加だけしたい人のために「返信せずに参加する」を小さく残す
 *   検証用と実アカウントの間 … 返信欄の代わりに「検証用の会社のため、このアカウントからは送れません」
 * ⚠️ 判定の担保は送信の API。ここは表示の出し分けだけ（`loadCompanyThread` の canReply / sendBlocked）。
 */
export function ThreadReplyArea({ conversationId, isParticipant, canReply, sendBlocked, tools, compact = false, placeholder, onSent }: {
  conversationId: string;
  isParticipant: boolean;
  canReply: boolean;
  sendBlocked: "test_mismatch" | null;
  tools?: ReactNode;
  compact?: boolean;
  placeholder?: string;
  /** 送れた・参加したあと（渡さなければ router.refresh()） */
  onSent?: () => void;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  /* ★「返信せずに参加する」のあと（2026-10-27）。読み直しが画面に反映されず「参加が必要です」のまま残ったことがある
        （原因は特定できず）。読み直しを transition で待ち、終わってもまだ参加していない表示ならページごと読み直す（ホームの 784e1e34 と同じ形） */
  const [joinedRefreshing, setJoinedRefreshing] = useState(false);
  const [refreshPending, startRefresh] = useTransition();
  useEffect(() => {
    if (!joinedRefreshing || refreshPending || isParticipant) return;
    const t = setTimeout(() => {
      console.warn("[biz/messages] 参加後の読み直しが反映されなかったので、ページごと読み直します");
      window.location.reload();
    }, 300);
    return () => clearTimeout(t);
  }, [joinedRefreshing, refreshPending, isParticipant]);

  if (sendBlocked === "test_mismatch") {
    return <p data-state="reply-blocked-test" style={{ margin: 0, padding: "10px 4px", fontSize: 12.5, color: "var(--ink-mute)" }}>{TEST_MISMATCH_SEND_NOTICE}</p>;
  }
  if (!isParticipant && !canReply) {
    return <p data-state="reply-not-allowed" style={{ margin: 0, padding: "10px 4px", fontSize: 12.5, color: "var(--ink-mute)" }}>このやり取りには返信できません（会社の管理者だけが返信できます）。</p>;
  }

  async function joinOnly() {
    setJoining(true); setJoinError(null);
    const res = await fetch(`/api/biz/conversations/${conversationId}/join`, { method: "POST" }).catch(() => null);
    if (!res || !res.ok) { setJoinError("参加できませんでした"); setJoining(false); return; }
    if (onSent) { onSent(); return; }
    setJoinedRefreshing(true);
    startRefresh(() => router.refresh());
  }

  return (
    <div data-state={isParticipant ? "reply-participant" : "reply-will-join"} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      {!isParticipant && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: compact ? "0 0 6px" : "10px 16px 0" }}>
          <span data-state="reply-join-note" style={{ fontSize: 12, color: "var(--ink-mute)" }}>返信すると、このやり取りに参加します</span>
          <button type="button" onClick={() => void joinOnly()} disabled={joining} data-state="join-only"
            style={{ border: "none", background: "none", padding: 0, fontSize: 12, color: "var(--ink-soft)", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
            {joining ? "参加しています…" : "返信せずに参加する"}
          </button>
          {joinError && <span role="alert" style={{ fontSize: 12, color: "var(--error-ink)" }}>{joinError}</span>}
        </div>
      )}
      <ReplyForm conversationId={conversationId} tools={isParticipant ? tools : undefined} compact={compact} placeholder={placeholder} onSent={onSent} />
    </div>
  );
}
