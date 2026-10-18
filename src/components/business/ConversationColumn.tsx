"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PaneThread, type PaneThreadPage } from "@/components/approaches/PaneThread";
import { ThreadReplyArea } from "@/app/biz/messages/[id]/ThreadReplyArea";

/**
 * ★自社の会話1本を、その場で読んで返信できる欄（2026-10-18 / 柴さんの指示。選考管理の右側）。
 *   中身は候補者を探すの右欄（`PreviewApproachArea` の返信あり）と同じ形 ——最新10通（`PaneThread`）＋返信欄（`ThreadReplyArea`）。
 *   読み込みは `GET /api/biz/conversations/[id]/thread`。
 * ★既読は、この欄で入力欄にフォーカス・スクロール・送信したときだけ付ける（表示されただけでは付けない。候補者を探すと同じ）。
 * ⚠️ 会話が無いとき（面談の申込でまだやり取りが無い等）は呼び出し側が出し分ける。ここは conversationId がある前提。
 */
const GRAY: React.CSSProperties = { fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6 };
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

export function ConversationColumn({ conversationId }: { conversationId: string }) {
  const [thread, setThread] = useState<PaneThreadPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const base = `/api/biz/conversations/${encodeURIComponent(conversationId)}/thread`;

  useEffect(() => {
    let alive = true;
    setFailed(false);
    fetch(`${base}?read=0`)
      .then(async (res) => { const j = await res.json().catch(() => null); if (!alive) return; if (!res.ok || !j?.thread) setFailed(true); else setThread(j.thread); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [base, reloadKey]);

  const loadOlder = useCallback(async (before: string) => {
    const res = await fetch(`${base}?read=0&before=${encodeURIComponent(before)}`);
    const j = await res.json().catch(() => null);
    return res.ok && j?.thread ? (j.thread as PaneThreadPage) : null;
  }, [base]);

  /* 既読（1回だけ。送信したときは付け直す）。⚠️ 失敗しても画面は変えない */
  const readDone = useRef(false);
  const markRead = useCallback((force = false) => {
    if (readDone.current && !force) return;
    readDone.current = true;
    fetch(base, { method: "POST" }).catch(() => { readDone.current = false; });
  }, [base]);

  return (
    <div data-state="selection-thread" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
      onFocusCapture={() => markRead()} onWheel={() => markRead()} onTouchMove={() => markRead()}
      onKeyDown={(e) => { if (SCROLL_KEYS.has(e.key) && !(e.target as HTMLElement).closest("textarea,input")) markRead(); }}>
      {failed ? (
        <span data-state="selection-thread-error" style={GRAY}>やり取りを読み込めませんでした</span>
      ) : !thread ? (
        <span data-state="selection-thread-loading" style={GRAY}>読み込み中…</span>
      ) : (
        <PaneThread initial={thread} loadOlder={loadOlder}
          footer={
            <ThreadReplyArea conversationId={thread.conv.id} isParticipant={thread.isParticipant}
              canReply={thread.canReply ?? thread.isParticipant} sendBlocked={thread.sendBlocked ?? null}
              placeholder="返信を書く" compact onSent={() => { setReloadKey((k) => k + 1); markRead(true); }} />
          } />
      )}
      <Link href={`/biz/messages?show=${conversationId}`} data-state="selection-open-messages"
        style={{ alignSelf: "flex-end", marginTop: 8, fontSize: 12, color: "var(--ink-mute)", textDecoration: "none" }}>
        メッセージ画面で開く ›
      </Link>
    </div>
  );
}
