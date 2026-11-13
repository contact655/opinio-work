import { PRIVATE_THREAD_NOTE } from "@/lib/nextManager/constants";

/**
 * ★「メッセージは2人だけのものです。会社には共有されません。」（Next Manager / 2026-11-13）。
 *   送る画面（文に2人の名前を入れる）とメッセージ画面の上部（compact）に出す。
 * ⚠️ 文言は lib/nextManager/constants.ts の1か所。ここで書き換えない。
 * ⚠️ 事実として守っていること: 個人どうしのメッセージ（kind='direct_message'・company_id は null）は
 *    RLS で当事者の参加者にしか読めず、会社の担当者の権限（auth_company_can）では開かない。
 */
export function PrivateMessageNote({ text = PRIVATE_THREAD_NOTE, compact = false }: { text?: string; compact?: boolean }) {
  return (
    <div data-state="private-message-note" role="note"
      style={compact
        ? { display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", background: "var(--bg-tint, #F6F7F9)", color: "var(--ink-soft)", fontSize: 12, borderBottom: "1px solid var(--line)", flexShrink: 0 }
        : { display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 10, background: "var(--bg-tint, #F1F3F6)", color: "var(--ink-soft)", fontSize: 12.5, lineHeight: 1.7 }}>
      <svg width={compact ? 13 : 16} height={compact ? 13 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden style={{ flexShrink: 0, marginTop: compact ? 0 : 3 }}>
        <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <span style={{ minWidth: 0 }}>{text}</span>
    </div>
  );
}
