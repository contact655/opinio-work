"use client";

import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";

type MessageRow = {
  id: string;
  body: string;
  sent_at: string;
  sender_participant_id: string | null;
  ow_conversation_participants: {
    role: string;
    ow_users: { name: string } | null;
  } | null;
};

type Props = {
  targetUserId: string;
  targetName: string;
  targetAvatarUrl?: string | null;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  return d.toLocaleDateString("ja-JP", { month: "long", day: "numeric" });
}

function needsDateSep(curr: MessageRow, prev: MessageRow | null) {
  if (!prev) return true;
  return new Date(curr.sent_at).toDateString() !== new Date(prev.sent_at).toDateString();
}

function isGrouped(curr: MessageRow, prev: MessageRow | null, sep: boolean) {
  if (!prev || sep) return false;
  return (
    curr.sender_participant_id === prev.sender_participant_id &&
    new Date(curr.sent_at).getTime() - new Date(prev.sent_at).getTime() < 5 * 60 * 1000
  );
}

export function DMButton({ targetUserId, targetName, targetAvatarUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composeMode, setComposeMode] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  const refreshThread = useCallback(async () => {
    const r = await fetch(`/api/dm/start?targetUserId=${targetUserId}`);
    if (!r.ok) return;
    const data = await r.json();
    if (data.conversation) {
      setConvId(data.conversation.id);
      setMyParticipantId(data.conversation.myParticipantId);
      setMyName(data.conversation.myName);
      setMessages(data.messages ?? []);
    }
  }, [targetUserId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/dm/start?targetUserId=${targetUserId}`)
      .then((r) => {
        if (r.status === 401) {
          router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
          setOpen(false);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.conversation) {
          setConvId(data.conversation.id);
          setMyParticipantId(data.conversation.myParticipantId);
          setMyName(data.conversation.myName);
          setMessages(data.messages ?? []);
          setComposeMode(false);
        } else {
          setComposeMode(true);
        }
      })
      .catch(() => setError("読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, [open, targetUserId, router]);

  useEffect(() => {
    if (open && !minimized && messages.length > 0) {
      setTimeout(() => scrollToBottom(false), 80);
    }
  }, [open, minimized, messages.length, scrollToBottom]);

  useEffect(() => {
    if (!open || !convId) return;
    const timer = setInterval(refreshThread, 10_000);
    return () => clearInterval(timer);
  }, [open, convId, refreshThread]);

  async function handleFirstSend() {
    if (!inputText.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/dm/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, message: inputText.trim() }),
      });
      if (res.status === 401) {
        router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "送信に失敗しました");

      setInputText("");
      setComposeMode(false);

      await refreshThread();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    if (!inputText.trim() || !convId || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/dm/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, message: inputText.trim() }),
      });
      if (res.status === 401) {
        router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "送信に失敗しました");
      setInputText("");
      await refreshThread();
      setTimeout(() => scrollToBottom(true), 50);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (composeMode) { handleFirstSend(); } else { handleSend(); }
    }
  }

  const initial = targetName.charAt(0);

  return (
    <>
      {/* トリガーボタン */}
      <button
        type="button"
        onClick={() => { setOpen(true); setMinimized(false); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "9px 18px", borderRadius: 8,
          border: "1.5px solid var(--royal-100)", background: "var(--royal-50)",
          color: "var(--royal)", fontSize: 13, fontWeight: 700,
          cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        DMを送る
      </button>

      {/* 右下フローティングパネル */}
      {open && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 360,
          zIndex: 300,
          boxShadow: "0 8px 40px rgba(15,23,42,0.22)",
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: minimized ? "auto" : 520,
        }}>
          {/* Header (常に表示) */}
          <div
            onClick={() => setMinimized((v) => !v)}
            style={{
              background: "var(--royal)",
              color: "#fff",
              padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", flexShrink: 0, userSelect: "none",
            }}
          >
            {targetAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={targetAvatarUrl} alt={targetName}
                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid rgba(255,255,255,0.3)" }} />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
              }}>{initial}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{targetName}</div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>ダイレクトメッセージ</div>
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {/* 最小化ボタン */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMinimized((v) => !v); }}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 24, height: 24, borderRadius: 4, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
                title={minimized ? "展開" : "最小化"}
              >
                {minimized ? "▲" : "▼"}
              </button>
              {/* 閉じるボタン */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 24, height: 24, borderRadius: 4, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
                title="閉じる"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body (最小化時は非表示) */}
          {!minimized && (
            <div style={{ background: "#fff", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              {loading ? (
                <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--ink-mute)" }}>
                  読み込み中...
                </div>
              ) : composeMode ? (
                /* 初回送信フォーム */
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                    {targetName} さんに初めてメッセージを送ります。
                  </div>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`${targetName} さんへのメッセージ...`}
                    rows={5}
                    autoFocus
                    onKeyDown={handleKeyDown}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "10px 12px", borderRadius: 8,
                      border: "1.5px solid var(--line)", outline: "none",
                      fontSize: 13, lineHeight: 1.6, resize: "none",
                      fontFamily: "inherit", color: "var(--ink)", background: "var(--bg-tint)",
                    }}
                  />
                  {error && <div style={{ fontSize: 12, color: "var(--error)" }}>{error}</div>}
                  <button
                    type="button"
                    onClick={handleFirstSend}
                    disabled={sending || !inputText.trim()}
                    style={{
                      padding: "9px 0", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700,
                      cursor: sending || !inputText.trim() ? "not-allowed" : "pointer",
                      background: sending || !inputText.trim() ? "var(--line)" : "var(--royal)",
                      color: sending || !inputText.trim() ? "var(--ink-mute)" : "#fff",
                    }}
                  >
                    {sending ? "送信中..." : "送信する (⌘+Enter)"}
                  </button>
                </div>
              ) : (
                /* 会話ビュー */
                <>
                  <div style={{
                    flex: 1, overflowY: "auto", padding: "12px 14px",
                    display: "flex", flexDirection: "column", gap: 2,
                    minHeight: 0, maxHeight: 380,
                  }}>
                    {messages.length === 0 ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 80 }}>
                        <span style={{ fontSize: 13, color: "var(--ink-mute)" }}>まだメッセージはありません</span>
                      </div>
                    ) : (
                      messages.map((msg, i) => {
                        const prev = i > 0 ? messages[i - 1] : null;
                        const isMe = msg.sender_participant_id === myParticipantId;
                        const sep = needsDateSep(msg, prev);
                        const grouped = isGrouped(msg, prev, sep);
                        const senderName = msg.ow_conversation_participants?.ow_users?.name ?? (isMe ? (myName ?? "自分") : targetName);

                        return (
                          <Fragment key={msg.id}>
                            {sep && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "6px 0" }}>
                                <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
                                <span style={{ fontSize: 10, color: "var(--ink-mute)", flexShrink: 0 }}>{formatDateLabel(msg.sent_at)}</span>
                                <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
                              </div>
                            )}
                            <div style={{
                              display: "flex", flexDirection: "column",
                              alignItems: isMe ? "flex-end" : "flex-start",
                              marginTop: grouped ? 2 : 8,
                            }}>
                              {!grouped && (
                                <span style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 2 }}>
                                  {isMe ? (myName ?? "自分") : senderName}
                                </span>
                              )}
                              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, flexDirection: isMe ? "row-reverse" : "row" }}>
                                <div style={{
                                  maxWidth: "75%", padding: "8px 11px", borderRadius: 12,
                                  borderBottomRightRadius: isMe ? 3 : 12,
                                  borderBottomLeftRadius: isMe ? 12 : 3,
                                  background: isMe ? "var(--royal)" : "#f1f5f9",
                                  color: isMe ? "#fff" : "var(--ink)",
                                  fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word",
                                }}>
                                  {msg.body}
                                </div>
                                <span style={{ fontSize: 10, color: "var(--ink-mute)", flexShrink: 0 }}>
                                  {formatTime(msg.sent_at)}
                                </span>
                              </div>
                            </div>
                          </Fragment>
                        );
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {error && (
                    <div style={{ padding: "4px 14px", fontSize: 11, color: "var(--error)", background: "#fef2f2" }}>{error}</div>
                  )}
                  <div style={{
                    borderTop: "1px solid var(--line)", padding: "10px 12px",
                    display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0,
                  }}>
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="メッセージを入力… (⌘+Enter)"
                      rows={2}
                      disabled={sending}
                      style={{
                        flex: 1, boxSizing: "border-box",
                        padding: "8px 10px", borderRadius: 8,
                        border: "1.5px solid var(--line)", outline: "none",
                        fontSize: 13, lineHeight: 1.5, resize: "none",
                        fontFamily: "inherit", color: "var(--ink)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={sending || !inputText.trim() || !convId}
                      style={{
                        padding: "8px 14px", borderRadius: 8, border: "none",
                        fontSize: 13, fontWeight: 700, flexShrink: 0,
                        cursor: sending || !inputText.trim() || !convId ? "not-allowed" : "pointer",
                        background: sending || !inputText.trim() || !convId ? "var(--line)" : "var(--royal)",
                        color: sending || !inputText.trim() || !convId ? "var(--ink-mute)" : "#fff",
                      }}
                    >
                      {sending ? "…" : "送信"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
