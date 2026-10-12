"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ThreadMessages, type ThreadMessagesData } from "@/app/biz/messages/ThreadMessages";
import { ChatNotice, chatDay } from "@/components/messages/ChatBubble";

/**
 * ★候補者を探すの右欄の、やり取りの表示（2026-10-12 / 柴さんの指示）。
 *   最初は最新の10通（`PANE_THREAD_RECENT`）。**入れ子のスクロールは持たない**（右欄の1本のスクロールの中に並ぶ。2026-10-12 に変えた）。
 *   上に「さらに前のやり取りを表示（n件）」。押すと前の10通を上に足し、見ていた位置は動かさない
 *   （足した分の高さだけ、外側のスクロールを下げる）。最初の1通まで来たら上端に「ここからやり取りが始まりました（10月11日）」。
 *
 * ⚠️ 読み込み方は `loadOlder` で受ける（本番は `GET /api/biz/approaches/[id]?thread=1&before=`、
 *    /dev/preview は固定データ）。ここに fetch を書かない。
 * ⚠️ 吹き出しは /biz/messages と同じ `ThreadMessages`（中は `ChatBubble`）。日付の区切りと頭文字の丸はこの欄だけ付ける。
 * ⚠️ 位置を保つ相手は、いちばん近いスクロールする祖先（右欄のスクロール）。見つからなければ window。
 */
export type PaneThreadPage = ThreadMessagesData & { total: number; hasMore: boolean; firstAt: string | null;
  /** ★返信欄の出し分け（2026-10-12）。`loadCompanyThread` の canReply / sendBlocked */
  canReply?: boolean; sendBlocked?: "test_mismatch" | null };

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  /* ⚠️ body と html は除く（body に overflow-x: hidden があると overflow-y が auto と出るが、実際に動くのは画面＝window） */
  for (let p = el?.parentElement ?? null; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

export function PaneThread({ initial, loadOlder, footer }: {
  initial: PaneThreadPage;
  loadOlder: (beforeMessageId: string) => Promise<PaneThreadPage | null>;
  /** 吹き出しの下に置くもの（返信欄・「メッセージ画面で参加する」） */
  footer?: ReactNode;
}) {
  const [messages, setMessages] = useState(initial.messages);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  /* 前を足したときの、足す前の外側の高さと位置（足した直後に位置を戻すため） */
  const anchor = useRef<{ box: HTMLElement | null; height: number; top: number } | null>(null);

  useEffect(() => {
    setMessages(initial.messages); setHasMore(initial.hasMore); setFailed(false); anchor.current = null;
  }, [initial]);

  const loadMore = useCallback(async () => {
    const oldest = messages[0];
    if (!oldest || loading || !hasMore) return;
    setLoading(true); setFailed(false);
    const box = scrollParent(rootRef.current);
    anchor.current = box
      ? { box, height: box.scrollHeight, top: box.scrollTop }
      : { box: null, height: document.documentElement.scrollHeight, top: window.scrollY };
    const page = await loadOlder(oldest.id).catch(() => null);
    if (!page) { setFailed(true); setLoading(false); anchor.current = null; return; }
    setMessages((prev) => [...page.messages.filter((m) => !prev.some((p) => p.id === m.id)), ...prev]);
    setHasMore(page.hasMore);
    setLoading(false);
  }, [messages, loading, hasMore, loadOlder]);

  /* 前を足した直後は外側の位置を戻す（見ていた吹き出しが同じ場所に残る） */
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    if (a.box) a.box.scrollTop = a.top + (a.box.scrollHeight - a.height);
    else window.scrollTo({ top: a.top + (document.documentElement.scrollHeight - a.height) });
  }, [messages]);

  const remaining = Math.max(0, initial.total - messages.length);
  const thread: ThreadMessagesData = { ...initial, messages };
  return (
    <div ref={rootRef} data-state="pane-thread" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      {hasMore && !loading && (
        <button type="button" onClick={() => void loadMore()} data-state="pane-thread-more"
          style={{ alignSelf: "center", margin: "4px 0 10px", padding: "6px 14px", borderRadius: 999, border: "1px solid var(--line)", background: "#fff",
            fontSize: 12.5, fontWeight: 600, color: "var(--royal)", cursor: "pointer", fontFamily: "inherit" }}>
          さらに前のやり取りを表示{remaining > 0 ? `（${remaining}件）` : ""}
        </button>
      )}
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
      {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
    </div>
  );
}
