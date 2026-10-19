"use client";

import { useCallback, useRef, type ReactNode } from "react";

/**
 * ★自動で開いた会話を、触ったときに既読にする（2026-10-20 / 柴さんの判断 A案）。
 *   /biz/messages は広い画面で一覧のいちばん上を自動で開く。開いた時点で既読にすると、
 *   届いたばかりの返信が「開いただけ」で未読でなくなり、担当者が気づかないまま残る。
 *   そこで自動で開いたとき（?auto=1）は既読を付けずに読み、押す・スクロール・入力欄に触れる・送る、のどれかで既読にする。
 * ⚠️ 既読の書き込みは POST /api/biz/conversations/[id]/thread（候補者を探すの右欄・選考管理と同じ）。条件を書き足さない。
 * ⚠️ 1回だけ。失敗したら次の操作でもう一度試す。画面は変えない（一覧の未読の印は次に開き直したときに消える）。
 */
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

export function ReadOnInteraction({ conversationId, enabled, children }: { conversationId: string; enabled: boolean; children: ReactNode }) {
  const done = useRef(false);
  const markRead = useCallback(() => {
    if (!enabled || done.current) return;
    done.current = true;
    fetch(`/api/biz/conversations/${encodeURIComponent(conversationId)}/thread`, { method: "POST" })
      .then((res) => { if (!res.ok) done.current = false; })
      .catch(() => { done.current = false; });
  }, [conversationId, enabled]);

  if (!enabled) return <>{children}</>;
  return (
    <div data-state="read-on-interaction" style={{ display: "contents" }}
      onPointerDown={markRead} onFocusCapture={markRead} onWheel={markRead} onTouchMove={markRead}
      onKeyDown={(e) => { if (SCROLL_KEYS.has(e.key) || (e.target as HTMLElement).closest("textarea,input")) markRead(); }}>
      {children}
    </div>
  );
}
