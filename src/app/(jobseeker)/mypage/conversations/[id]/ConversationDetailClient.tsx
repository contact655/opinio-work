"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";
import { usableLogoUrl } from "@/lib/utils/companyLogo";
import { MeetingMessageCard } from "@/components/meetings/MeetingMessageCard";
import { ChatBubble, ChatNotice, chatTime } from "@/components/messages/ChatBubble";
import { FirstTopicNotice } from "@/components/messages/FirstMessage";
import { isMessageFormat, requestCompanyName, MESSAGE_TOPICS, type MessageTopic } from "@/lib/constants/messageTopics";

export type MessageRow = {
  id: string;
  body: string;
  /** ★種類（2026-10-10 / 段4）。text / meeting_slots / scheduling_link / proposal_intro（2026-10-11）。⚠️ 古い応答では無いことがある */
  kind?: string;
  payload?: unknown;
  sent_at: string;
  sender_participant_id: string | null;
  ow_conversation_participants: {
    ow_users: { name: string } | null;
  } | null;
};

export type ConversationDetail = {
  id: string;
  kind: string;
  stage: string;
  status: string;
  company_id: string | null;
  partner_user_id: string | null;
  ow_companies: {
    name: string;
    logo_url: string | null;
    logo_letter: string | null;
  } | null;
  partner: { name: string } | null;
  /** ★DM の「メッセージのお願い」の段（段階3）。ここを開けるのは参加者だけなので、
   *  DM で accepted でなければ「自分が送って承認待ち」（断られていても同じ） */
  request_status?: string | null;
  /** ★最初の1通で選んだテーマ（DM。2026-10-17） */
  request_topic?: string | null;
  request_format?: string | null;
  request_company?: unknown;
};

const STAGE_LABELS: Record<string, string> = {
  inquiry: "問い合わせ",
  casual_meeting: "カジュアル面談",
  interview: "面接",
  offer: "内定",
  closed: "終了",
};

export default function ConversationDetailClient({
  conversationId,
  initialConversation,
  initialMessages,
  initialMyParticipantId,
  myUserName,
  approachFirst = null,
}: {
  conversationId: string;
  initialConversation: ConversationDetail | null;
  initialMessages: MessageRow[];
  initialMyParticipantId: string | null;
  myUserName: string | null;
  /** ★企業から届いたメッセージの1通目（見出しなしで出す本文）。page.tsx が送ったメッセージの行と照合して渡す */
  approachFirst?: { messageId: string; text: string } | null;
}) {
  const [conversation] = useState<ConversationDetail | null>(initialConversation);
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [myParticipantId] = useState<string | null>(initialMyParticipantId);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 新着メッセージ到着時に最下部へスクロール
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const refreshMessages = useCallback(async () => {
    const r = await fetch(`/api/dm/conversation?id=${conversationId}`);
    if (!r.ok) return;
    const data = await r.json();
    if (data.messages) setMessages(data.messages as MessageRow[]);
  }, [conversationId]);

  // 10秒ポーリングで新着メッセージを自動取得
  useEffect(() => {
    const timer = setInterval(() => { refreshMessages(); }, 10_000);
    return () => clearInterval(timer);
  }, [refreshMessages]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    if (inputText.trim().length > 5000) {
      setError("メッセージは5000文字以内で入力してください");
      return;
    }
    setSending(true);
    const res = await fetch("/api/dm/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, message: inputText.trim() }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "メッセージの送信に失敗しました");
    } else {
      setInputText("");
      await refreshMessages();
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  };

  if (!conversation) {
    return (
      <MypageLayout activeKey="conversations">
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-soft)" }}>
          対話が見つかりませんでした。
          <Link href="/mypage/conversations" style={{ color: "var(--royal)", marginLeft: 8 }}>
            一覧に戻る
          </Link>
        </div>
      </MypageLayout>
    );
  }

  /* ⚠️★`kind === "mentor"` の分岐は 2026-09-26 に削除した。**戻さないこと。**
        メンター機能は存在しない —— `ow_mentors` は DROP 済み、`kind='mentor'` の会話は
        **本番0件**で、**作る経路も無い**（`kind: "mentor"` を渡す呼び出しが0件。
        `/api/mentor-reservations` も存在しない）。
     ⚠️ 消す前はフォールバックが**3箇所で割れていた**（「メンター」×2 /「対話相手」×1）。
        一度も出ていないので誰も気づけなかった。
     ⚠️ `ow_conversations.partner_user_id` は**触っていない**。3件中2件が持っていて、
        中身は `kind='direct_message'` の相手。名前だけの名残（`?industry=` と同じ形）。 */
  const displayName =
    conversation.kind === "direct_message"
      ? conversation.partner?.name ?? "ユーザー"
      : conversation.ow_companies?.name ?? "(企業情報なし)";

  const company = conversation.ow_companies;
  /* ⚠️ 語彙に無い値をそのまま出さない（2026-10-11）。`stage` は今は 'active' しか無く、
        生の値にフォールバックしていたため、企業との会話の見出しに英語の「active」が出ていた。 */
  const stageLabel = STAGE_LABELS[conversation.stage] ?? null;

  return (
    <MypageLayout activeKey="conversations">
      <div className="flex flex-col" style={{ height: "calc(100vh - 205px)" }}>
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

          {conversation.kind === "direct_message" ? (
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "#fff",
            }}>
              {displayName[0] ?? "?"}
            </div>
          ) : usableLogoUrl(company?.logo_url) ? (
            <img src={usableLogoUrl(company?.logo_url)!} alt={company?.name ?? ""} loading="lazy"
              className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              {company?.logo_letter ?? company?.name?.[0] ?? displayName[0] ?? "?"}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate text-sm">{displayName}</p>
            {stageLabel && <p className="text-xs text-gray-500">{stageLabel}</p>}
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
            /* ★吹き出しは会社側と同じ共通部品（`ChatBubble`。2026-10-12 / 柴さんの指示）。
                  求職者側は左右を反転: 自分＝右・薄い青 ／ 企業・相手＝左・白。各吹き出しの上に「名前・日時」を灰色で。
                  ⚠️ 状態の言葉・アバター・日付の区切りは出さない（会社側と揃える）。 */
            <div data-state="jobseeker-thread" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {conversation.kind === "direct_message" && MESSAGE_TOPICS.some((t) => t.value === conversation.request_topic) && (
                <FirstTopicNotice topic={conversation.request_topic as MessageTopic} format={isMessageFormat(conversation.request_format) ? conversation.request_format : null} aboutCompanyName={requestCompanyName(conversation.request_company)} />
              )}
              {messages.map((msg) => {
                if (msg.kind === "proposal_intro") {
                  /* ★提案の案内の行（2026-10-11）。本人の発言ではないので吹き出しにせず、中央に1行で出す */
                  return (
                    <ChatNotice key={msg.id} state="proposal-intro">
                      {msg.body}
                      <span style={{ display: "block", fontSize: 11, color: "var(--ink-mute)" }}>{chatTime(msg.sent_at)}</span>
                    </ChatNotice>
                  );
                }
                const isMe = msg.sender_participant_id === myParticipantId;
                const sender = isMe ? (myUserName ?? "自分") : (msg.ow_conversation_participants?.ow_users?.name ?? "運営");
                const isCard = (msg.kind === "meeting_slots" || msg.kind === "scheduling_link") && conversation.kind === "company";
                return (
                  <ChatBubble key={msg.id} mine={isMe} sender={sender} at={msg.sent_at} plain={isCard}>
                    {isCard ? (
                      /* ★候補日・日程調整リンク（2026-10-10 / 段4）。選ぶと確定し、一覧を取り直す */
                      <div style={{ width: 320, maxWidth: "min(420px, 100%)" }}>
                        <MeetingMessageCard side="candidate" conversationId={conversationId} messageId={msg.id}
                          kind={msg.kind as "meeting_slots" | "scheduling_link"} payload={msg.payload} onChanged={() => void refreshMessages()} />
                      </div>
                    ) : approachFirst?.messageId === msg.id ? (
                      /* ★企業から届いたメッセージの1通目は、見出し（【送った理由】）なしで理由と本文だけ */
                      <span data-state="approach-first">{approachFirst.text}</span>
                    ) : msg.body}
                  </ChatBubble>
                );
              })}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="bg-white rounded-b-card border border-t-0 border-card-border px-4 py-3 flex-shrink-0">
          {conversation.kind === "direct_message" && conversation.request_status !== "accepted" ? (
            /* ★承認前（段階3）。⚠️ 入力欄は閉じる（API も 409 で止める）。断られていても同じ文言 */
            <p data-state="request-pending-banner" className="text-sm text-gray-500 text-center py-1">
              {/* ★文ごとに折り返す（2026-10-19。390px で「…送れま／す」と最後の1文字だけ次の行に落ちていた） */}
              <span className="inline-block">まだ返信がありません。</span><span className="inline-block">返信があると続きを送れます</span>
            </p>
          ) : myParticipantId ? (
            <div className="flex gap-2 items-end">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力…"
                title="Cmd+Enter（Windows は Ctrl+Enter）でも送信できます"
                aria-label="メッセージを入力"
                rows={2}
                className="flex-1 resize-none border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                disabled={sending}
              />
              <button
                type="button"
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
    </MypageLayout>
  );
}
