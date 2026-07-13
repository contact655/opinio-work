"use client";

import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchMessages = useCallback(async (cId: string) => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("ow_conversation_messages")
      .select(`id, body, sent_at, sender_participant_id, ow_conversation_participants!sender_participant_id(role, ow_users(name))`)
      .eq("conversation_id", cId)
      .is("deleted_at", null)
      .order("sent_at", { ascending: true });
    if (data) setMessages(data as MessageRow[]);
  }, []);

  // パネルを開いたとき: 既存会話をチェック
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

  // スクロール
  useEffect(() => {
    if (open && messages.length > 0) {
      setTimeout(scrollToBottom, 50);
    }
  }, [open, messages.length, scrollToBottom]);

  // 10秒ポーリング
  useEffect(() => {
    if (!open || !convId) return;
    const timer = setInterval(() => fetchMessages(convId), 10_000);
    return () => clearInterval(timer);
  }, [open, convId, fetchMessages]);

  // 初回送信（会話作成 or 既存に追記）
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

      // 会話ID確定 → メッセージを取得して会話ビューに切り替え
      const cId = data.conversationId as string;
      setConvId(cId);
      setInputText("");
      setComposeMode(false);

      // participant ID を取得
      const threadRes = await fetch(`/api/dm/start?targetUserId=${targetUserId}`);
      const threadData = await threadRes.json();
      if (threadData.conversation) {
        setMyParticipantId(threadData.conversation.myParticipantId);
        setMyName(threadData.conversation.myName);
        setMessages(threadData.messages ?? []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  // 追加メッセージ送信（Supabase直接）
  async function handleSend() {
    if (!inputText.trim() || !myParticipantId || !convId || sending) return;
    setSending(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertErr } = await (supabase as any)
      .from("ow_conversation_messages")
      .insert({ conversation_id: convId, sender_participant_id: myParticipantId, body: inputText.trim() });
    if (insertErr) {
      setError("送信に失敗しました");
    } else {
      setInputText("");
      await fetchMessages(convId);
      setTimeout(scrollToBottom, 50);
    }
    setSending(false);
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
      <button
        type="button"
        onClick={() => setOpen(true)}
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

      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520,
            boxShadow: "0 20px 60px rgba(15,23,42,0.2)",
            display: "flex", flexDirection: "column",
            maxHeight: "min(90vh, 640px)", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              padding: "14px 18px", borderBottom: "1px solid var(--line)",
              display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
            }}>
              {targetAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={targetAvatarUrl} alt={targetName}
                  style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: "#fff",
                }}>{initial}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{targetName} さんとの会話</div>
                {!composeMode && !loading && (
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>返信があれば通知されます</div>
                )}
              </div>
              <button type="button" onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--ink-mute)", fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
                ✕
              </button>
            </div>

            {/* Body */}
            {loading ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
                <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>読み込み中...</div>
              </div>
            ) : composeMode ? (
              /* ── 初回送信フォーム ── */
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                  {targetName} さんに初めてメッセージを送ります。
                </div>
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`${targetName} さんへのメッセージを書いてください...`}
                  rows={6}
                  autoFocus
                  onKeyDown={handleKeyDown}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "12px 14px", borderRadius: 10,
                    border: "1.5px solid var(--line)", outline: "none",
                    fontSize: 14, lineHeight: 1.7, resize: "vertical",
                    fontFamily: "inherit", color: "var(--ink)", background: "var(--bg-tint)",
                  }}
                />
                {error && <div style={{ fontSize: 12, color: "var(--error)" }}>{error}</div>}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setOpen(false)}
                    style={{ padding: "9px 18px", borderRadius: 8, cursor: "pointer", border: "1.5px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>
                    キャンセル
                  </button>
                  <button type="button" onClick={handleFirstSend}
                    disabled={sending || !inputText.trim()}
                    style={{
                      padding: "9px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700,
                      cursor: sending || !inputText.trim() ? "not-allowed" : "pointer",
                      background: sending || !inputText.trim() ? "var(--line)" : "var(--royal)",
                      color: sending || !inputText.trim() ? "var(--ink-mute)" : "#fff",
                      transition: "background 0.15s",
                    }}>
                    {sending ? "送信中..." : "送信する (⌘+Enter)"}
                  </button>
                </div>
              </div>
            ) : (
              /* ── 会話ビュー ── */
              <>
                <div style={{
                  flex: 1, overflowY: "auto", padding: "16px 18px",
                  display: "flex", flexDirection: "column", gap: 2, minHeight: 0,
                }}>
                  {messages.length === 0 ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>まだメッセージはありません</div>
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
                            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
                              <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
                              <span style={{ fontSize: 11, color: "var(--ink-mute)", flexShrink: 0 }}>{formatDateLabel(msg.sent_at)}</span>
                              <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
                            </div>
                          )}
                          <div style={{
                            display: "flex", flexDirection: "column",
                            alignItems: isMe ? "flex-end" : "flex-start",
                            marginTop: grouped ? 2 : 10,
                          }}>
                            {!grouped && (
                              <span style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 2, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0 }}>
                                {isMe ? (myName ?? "自分") : senderName}
                              </span>
                            )}
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flexDirection: isMe ? "row-reverse" : "row" }}>
                              <div style={{
                                maxWidth: "68%", padding: "9px 13px", borderRadius: 14,
                                borderBottomRightRadius: isMe ? 4 : 14,
                                borderBottomLeftRadius: isMe ? 14 : 4,
                                background: isMe ? "var(--royal)" : "var(--line-soft)",
                                color: isMe ? "#fff" : "var(--ink)",
                                fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word",
                              }}>
                                {msg.body}
                              </div>
                              <span style={{ fontSize: 10, color: "var(--ink-mute)", flexShrink: 0, marginBottom: 2 }}>
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

                {/* 入力エリア */}
                {error && (
                  <div style={{ padding: "4px 18px", fontSize: 12, color: "var(--error)", borderTop: "1px solid var(--error-soft)", background: "var(--error-soft)" }}>{error}</div>
                )}
                <div style={{
                  borderTop: "1px solid var(--line)", padding: "12px 14px",
                  display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0,
                }}>
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`メッセージを入力… (⌘+Enter で送信)`}
                    rows={2}
                    disabled={sending}
                    style={{
                      flex: 1, boxSizing: "border-box",
                      padding: "9px 12px", borderRadius: 10,
                      border: "1.5px solid var(--line)", outline: "none",
                      fontSize: 13, lineHeight: 1.6, resize: "none",
                      fontFamily: "inherit", color: "var(--ink)",
                    }}
                  />
                  <button type="button" onClick={handleSend}
                    disabled={sending || !inputText.trim()}
                    style={{
                      padding: "9px 16px", borderRadius: 9, border: "none",
                      fontSize: 13, fontWeight: 700, flexShrink: 0,
                      cursor: sending || !inputText.trim() ? "not-allowed" : "pointer",
                      background: sending || !inputText.trim() ? "var(--line)" : "var(--royal)",
                      color: sending || !inputText.trim() ? "var(--ink-mute)" : "#fff",
                      transition: "background 0.15s",
                    }}>
                    {sending ? "…" : "送信"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
