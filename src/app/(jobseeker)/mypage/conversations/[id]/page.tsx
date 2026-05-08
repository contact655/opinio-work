"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils/formatRelativeTime";
import { formatDateSeparator } from "@/lib/utils/formatDateSeparator";
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

// B: 機能未実装のため disabled（当面プレースホルダー）
type SidebarItem =
  | { label: string; href: string; disabled?: false }
  | { label: string; href?: never; disabled: true };

const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: "応募管理",   href: "/mypage/applications" },
  { label: "対話",       href: "/mypage/conversations" },
  { label: "プロフィール", href: "/onboarding" },
  { label: "保存した求人", disabled: true },  // B: 未実装
  { label: "通知設定",   disabled: true },    // B: 未実装
];

const STAGE_LABELS: Record<string, string> = {
  inquiry: "問い合わせ",
  casual_meeting: "カジュアル面談",
  interview: "面接",
  offer: "内定",
  closed: "終了",
};

// 連続メッセージのグルーピング判定: 同一送信者かつ 5 分以内
function isGroupedMessage(
  curr: MessageRow,
  prev: MessageRow | null,
  needsSeparator: boolean
): boolean {
  if (!prev || needsSeparator) return false;
  const sameSender = curr.sender_participant_id === prev.sender_participant_id;
  const withinFiveMin =
    new Date(curr.sent_at).getTime() - new Date(prev.sent_at).getTime() <
    5 * 60 * 1000;
  return sameSender && withinFiveMin;
}

export default function ConversationDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const conversationId = params.id as string;

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [myUserName, setMyUserName] = useState<string | null>(null); // A-3 準備
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setLoading(false);
      return;
    }

    // id + name を取得（A-3 で自分の名前をバブルに表示するため）
    const { data: owUser } = await supabase
      .from("ow_users")
      .select("id, name")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!owUser) {
      setLoading(false);
      return;
    }

    setMyUserName(owUser.name ?? user.email?.split("@")[0] ?? null);

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: myParticipant } = await (supabase as any)
      .from("ow_conversation_participants")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", owUser.id)
      .maybeSingle();

    setMyParticipantId(myParticipant?.id ?? null);

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

    // D: 既読更新（last_read_at を now() に更新、失敗は表示をブロックしない）
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

  // 新着メッセージ到着時に最下部へスクロール
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
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
        {/* Left Sidebar — top-24(96px) → top-16(64px) に修正 */}
        <aside className="hidden lg:block w-[200px] flex-shrink-0">
          <nav className="sticky top-16 space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              if (item.disabled) {
                return (
                  <span
                    key={item.label}
                    className="block px-3 py-2 rounded-lg text-sm text-gray-400 cursor-not-allowed select-none"
                    aria-disabled="true"
                    title="準備中"
                  >
                    {item.label}
                  </span>
                );
              }
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-primary-light text-primary font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main — height 計算: 100vh - header(60) - padding(py-8 × 2 = 64) ≈ 120px */}
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

            {/* 企業 / メンターロゴ */}
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {company?.logo_letter ?? company?.name?.[0] ?? displayName[0] ?? "?"}
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
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto bg-white border-x border-card-border px-4 py-4 min-h-0"
          >
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400 text-sm">まだメッセージはありません</p>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((msg, i) => {
                  const prevMsg = i > 0 ? messages[i - 1] : null;
                  const isMe = msg.sender_participant_id === myParticipantId;

                  // 日付セパレータの要否
                  const needsSeparator =
                    !prevMsg ||
                    new Date(msg.sent_at).toDateString() !==
                      new Date(prevMsg.sent_at).toDateString();

                  // グルーピング（同一送信者 + 5 分以内 + セパレータなし）
                  const grouped = isGroupedMessage(msg, prevMsg, needsSeparator);

                  const participant = msg.ow_conversation_participants;
                  const senderName = participant?.ow_users?.name ?? "運営";

                  // 相対時刻（7 日以上は YYYY/MM/DD HH:MM）
                  const msgTime = formatRelativeTime(msg.sent_at, { withTime: true });

                  return (
                    <Fragment key={msg.id}>
                      {/* 日付セパレータ */}
                      {needsSeparator && (
                        <div className="flex items-center gap-3 py-3">
                          <div className="flex-1 h-px bg-gray-100" />
                          <span className="text-xs text-gray-400 flex-shrink-0 px-2 select-none">
                            {formatDateSeparator(msg.sent_at)}
                          </span>
                          <div className="flex-1 h-px bg-gray-100" />
                        </div>
                      )}

                      {/* メッセージ行 */}
                      <div
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${
                          grouped ? "mt-0.5" : "mt-3"
                        }`}
                      >
                        {/* 送信者名: !isMe のみ、グループ 2 通目以降は非表示 */}
                        {!isMe && !grouped && (
                          <span className="text-xs text-gray-500 mb-0.5 px-1">
                            {senderName}
                          </span>
                        )}

                        {/* バブル行 */}
                        <div className="flex items-end gap-2">
                          {/* isMe: 時刻 → バブル */}
                          {isMe && (
                            <span className="text-xs text-gray-400 flex-shrink-0 self-end">
                              {msgTime}
                            </span>
                          )}

                          {/* 吹き出し */}
                          <div
                            className={`max-w-[65%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                              isMe
                                ? "bg-primary text-white rounded-br-sm"
                                : "bg-gray-100 text-foreground rounded-bl-sm"
                            }`}
                          >
                            {msg.body}
                          </div>

                          {/* !isMe: バブル → 時刻 */}
                          {!isMe && (
                            <span className="text-xs text-gray-400 flex-shrink-0 self-end">
                              {msgTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            )}
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
