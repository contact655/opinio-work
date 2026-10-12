"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ThreadMessages, type ThreadMessagesData } from "@/app/biz/messages/ThreadMessages";
import { ChatNotice, chatDay } from "@/components/messages/ChatBubble";

/**
 * ★候補者を探すの右欄の、やり取りの表示（2026-10-12 / 柴さんの指示）。
 *   最初は最新の10通（`PANE_THREAD_RECENT`）を、いちばん下が見える位置で開く。
 *   欄の中で上へスクロールすると前の10通を読み込み、表示位置は飛ばさない（足した分の高さだけ下げる）。
 *   最初の1通まで来たら上端に「ここからやり取りが始まりました（10月11日）」。
 *
 * ⚠️ 読み込み方は `loadOlder` で受ける（本番は `GET /api/biz/approaches/[id]?thread=1&before=`、
 *    /dev/preview は固定データ）。ここに fetch を書かない。
 * ⚠️ 吹き出しは /biz/messages と同じ `ThreadMessages`（中は `ChatBubble`）。日付の区切りと頭文字の丸はこの欄だけ付ける。
 */
export type PaneThreadPage = ThreadMessagesData & { total: number; hasMore: boolean; firstAt: string | null };

export function PaneThread({ initial, loadOlder, footer }: {
  initial: PaneThreadPage;
  loadOlder: (beforeMessageId: string) => Promise<PaneThreadPage | null>;
  /** 欄のいちばん下に固定するもの（返信欄・「メッセージ画面で参加する」） */
  footer?: ReactNode;
}) {
  const [messages, setMessages] = useState(initial.messages);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  /* 前を足したときの、足す前の高さと位置（足した直後に位置を戻すため） */
  const anchor = useRef<{ height: number; top: number } | null>(null);

  /* 最新が来たら（最初・返信した後）、いちばん下から見せる */
  const stickBottom = useRef(true);
  useEffect(() => {
    setMessages(initial.messages); setHasMore(initial.hasMore); setFailed(false); anchor.current = null; stickBottom.current = true;
  }, [initial]);

  const loadMore = useCallback(async () => {
    const el = scrollRef.current;
    const oldest = messages[0];
    if (!el || !oldest || loading || !hasMore) return;
    setLoading(true); setFailed(false);
    anchor.current = { height: el.scrollHeight, top: el.scrollTop };
    const page = await loadOlder(oldest.id).catch(() => null);
    if (!page) { setFailed(true); setLoading(false); anchor.current = null; return; }
    setMessages((prev) => [...page.messages.filter((m) => !prev.some((p) => p.id === m.id)), ...prev]);
    setHasMore(page.hasMore);
    setLoading(false);
  }, [messages, loading, hasMore, loadOlder]);

  /* 前を足した直後は位置を戻す（見ていた吹き出しが同じ場所に残る）。最新が来たときはいちばん下へ。
     ⚠️ 欄に overflow-anchor: none を付けてある。付けないと Chrome のスクロールアンカリングが先に位置を合わせ、
        ここで足す分と二重になって下へ飛ぶ（2026-10-12 に実測。Safari はアンカリングが無いので、こちらで合わせる形に揃えた） */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const a = anchor.current;
    if (a) { el.scrollTop = a.top + (el.scrollHeight - a.height); anchor.current = null; return; }
    if (stickBottom.current) { el.scrollTop = el.scrollHeight; stickBottom.current = false; }
  }, [messages]);

  /* 中身が欄より短くてスクロールできないときは、上へ続きを取りに行けないので自動で足す */
  useEffect(() => {
    const el = scrollRef.current;
    if (el && hasMore && !loading && !failed && el.scrollHeight <= el.clientHeight + 4) void loadMore();
  }, [messages, hasMore, loading, failed, loadMore]);

  /* ★いちばん下を見ていたら、欄の高さが変わっても（「広げる／元に戻す」）いちばん下のままにする */
  const atBottom = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (atBottom.current) el.scrollTop = el.scrollHeight; });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottom.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    if (el.scrollTop < 48) void loadMore();
  };

  const thread: ThreadMessagesData = { ...initial, messages };
  return (
    <div data-state="pane-thread" style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: "0 1 auto" }}>
      <div ref={scrollRef} onScroll={onScroll} data-state="pane-thread-scroll" style={{ flex: "0 1 auto", minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", overflowAnchor: "none", padding: "4px 20px 12px" }}>
        {loading && <ChatNotice state="pane-thread-loading">読み込み中…</ChatNotice>}
        {failed && (
          <ChatNotice state="pane-thread-failed">
            前のメッセージを読み込めませんでした{" "}
            <button type="button" onClick={() => void loadMore()} style={{ border: "none", background: "none", padding: 0, color: "var(--royal)", fontWeight: 700, fontFamily: "inherit", fontSize: 12.5, cursor: "pointer" }}>もう一度</button>
          </ChatNotice>
        )}
        {!hasMore && initial.firstAt && messages.length > 0 && (
          <ChatNotice state="pane-thread-start">ここからやり取りが始まりました（{chatDay(initial.firstAt)}）</ChatNotice>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ThreadMessages thread={thread} daySeparators avatars />
        </div>
      </div>
      {footer && <div style={{ flexShrink: 0 }}>{footer}</div>}
    </div>
  );
}
