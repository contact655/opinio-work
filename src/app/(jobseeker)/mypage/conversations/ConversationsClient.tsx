"use client";

import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils/formatRelativeTime";
import { formatDateSeparator } from "@/lib/utils/formatDateSeparator";
import { InitialAvatar } from "@/components/ui/InitialAvatar";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";
import { usableLogoUrl } from "@/lib/utils/companyLogo";

import { MAX_BULK_RECIPIENTS, MAX_DM_LENGTH } from "@/lib/constants/messages";

export type Conversation = {
  id: string;
  kind: string;
  stage: string;
  status: string;
  last_message_at: string | null;
  created_at: string;
  company_id: string | null;
  mentor_user_id: string | null;
  ow_companies: {
    id: string;
    name: string;
    logo_url: string | null;
    logo_letter: string | null;
  } | null;
  mentor: {
    id: string;
    name: string;
  } | null;
  hasUnread?: boolean;
};

type MessageRow = {
  id: string;
  body: string;
  sent_at: string;
  sender_participant_id: string | null;
  ow_conversation_participants: {
    ow_users: { name: string } | null;
  } | null;
};

function isGrouped(curr: MessageRow, prev: MessageRow | null, hasSep: boolean) {
  if (!prev || hasSep) return false;
  return (
    curr.sender_participant_id === prev.sender_participant_id &&
    new Date(curr.sent_at).getTime() - new Date(prev.sent_at).getTime() < 5 * 60 * 1000
  );
}

function ConvAvatar({ conv }: { conv: Conversation }) {
  const displayName =
    conv.kind === "direct_message"
      ? conv.mentor?.name ?? "ユーザー"
      : conv.ow_companies?.name ?? "対話相手";
  const company = conv.ow_companies;

  if (conv.kind === "direct_message") {
    return (
      <div style={{
        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color: "#fff",
      }}>{displayName[0] ?? "?"}</div>
    );
  }
  const logoSrc = usableLogoUrl(company?.logo_url);
  if (logoSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoSrc} alt={company?.name ?? ""} loading="lazy"
      style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
      background: "var(--royal-50)", display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: 14, fontWeight: 700, color: "var(--royal)",
    }}>
      {company?.logo_letter ?? company?.name?.[0] ?? displayName[0] ?? "?"}
    </div>
  );
}

export default function ConversationsClient({
  initialConversations,
  initialOpenConvId,
}: {
  initialConversations: Conversation[];
  initialOpenConvId?: string | null;
}) {
  const router = useRouter();
  const [conversations] = useState<Conversation[]>(initialConversations);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(initialOpenConvId ?? null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async (convId: string) => {
    const r = await fetch(`/api/dm/conversation?id=${convId}`);
    if (!r.ok) return;
    const data = await r.json();
    setMessages(data.messages ?? []);
    setMyParticipantId(data.myParticipantId ?? null);
    setMyName(data.myName ?? null);
  }, []);

  useEffect(() => {
    if (!selectedConvId) return;
    setPanelLoading(true);
    setMessages([]);
    setInputText("");
    setSendError(null);
    fetchMessages(selectedConvId).finally(() => setPanelLoading(false));
  }, [selectedConvId, fetchMessages]);

  useEffect(() => {
    if (!selectedConvId) return;
    const timer = setInterval(() => fetchMessages(selectedConvId), 10_000);
    return () => clearInterval(timer);
  }, [selectedConvId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── ★複数の宛先へ送る（2026-08-27）────────────────────────────────────────
        ⚠️ **グループ会話ではない。** 宛先ごとに既存の1対1の会話へ1通ずつ入る。
           受け取った側からは通常のメッセージと区別がつかず、**他の宛先も見えない。**
        ⚠️ **新しく会話は作らない。** 選べるのは**すでにある会話**だけなので、
           面識のない企業へ一斉送信することはできない。 */
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());
  const [bulkText, setBulkText] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkNote, setBulkNote] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const toggleBulkId = (id: string) => {
    setBulkError(null);
    setBulkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size >= MAX_BULK_RECIPIENTS) return prev; /* 上限。⚠️ 静かに無視しない（下で件数を出す） */
      else next.add(id);
      return next;
    });
  };

  const exitBulk = () => {
    setBulkMode(false); setBulkIds(new Set()); setBulkText("");
    setBulkError(null); setBulkNote(null);
  };

  const handleBulkSend = async () => {
    if (bulkSending || bulkIds.size === 0 || !bulkText.trim()) return;
    setBulkSending(true); setBulkError(null); setBulkNote(null);
    try {
      const res = await fetch("/api/dm/bulk-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationIds: Array.from(bulkIds), message: bulkText.trim() }),
      });
      if (res.status === 401) { router.push("/auth?next=/mypage/conversations"); return; }
      const data = await res.json().catch(() => null);
      /* ⚠️ **「全部送れた」で片付けない。** 誰に届かなかったかを出す。
            出さないと、利用者は同じ本文をもう一度全員に送ることになる。 */
      const sent = typeof data?.sent === "number" ? data.sent : 0;
      const total = typeof data?.total === "number" ? data.total : bulkIds.size;
      if (sent === 0) {
        setBulkError(data?.message ?? "送信できませんでした。もう一度お試しください。");
        return;
      }
      if (sent < total) {
        setBulkNote(`${total}件中 ${sent}件に送りました。残り${total - sent}件は送れませんでした。`);
        return;
      }
      setBulkNote(`${sent}件に送りました。`);
      setBulkText("");
      setBulkIds(new Set());
      router.refresh();
    } catch {
      setBulkError("送信できませんでした。もう一度お試しください。");
    } finally {
      setBulkSending(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !selectedConvId || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/dm/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedConvId, message: inputText.trim() }),
      });
      if (res.status === 401) { router.push("/auth?next=/mypage/conversations"); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "送信に失敗しました");
      setInputText("");
      await fetchMessages(selectedConvId);
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedConv = conversations.find((c) => c.id === selectedConvId) ?? null;
  const displayName = selectedConv
    ? selectedConv.kind === "direct_message"
      ? selectedConv.mentor?.name ?? "ユーザー"
      : selectedConv.kind === "mentor"
      ? selectedConv.mentor?.name ?? "メンター"
      : selectedConv.ow_companies?.name ?? "(企業情報なし)"
    : null;

  return (
    <MypageLayout activeKey="conversations">
      <div style={{ display: "flex", gap: 0, height: "calc(100vh - 160px)", minHeight: 500, border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "#fff" }}>

        {/* ── 左カラム: 会話リスト ── */}
        <div style={{
          width: 300, flexShrink: 0,
          borderRight: "1px solid var(--line)",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}>
          {/* 左ヘッダー */}
          <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--line-soft)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h1 style={{ fontFamily: '"Noto Serif JP", serif', fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                メッセージ
              </h1>
              {/* ⚠️ 会話が2件以上あるときだけ出す。1件しか無い人に「複数に送る」は意味が無い */}
              {conversations.length >= 2 && (
                <button
                  type="button"
                  onClick={() => (bulkMode ? exitBulk() : setBulkMode(true))}
                  style={{
                    border: "none", background: "none", padding: 0, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: "var(--royal)",
                  }}
                >
                  {bulkMode ? "やめる" : "複数に送る"}
                </button>
              )}
            </div>
            {bulkMode && (
              <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.6 }}>
                宛先を選んでください（{bulkIds.size} / {MAX_BULK_RECIPIENTS}）。
                {/* ★何が起きるかを先に言う。送ったあとで気づく形にしない */}
                <br />相手ごとに<strong style={{ color: "var(--ink)" }}>別々に届きます</strong>。他の宛先は見えません。
              </p>
            )}
          </div>

          {conversations.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                まだ対話がありません
              </p>
              <Link href="/people" style={{
                display: "inline-block", marginTop: 12,
                fontSize: 12, color: "var(--royal)", fontWeight: 700, textDecoration: "none",
              }}>
                先輩を探す →
              </Link>
            </div>
          ) : (
            conversations.map((conv) => {
              const name =
                conv.kind === "direct_message"
                  ? conv.mentor?.name ?? "ユーザー"
                  : conv.kind === "mentor"
                  ? conv.mentor?.name ?? "対話相手"
                  : conv.ow_companies?.name ?? "(企業情報なし)";
              const isSelected = conv.id === selectedConvId;
              const hasUnread = conv.hasUnread ?? false;

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => (bulkMode ? toggleBulkId(conv.id) : setSelectedConvId(conv.id))}
                  aria-pressed={bulkMode ? bulkIds.has(conv.id) : undefined}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px", textAlign: "left", border: "none",
                    borderBottom: "1px solid var(--line-soft)",
                    background: (bulkMode ? bulkIds.has(conv.id) : isSelected) ? "var(--royal-50)" : "transparent",
                    cursor: "pointer", width: "100%",
                    borderLeft: (bulkMode ? bulkIds.has(conv.id) : isSelected) ? "3px solid var(--royal)" : "3px solid transparent",
                    transition: "background 0.1s",
                  }}
                >
                  {/* ⚠️ 選択モードでは**選ばれているかを形で出す**。背景色だけだと、
                         いま選ばれているのか開いているだけなのか区別がつかない。 */}
                  {bulkMode && (
                    <span aria-hidden style={{
                      width: 16, height: 16, flexShrink: 0, borderRadius: 4,
                      border: bulkIds.has(conv.id) ? "none" : "1.5px solid var(--line)",
                      background: bulkIds.has(conv.id) ? "var(--royal)" : "#fff",
                      color: "#fff", fontSize: 11, lineHeight: "16px", textAlign: "center", fontWeight: 700,
                    }}>{bulkIds.has(conv.id) ? "✓" : ""}</span>
                  )}
                  <ConvAvatar conv={conv} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{
                        fontSize: 13, fontWeight: hasUnread ? 700 : 500,
                        color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        flex: 1,
                      }}>{name}</span>
                      {conv.kind === "direct_message" && (
                        <span style={{ fontSize: 12, fontWeight: 500, padding: "1px 5px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", flexShrink: 0 }}>DM</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 2 }}>
                      {conv.last_message_at ? formatRelativeTime(conv.last_message_at) : "これから対話"}
                    </div>
                  </div>
                  {hasUnread && (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--royal)", flexShrink: 0 }} />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* ── 右カラム: 会話パネル ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* ★複数送信のときは、会話ではなく**本文を書く面**にする（2026-08-27）。
                 ⚠️ 会話を開いたまま複数送信の欄も出す形にしない。どちらに書いているのか
                    分からなくなり、開いている相手にだけ送ったつもりで全員に届く。 */}
          {bulkMode ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 16, gap: 10 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                {bulkIds.size === 0 ? "宛先を選んでください" : `${bulkIds.size}件の宛先に送る`}
              </p>
              {/* ⚠️ 誰に送るのかを**名前で**出す。件数だけだと選び間違いに気づけない */}
              {bulkIds.size > 0 && (
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.7 }}>
                  {conversations
                    .filter((c) => bulkIds.has(c.id))
                    .map((c) =>
                      c.kind === "direct_message" || c.kind === "mentor"
                        ? c.mentor?.name ?? "ユーザー"
                        : c.ow_companies?.name ?? "(企業情報なし)",
                    )
                    .join("・")}
                </p>
              )}
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="送る内容を入力…"
                aria-label="複数の宛先へ送るメッセージ"
                maxLength={MAX_DM_LENGTH}
                disabled={bulkSending}
                style={{
                  flex: 1, minHeight: 160, resize: "none", padding: 12,
                  border: "1px solid var(--line)", borderRadius: 8,
                  fontFamily: "inherit", fontSize: 14, lineHeight: 1.7, color: "var(--ink)",
                }}
              />
              {bulkError && (
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{bulkError}</p>
              )}
              {/* ⚠️ 部分的に送れたときは**それを出す**。「送りました」だけだと、
                     届かなかった相手に同じ本文をもう一度送ることになる。 */}
              {bulkNote && (
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>{bulkNote}</p>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={exitBulk} disabled={bulkSending} style={{
                  padding: "9px 16px", borderRadius: 8, border: "1px solid var(--line)",
                  background: "#fff", color: "var(--ink-soft)", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 600, cursor: bulkSending ? "default" : "pointer",
                }}>やめる</button>
                <button
                  type="button"
                  onClick={() => { void handleBulkSend(); }}
                  disabled={bulkSending || bulkIds.size === 0 || !bulkText.trim()}
                  style={{
                    padding: "9px 18px", borderRadius: 8, border: "none",
                    background: bulkSending || bulkIds.size === 0 || !bulkText.trim() ? "var(--line)" : "var(--royal)",
                    color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    cursor: bulkSending || bulkIds.size === 0 || !bulkText.trim() ? "default" : "pointer",
                  }}
                >
                  {bulkSending ? "送信中…" : "送信"}
                </button>
              </div>
            </div>
          ) : !selectedConvId ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-mute)" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.3 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p style={{ fontSize: 14, color: "var(--ink-mute)" }}>会話を選択してください</p>
            </div>
          ) : (
            <>
              {/* 右ヘッダー */}
              <div style={{
                padding: "12px 16px", borderBottom: "1px solid var(--line)",
                display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
              }}>
                {selectedConv && <ConvAvatar conv={selectedConv} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{displayName}</p>
                  {selectedConv?.kind === "direct_message" && (
                    <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", margin: 0 }}>ダイレクトメッセージ</p>
                  )}
                </div>
              </div>

              {/* メッセージエリア */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px", minHeight: 0 }}>
                {panelLoading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                    <span style={{ fontSize: 13, color: "var(--ink-mute)" }}>読み込み中...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                    <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>まだメッセージはありません</p>
                  </div>
                ) : (
                  <div>
                    {messages.map((msg, i) => {
                      const prev = i > 0 ? messages[i - 1] : null;
                      const isMe = msg.sender_participant_id === myParticipantId;
                      const needsSep = !prev || new Date(msg.sent_at).toDateString() !== new Date(prev.sent_at).toDateString();
                      const grouped = isGrouped(msg, prev, needsSep);
                      const senderName = msg.ow_conversation_participants?.ow_users?.name ?? (isMe ? (myName ?? "自分") : "相手");

                      return (
                        <Fragment key={msg.id}>
                          {needsSep && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0" }}>
                              <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
                              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>{formatDateSeparator(msg.sent_at)}</span>
                              <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
                            </div>
                          )}
                          <div style={{
                            display: "flex", flexDirection: "column",
                            alignItems: isMe ? "flex-end" : "flex-start",
                            marginTop: grouped ? 2 : 12,
                          }}>
                            {!grouped && (
                              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 3 }}>
                                {isMe ? (myName ?? "自分") : senderName}
                              </span>
                            )}
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flexDirection: isMe ? "row-reverse" : "row" }}>
                              {!grouped ? (
                                isMe ? (
                                  <InitialAvatar name={myName ?? "自"} size={26} />
                                ) : (
                                  <InitialAvatar name={senderName} size={26} bgStyle="var(--line)" textColor="var(--ink-soft)" />
                                )
                              ) : <div style={{ width: 26, flexShrink: 0 }} />}
                              <div style={{
                                maxWidth: "62%", padding: "9px 13px", borderRadius: 16,
                                borderBottomRightRadius: isMe ? 3 : 16,
                                borderBottomLeftRadius: isMe ? 16 : 3,
                                background: isMe ? "var(--royal)" : "#f1f5f9",
                                color: isMe ? "#fff" : "var(--ink)",
                                fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                              }}>
                                {msg.body}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", flexShrink: 0 }}>
                                {formatRelativeTime(msg.sent_at, { withTime: true })}
                              </span>
                            </div>
                          </div>
                        </Fragment>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {/* エラー */}
              {sendError && (
                <div style={{ padding: "4px 16px", fontSize: 12, fontWeight: 600, color: "var(--error)", background: "#fef2f2" }}>{sendError}</div>
              )}

              {/* 入力エリア */}
              <div style={{
                borderTop: "1px solid var(--line)", padding: "12px 16px",
                display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0,
              }}>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="メッセージを入力… (⌘+Enter で送信)"
                  rows={2}
                  disabled={sending}
                  style={{
                    flex: 1, boxSizing: "border-box",
                    padding: "9px 12px", borderRadius: 8,
                    border: "1.5px solid var(--line)", outline: "none",
                    fontSize: 13, lineHeight: 1.5, resize: "none",
                    fontFamily: "inherit", color: "var(--ink)",
                  }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !inputText.trim()}
                  style={{
                    padding: "9px 18px", borderRadius: 8, border: "none",
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                    cursor: sending || !inputText.trim() ? "not-allowed" : "pointer",
                    background: sending || !inputText.trim() ? "var(--line)" : "var(--royal)",
                    color: sending || !inputText.trim() ? "var(--ink-mute)" : "#fff",
                  }}
                >
                  {sending ? "送信中…" : "送信"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </MypageLayout>
  );
}
