"use client";

import { useId, useState } from "react";
import { FromTag } from "@/components/mypage/InboxCard";
import { RequestReplyBox } from "@/components/approaches/RequestReplyBox";
import { FIRST_NOTE_MAX, topicLabel, type MessageTopic, type TopicSection } from "@/lib/constants/messageTopics";

/**
 * ★最初の1通（テーマ＋一言）の部品（2026-10-17 / 設計メモ docs/messaging-unification-20261017.md の段階1）。
 * ★使う場所: 個人どうしの DM の書く画面（DMButton。2026-10-17）・受信箱の未返信（テーマの札だけ）・見本（/dev/preview/message-topics）。
 *   onSend を渡さなければ「送る」は押せない（見本）。
 *
 * - 書く画面（FirstMessageComposer）と、受け取った側の見え方（FirstMessageCard）と、一覧の1行（FirstMessageRow）
 * - 送り主はいつも「人」。名前の横に所属企業を出す（設計メモ ①）
 * - 受け取った側の返信欄は既存の RequestReplyBox（返信するとそのまま会話。受け入れるボタンは無い）
 */

export type FirstMessageSender = { name: string; companyName: string | null; role: string | null; isRecruiter: boolean };

const card: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px", background: "#fff", minWidth: 0 };

function senderLine(s: FirstMessageSender): string {
  return [s.companyName, s.role].filter(Boolean).join(" ");
}

/** 書く画面 */
export function FirstMessageComposer({ recipientName, recipientLine, sections, onSend, onCancel, sample = false, titleId }: {
  recipientName: string;
  /** 相手の見出し（「Salesforce ／ アカウントエグゼクティブ」など） */
  recipientLine: string | null;
  sections: TopicSection[];
  /** エラーの文言を返す（成功なら null）。見本では渡さない */
  onSend?: (topic: MessageTopic, note: string) => Promise<string | null>;
  /** 「やめる」（ダイアログの中で使うとき） */
  onCancel?: () => void;
  sample?: boolean;
  /** ダイアログの aria-labelledby に使う見出しの id */
  titleId?: string;
}) {
  const [topic, setTopic] = useState<MessageTopic | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteId = useId();
  const tooLong = note.length > FIRST_NOTE_MAX;
  const ready = !!topic && note.trim().length > 0 && !tooLong;
  const canSend = ready && !busy && !!onSend;

  const send = async () => {
    if (!canSend || !topic || !onSend) return;
    setBusy(true); setError(null);
    try { const e = await onSend(topic, note.trim()); if (e) setError(e); } finally { setBusy(false); }
  };

  return (
    <div data-state="first-message-composer" style={{ ...card, display: "grid", gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <div id={titleId} style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{recipientName}さんにメッセージを送る</div>
        {recipientLine && <div style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={recipientLine}>{recipientLine}</div>}
      </div>

      <fieldset style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", padding: 0, marginBottom: 8 }}>聞きたいこと</legend>
        <div style={{ display: "grid", gap: 12 }}>
          {sections.map((s) => (
            <div key={s.group} data-topic-group={s.group} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>{s.title}</div>
              <div role="radiogroup" aria-label={s.title} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {s.topics.map((t) => {
                  const on = topic === t.value;
                  return (
                    <button key={t.value} type="button" role="radio" aria-checked={on} data-topic={t.value} className="btn-fixed-size"
                      onClick={() => setTopic(on ? null : t.value)}
                      style={{ padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: on ? 700 : 500, fontFamily: "inherit", cursor: "pointer",
                        border: `1.5px solid ${on ? "var(--royal)" : "var(--line)"}`, background: on ? "var(--royal-50)" : "#fff", color: on ? "var(--royal)" : "var(--ink-soft)" }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <div style={{ minWidth: 0 }}>
        <label htmlFor={noteId} style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>ひとこと</label>
        <textarea id={noteId} value={note} rows={2} onChange={(e) => setNote(e.target.value)}
          placeholder="なぜ聞きたいかを、ひとことで（例: 来年マネージャーになる予定で、最初の1年のことを伺いたいです）"
          style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${tooLong ? "var(--error)" : "var(--line)"}`, fontSize: 14, lineHeight: 1.7, fontFamily: "inherit", resize: "vertical" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 12, color: tooLong ? "var(--error)" : "var(--ink-mute)", marginTop: 4 }}>{note.length} / {FIRST_NOTE_MAX}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)", minWidth: 0, flex: "1 1 240px" }}>
          相手が返信すると、そのままメッセージでやり取りが始まります。返信があるまで、続けて送ることはできません。
        </p>
        <span style={{ display: "inline-flex", gap: 8, marginLeft: "auto" }}>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy} className="tap-min-h"
            style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: busy ? "default" : "pointer" }}>
            やめる
          </button>
        )}
        <button type="button" className="tap-min-h" data-action="send-first" disabled={!canSend} aria-disabled={sample || undefined}
          onClick={() => void send()}
          style={{ padding: "10px 24px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
            background: ready ? "var(--royal)" : "var(--line)", color: ready ? "#fff" : "var(--ink-mute)", cursor: canSend ? "pointer" : "default", opacity: sample && ready ? 0.85 : 1 }}>
          {busy ? "送信中…" : "送る"}
        </button>
        </span>
      </div>
      {error && <p role="alert" style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{error}</p>}
    </div>
  );
}

/** 受け取った側の見え方（返信欄つき） */
export function FirstMessageCard({ sender, topic, note, dateText, sample = false, onSend, onDecline }: {
  sender: FirstMessageSender;
  topic: MessageTopic;
  note: string;
  dateText: string;
  sample?: boolean;
  onSend?: (body: string) => Promise<string | null>;
  onDecline?: () => Promise<string | null>;
}) {
  const line = senderLine(sender);
  return (
    <div data-state="first-message-card" style={card}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
        <FromTag label={sender.isRecruiter && topic.startsWith("hiring_") ? "企業から" : "個人から"} />
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{sender.name}</span>
        {line && <span style={{ fontSize: 12.5, color: "var(--ink-mute)", minWidth: 0 }}>{line}</span>}
        <span style={{ fontSize: 12, color: "var(--ink-mute)", marginLeft: "auto" }}>{dateText}</span>
      </div>
      <div style={{ marginTop: 10 }}>
        <span data-state="first-message-topic" style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: "var(--royal-50)", color: "var(--royal)", fontSize: 12.5, fontWeight: 700 }}>
          聞きたいこと: {topicLabel(topic)}
        </span>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.8, color: "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note}</p>
      <RequestReplyBox sample={sample} onSend={onSend} onDecline={onDecline} declineNote="見送っても、相手には伝わりません。" />
    </div>
  );
}

/** 受信箱の一覧の1行 */
export function FirstMessageRow({ sender, topic, note, dateText, unread }: {
  sender: FirstMessageSender; topic: MessageTopic; note: string; dateText: string; unread: boolean;
}) {
  return (
    <div data-state="first-message-row" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderBottom: "1px solid var(--line)", minWidth: 0, background: unread ? "var(--royal-50)" : "#fff" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
          <FromTag label={sender.isRecruiter && topic.startsWith("hiring_") ? "企業から" : "個人から"} />
          <span style={{ fontSize: 14, fontWeight: unread ? 700 : 600, color: "var(--ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sender.name}>{sender.name}</span>
          {sender.companyName && <span style={{ fontSize: 12, color: "var(--ink-mute)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sender.companyName}</span>}
          <span style={{ fontSize: 12, color: "var(--ink-mute)", marginLeft: "auto", flexShrink: 0 }}>{dateText}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 3, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={note}>
          <strong style={{ fontWeight: 700, color: "var(--royal)" }}>{topicLabel(topic)}</strong>　{note}
        </div>
      </div>
    </div>
  );
}
