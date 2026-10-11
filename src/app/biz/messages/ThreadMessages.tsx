import { ChatBubble, ChatNotice, chatTime } from "@/components/messages/ChatBubble";
import { MeetingMessageCard } from "@/components/meetings/MeetingMessageCard";
import type { CompanyThread } from "@/lib/conversations/companyThread";

/**
 * ★会話のメッセージを時系列に並べる（2026-10-11 に /biz/messages/[id] から切り出した）。
 *   /biz/messages の右側と /biz/messages/[id] が同じ部品を使う。
 * - 提案から始まった会話の案内（`kind = 'proposal_intro'`）は中央の灰色の文
 * - 送ったメッセージの1通目は「理由」と「本文」を空行でつないで1つの吹き出しに（「送った理由」のラベルは出さない）
 * - 面談の日程（`meeting_slots` / `scheduling_link`）は既存のカード
 */
export function ThreadMessages({ thread }: { thread: CompanyThread }) {
  const { messages, approachFirst, replyNote, isParticipant, conv } = thread;
  if (messages.length === 0) {
    return (
      <ChatNotice state="thread-empty">
        {thread.messagesFailed ? "メッセージを読み込めませんでした" : isParticipant ? "まだメッセージはありません" : "この会話のメッセージを読むには、参加が必要です"}
      </ChatNotice>
    );
  }
  return (
    <>
      {messages.map((msg) => {
        if (msg.kind === "proposal_intro") {
          return (
            <ChatNotice key={msg.id} state="proposal-intro">
              {msg.body}
              <span style={{ display: "block", fontSize: 11, color: "var(--ink-mute)" }}>{chatTime(msg.sent_at)}</span>
            </ChatNotice>
          );
        }
        const isCandidate = msg.participant?.role === "candidate";
        const sender = msg.participant?.user?.name ?? "不明";
        const isCard = msg.kind === "meeting_slots" || msg.kind === "scheduling_link";
        return (
          <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {replyNote?.messageId === msg.id && <ChatNotice state="reply-note">{replyNote.text}</ChatNotice>}
            <ChatBubble mine={!isCandidate} sender={sender} at={msg.sent_at} plain={isCard}>
              {isCard ? (
                <div style={{ width: 320, maxWidth: "min(420px, 100%)" }}>
                  <MeetingMessageCard side="company" conversationId={conv.id} messageId={msg.id} kind={msg.kind as "meeting_slots" | "scheduling_link"} payload={msg.payload} />
                </div>
              ) : approachFirst?.messageId === msg.id ? (
                <span data-state="approach-first">{[approachFirst.reason, approachFirst.body].filter(Boolean).join("\n\n")}</span>
              ) : msg.body}
            </ChatBubble>
          </div>
        );
      })}
    </>
  );
}
