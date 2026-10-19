import Link from "next/link";
import type { ReactNode } from "react";
import { CandidateProfileDrawerButton } from "@/components/candidates/CandidateProfileDrawer";
import { ChatBubble } from "@/components/messages/ChatBubble";
import type { CompanyThread } from "@/lib/conversations/companyThread";
import type { SentApproach } from "@/lib/approaches/server";
import { formatMeetingDateTime, MEETING_FORMATS } from "@/lib/constants/meetings";
import { ThreadMessages } from "./ThreadMessages";
import { ThreadReplyArea } from "./[id]/ThreadReplyArea";
import { RecordMeetingButton, SchedulingTools } from "./[id]/SchedulingTools";
import { ReadOnInteraction } from "./ReadOnInteraction";

/**
 * ★/biz/messages の右側（2026-10-11 / 柴さんの指示。LinkedIn のメッセージと同じ左右2画面）。
 *   上部（固定）… 名前＋↗（候補者を探すと同じプロフィール欄をドロワーで）／2行目「社会人8年・AE・zap・東京都」
 *   中身        … 吹き出しを時系列（`ChatBubble`。/biz/messages/[id] と同じ部品）
 *   下部（固定）… 返信後・興味あり＝入力欄（既存の `ReplyForm`）。参加していない会話は「参加する」（既存の `JoinButton`）
 *                 返事待ち＝入力欄を出さず、中央の灰色の文字
 * ⚠️ 状態はバッジにしない（灰色の文字）。⚠️ 権限・既読の付け方は `loadCompanyThread` のまま（ここで足さない）。
 * ⚠️ 1279px 以下では全幅で出す。上の「← 一覧へ」は狭い画面だけ（CSS で出し分け）。
 */

function PaneShell({ candidateId, name, meta, backHref, children, footer }: {
  candidateId: string | null; name: string; meta: string | null; backHref: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="msg-pane-inner" data-state="message-pane">
      <div className="msg-pane-head">
        <Link href={backHref} className="msg-pane-back" data-state="pane-back">← 一覧へ</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)", overflowWrap: "anywhere" }}>{name}</h2>
          {candidateId && (
            <CandidateProfileDrawerButton userId={candidateId} name={name} label="↗" ariaLabel={`${name}さんのプロフィールを見る`} title="プロフィールを見る"
              style={{ fontSize: 15, padding: "2px 6px", color: "var(--ink-mute)" }} />
          )}
        </div>
        {meta && <div data-state="pane-meta" style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 2, overflowWrap: "anywhere" }}>{meta}</div>}
      </div>
      <div className="msg-pane-body" data-state="pane-body">{children}</div>
      {footer && <div className="msg-pane-foot">{footer}</div>}
    </div>
  );
}

/** 返信後・興味あり・応募などの会話 */
export function ThreadPane({ thread, meta, backHref, myOwUserId, deferRead = false }: {
  thread: CompanyThread; meta: string | null; backHref: string; myOwUserId: string;
  /** ★自動で開いたとき（?auto=1）は既読を付けずに読んでいる。触ったときに既読にする（ReadOnInteraction） */
  deferRead?: boolean;
}) {
  const name = thread.candidate?.name ?? "名前未設定";
  const m = thread.meetingState;
  return (
    <ReadOnInteraction conversationId={thread.conv.id} enabled={deferRead && thread.isParticipant}>
    <PaneShell candidateId={thread.candidate?.id ?? null} name={name} meta={meta} backHref={backHref}
      footer={
        <ThreadReplyArea conversationId={thread.conv.id} isParticipant={thread.isParticipant} canReply={thread.canReply} sendBlocked={thread.sendBlocked}
          tools={<SchedulingTools conversationId={thread.conv.id} admins={thread.companyAdmins} myUserId={myOwUserId} initialSchedulingUrl={thread.schedulingUrl} />} />
      }>
      {m?.scheduled ? (
        <div data-state="meeting-scheduled" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderRadius: 10, background: "var(--bg-tint)", fontSize: 13 }}>
          <span style={{ color: "var(--ink)" }}>面談：{formatMeetingDateTime(m.scheduled.startsAt)}（{MEETING_FORMATS[m.scheduled.format]}・{m.scheduled.duration}分）</span>
          <Link href="/biz/meetings?tab=meetings" style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>選考管理で見る →</Link>
        </div>
      ) : thread.isParticipant && m?.linkSent ? <RecordMeetingButton conversationId={thread.conv.id} /> : null}
      <ThreadMessages thread={thread} />
    </PaneShell>
    </ReadOnInteraction>
  );
}

/** 送って返信がないもの（返事待ち。期限は無い）。⚠️ 入力欄を出さない */
export function PendingPane({ sent, meta, backHref }: { sent: SentApproach; meta: string | null; backHref: string }) {
  const name = sent.candidate.name || "名前未設定";
  return (
    <PaneShell candidateId={sent.candidate.id} name={name} meta={meta} backHref={backHref}
      footer={
        <div data-state="pending-foot" style={{ textAlign: "center", fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8, padding: "6px 0" }}>
          <div data-state="pending-status">返信を待っています</div>
          <div>返信が来るまで、続けては送れません</div>
        </div>
      }>
      <ChatBubble mine sender={sent.senderName ?? "担当者"} at={sent.createdAt}>
        <span data-state="approach-first">{[sent.reason, sent.body].filter(Boolean).join("\n\n")}</span>
        {sent.jobTitle && <span style={{ display: "block", marginTop: 6, fontSize: 12.5, color: "var(--ink-mute)" }}>求人：{sent.jobTitle}</span>}
      </ChatBubble>
    </PaneShell>
  );
}

/** 一覧が空のとき */
export function EmptyPane({ canSend }: { canSend: boolean }) {
  return (
    <div className="msg-pane-inner" data-state="message-pane-empty" style={{ alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
      <p style={{ margin: 0, fontSize: 14, color: "var(--ink-mute)" }}>まだメッセージはありません</p>
      {canSend && (
        <Link href="/biz/candidates" className="btn-fixed-size" style={{ display: "inline-flex", alignItems: "center", padding: "9px 18px", borderRadius: 8, background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>候補者を探して送る</Link>
      )}
    </div>
  );
}

/** 一覧はあるが、まだ何も選んでいないとき（広い画面で一瞬だけ。すぐ一番上が選ばれる） */
export function NoSelectionPane() {
  return <div className="msg-pane-inner" data-state="message-pane-none" style={{ alignItems: "center", justifyContent: "center" }}><p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>やり取りを選んでください</p></div>;
}
