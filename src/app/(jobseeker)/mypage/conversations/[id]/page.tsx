"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";

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

type ConversationDetail = {
  id: string;
  kind: string;
  stage: string;
  status: string;
  company_id: string | null;
  mentor_user_id: string | null;
  ow_companies: {
    name: string;
    logo_url: string | null;
    logo_letter: string | null;
  } | null;
  mentor: { name: string } | null;
};

const SIDEBAR_ITEMS = [
  { label: "応募管理", href: "/mypage/applications", active: false },
  { label: "対話", href: "/mypage/conversations", active: true },
  { label: "プロフィール", href: "/onboarding", active: false },
  { label: "保存した求人", href: "#", active: false },
  { label: "通知設定", href: "#", active: false },
];

const STAGE_LABELS: Record<string, string> = {
  inquiry: "問い合わせ",
  casual_meeting: "カジュアル面談",
  interview: "面接",
  offer: "内定",
  closed: "終了",
};

export default function ConversationDetailPage() {
  const params = useParams();
  const conversationId = params.id as string;

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: owUser } = await supabase
      .from("ow_users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!owUser) {
      setLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conv, error: convError } = await (supabase as any)
      .from("ow_conversations")
      .select(
        `id, kind, stage, status, company_id, mentor_user_id,
         ow_companies(name, logo_url, logo_letter),
         mentor:ow_users!mentor_user_id(name)`
      )
      .eq("id", conversationId)
      .maybeSingle();

    if (convError) {
      setError(convError.message);
      setLoading(false);
      return;
    }
    if (!conv) {
      setError("対話が見つかりませんでした");
      setLoading(false);
      return;
    }
    setConversation(conv as ConversationDetail);

    // Find my participant record to identify own messages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: myParticipant } = await (supabase as any)
      .from("ow_conversation_participants")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", owUser.id)
      .maybeSingle();

    setMyParticipantId(myParticipant?.id ?? null);

    // Fetch messages with sender info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: msgs, error: msgsError } = await (supabase as any)
      .from("ow_conversation_messages")
      .select(
        `id, body, sent_at, sender_participant_id,
         ow_conversation_participants!sender_participant_id(
           role,
           ow_users(name)
         )`
      )
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("sent_at", { ascending: true });

    if (msgsError) {
      setError(msgsError.message);
    } else {
      setMessages((msgs as MessageRow[]) || []);
    }

    // D: 既読更新(B 画面アクセス時に last_read_at を now() に更新)
    // UPDATE 失敗は表示をブロックしない(migration 069 で last_read_at + UPDATE RLS 修正済み)
    if (!msgsError && myParticipant?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("ow_conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("id", myParticipant.id);

      if (updateError) {
        console.error("[Step 4-2 D] last_read_at update failed:", updateError.message);
      }
    }

    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !myParticipantId || sending) return;
    setSending(true);

    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("ow_conversation_messages")
      .insert({
        conversation_id: conversationId,
        sender_participant_id: myParticipantId,
        body: inputText.trim(),
      });

    if (insertError) {
      setError(insertError.message);
    } else {
      setInputText("");
      await loadData();
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </main>
    );
  }

  const displayName =
    conversation?.kind === "mentor"
      ? conversation.mentor?.name ?? "メンター"
      : conversation?.ow_companies?.name ?? "(企業情報なし)";

  const company = conversation?.ow_companies;
  const stageLabel = conversation ? (STAGE_LABELS[conversation.stage] ?? conversation.stage) : "";

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-6">
        {/* Left Sidebar */}
        <aside className="hidden lg:block w-[200px] flex-shrink-0">
          <nav className="sticky top-24 space-y-1">
            {SIDEBAR_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  item.active
                    ? "bg-primary-light text-primary font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
          {/* Header */}
          <div className="bg-white rounded-t-card border border-card-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <Link
              href="/mypage/conversations"
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="対話一覧に戻る"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>

            {/* Logo */}
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-royal-50 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {company?.logo_letter ?? company?.name?.[0] ?? "?"}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate text-sm">{displayName}</p>
              {stageLabel && (
                <p className="text-xs text-gray-500">{stageLabel}</p>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-0 mt-0 p-3 bg-red-50 border-x border-red-200 text-red-700 text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-white border-x border-card-border px-4 py-4 space-y-4 min-h-0">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400 text-sm">まだメッセージはありません</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_participant_id === myParticipantId;
                const participant = msg.ow_conversation_participants;
                const senderName = participant?.ow_users?.name ?? "運営";
                const time = new Date(msg.sent_at).toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const date = new Date(msg.sent_at).toLocaleDateString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                });

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}
                  >
                    {!isMe && (
                      <span className="text-xs text-gray-500 px-1">{senderName}</span>
                    )}
                    <div className="flex items-end gap-2">
                      {isMe && (
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {date} {time}
                        </span>
                      )}
                      <div
                        className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                          isMe
                            ? "bg-primary text-white rounded-br-sm"
                            : "bg-gray-100 text-foreground rounded-bl-sm"
                        }`}
                      >
                        {msg.body}
                      </div>
                      {!isMe && (
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {date} {time}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="bg-white rounded-b-card border border-t-0 border-card-border px-4 py-3 flex-shrink-0">
            {myParticipantId ? (
              <div className="flex gap-2 items-end">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="メッセージを入力… (Cmd+Enter で送信)"
                  rows={2}
                  className="flex-1 resize-none border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || sending}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                  {sending ? "送信中…" : "送信"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-1">
                この対話にはメッセージを送信できません
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
