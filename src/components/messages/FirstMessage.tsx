"use client";

import { useId, useState } from "react";
import { FromTag } from "@/components/mypage/InboxCard";
import { RequestReplyBox, personReplyTemplates } from "@/components/approaches/RequestReplyBox";
import { DEFAULT_MESSAGE_FORMAT, FIRST_NOTE_MAX, MESSAGE_FORMATS, askTagLines, formatLabel, topicLabel, type MessageFormat, type MessageTopic, type TopicSection } from "@/lib/constants/messageTopics";

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
export function FirstMessageComposer({ recipientName, recipientLine, sections, onSend, onCancel, onBack, sample = false, titleId }: {
  /** ★「種類を選び直す」（2026-10-20。DMButton が「キャリアの相談をする」を選んだあとに出す） */
  onBack?: () => void;
  recipientName: string;
  /** 相手の見出し（「Salesforce ／ アカウントエグゼクティブ」など） */
  recipientLine: string | null;
  sections: TopicSection[];
  /** エラーの文言を返す（成功なら null）。見本では渡さない */
  onSend?: (topic: MessageTopic, note: string, format: MessageFormat) => Promise<string | null>;
  /** 「やめる」（ダイアログの中で使うとき） */
  onCancel?: () => void;
  sample?: boolean;
  /** ダイアログの aria-labelledby に使う見出しの id */
  titleId?: string;
}) {
  const [topic, setTopic] = useState<MessageTopic | null>(null);
  const [note, setNote] = useState("");
  /* ★話を聞く形（2026-10-18）。既定は「メッセージで」（押さなくても送れる） */
  const [format, setFormat] = useState<MessageFormat>(DEFAULT_MESSAGE_FORMAT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteId = useId();
  const tooLong = note.length > FIRST_NOTE_MAX;
  const ready = !!topic && note.trim().length > 0 && !tooLong;
  const canSend = ready && !busy && !!onSend;

  const send = async () => {
    if (!canSend || !topic || !onSend) return;
    setBusy(true); setError(null);
    try { const e = await onSend(topic, note.trim(), format); if (e) setError(e); } finally { setBusy(false); }
  };

  return (
    <div data-state="first-message-composer" style={{ ...card, display: "grid", gap: 16 }}>
      {onBack && (
        <button type="button" onClick={onBack} data-action="dm-back"
          style={{ justifySelf: "start", background: "none", border: "none", padding: 0, fontSize: 12.5, color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit" }}>
          ← 種類を選び直す
        </button>
      )}
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

      {/* ★話を聞く形（2026-10-18 / 柴さんの判断。キャリアの先輩に話を聞く依頼）。⚠️ 対面は無い。日程は決めない（返信があったらメッセージで） */}
      <fieldset style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", padding: 0, marginBottom: 8 }}>どんな形で</legend>
        <div role="radiogroup" aria-label="どんな形で" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {MESSAGE_FORMATS.map((f) => {
            const on = format === f.value;
            return (
              <button key={f.value} type="button" role="radio" aria-checked={on} data-format={f.value} className="btn-fixed-size"
                onClick={() => setFormat(f.value)}
                style={{ padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: on ? 700 : 500, fontFamily: "inherit", cursor: "pointer",
                  border: `1.5px solid ${on ? "var(--royal)" : "var(--line)"}`, background: on ? "var(--royal-50)" : "#fff", color: on ? "var(--royal)" : "var(--ink-soft)" }}>
                {f.label}
              </button>
            );
          })}
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
          {/* ★2026-10-22 に短くした。⚠️ 押せない理由を先に出す（何を選べば送れるかが画面に無かった） */}
          {!ready && !sample ? (
            <span data-state="first-message-missing" style={{ display: "block", fontWeight: 600, color: "var(--ink-soft)" }}>
              {!topic ? "聞きたいことを1つ選んでください。" : tooLong ? `ひとことは${FIRST_NOTE_MAX}字までです。` : "ひとことを書いてください。"}
            </span>
          ) : null}
          返信があるとやり取りが始まります。返信が無くても、続けて送れます。{format !== DEFAULT_MESSAGE_FORMAT && "話す日時は、返信のあとに決めます。"}
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

/** ★会話の先頭に出す1行（2026-10-17）。最初の1通で選んだテーマ。送り手・受け手の両方の会話画面で使う */
export function FirstTopicNotice({ topic, format = null, aboutCompanyName = null }: { topic: MessageTopic; format?: MessageFormat | null; aboutCompanyName?: string | null }) {
  return (
    <div data-state="first-topic-notice" style={{ display: "flex", justifyContent: "center" }}>
      <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: "var(--royal-50)", color: "var(--royal)", fontSize: 12, fontWeight: 700 }}>
        最初のメッセージで聞きたいこと: {topicLabel(topic, aboutCompanyName)}{format ? `・${formatLabel(format)}` : ""}
      </span>
    </div>
  );
}

/** 受け取った側の見え方（返信欄つき） */
export function FirstMessageCard({ sender, topic, format = null, aboutCompanyName = null, note, dateText, sample = false, onSend, onDecline }: {
  sender: FirstMessageSender;
  topic: MessageTopic;
  format?: MessageFormat | null;
  aboutCompanyName?: string | null;
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
          聞きたいこと: {topicLabel(topic, aboutCompanyName)}
        </span>
        {format && (
          <span data-state="first-message-format" style={{ display: "inline-block", marginLeft: 6, padding: "3px 10px", borderRadius: 999, background: "var(--bg-tint)", color: "var(--ink-soft)", fontSize: 12.5, fontWeight: 600 }}>
            {formatLabel(format)}
          </span>
        )}
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.8, color: "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note}</p>
      <RequestReplyBox sample={sample} onSend={onSend} onDecline={onDecline} declineNote="見送っても、相手には伝わりません。"
        templates={sender.isRecruiter && topic.startsWith("hiring_") ? undefined : personReplyTemplates(format)} />
    </div>
  );
}

/** 受信箱の一覧の1行 */
export function FirstMessageRow({ sender, topic, format = null, aboutCompanyName = null, note, dateText, unread }: {
  sender: FirstMessageSender; topic: MessageTopic; format?: MessageFormat | null; aboutCompanyName?: string | null; note: string; dateText: string; unread: boolean;
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
          <strong style={{ fontWeight: 700, color: "var(--royal)" }}>{topicLabel(topic, aboutCompanyName)}{format ? `・${formatLabel(format)}` : ""}</strong>　{note}
        </div>
      </div>
    </div>
  );
}

/**
 * ★1通ごとの「聞きたいこと」の札（2026-10-22 / 柴さんの了承）。吹き出しの本文の上に出す。
 *   1行目「聞きたいこと：海光電業の事業・プロダクト」／2行目「メッセージで」。札が無い1通はふつうのメッセージ。
 *   ⚠️ 会話の上の帯（FirstTopicNotice）には戻さないこと（2通目以降に付けられず、ふつうのメッセージとの関係が分からなかった）
 */
export function AskTag({ topic, format, companyName }: { topic: MessageTopic; format: MessageFormat | null; companyName: string | null }) {
  const l = askTagLines(topic, format, companyName);
  return (
    <span data-state="ask-tag" style={{ display: "block", marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid var(--line)" }}>
      <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--royal)", lineHeight: 1.6 }}>{l.topic}</span>
      {l.format && <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.6 }}>{l.format}</span>}
    </span>
  );
}

export type AskValue = { topic: MessageTopic; format: MessageFormat } | null;

/**
 * ★返信欄の「＋ 聞きたいことを添える」（2026-10-22）。押すと選択肢が開く。選ばなければふつうのメッセージ。
 *   選択肢は GET /api/dm/topics（送るときの確かめと同じ関数）。
 */
export function AskPicker({ conversationId, value, onChange, disabled = false }: {
  conversationId: string; value: AskValue; onChange: (v: AskValue) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<TopicSection[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const openPicker = async () => {
    setOpen(true);
    if (sections) return;
    try {
      const r = await fetch(`/api/dm/topics?conversationId=${encodeURIComponent(conversationId)}`);
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) { setLoadError(d?.error ?? "選択肢を読み込めませんでした"); return; }
      setSections(d.sections ?? []);
    } catch { setLoadError("選択肢を読み込めませんでした"); }
  };
  const close = () => { setOpen(false); onChange(null); };

  if (!open) {
    return (
      <button type="button" data-action="ask-open" onClick={() => void openPicker()} disabled={disabled}
        style={{ alignSelf: "flex-start", background: "none", border: "none", padding: "2px 0", fontSize: 12.5, fontWeight: 600, color: "var(--royal)", cursor: disabled ? "default" : "pointer", fontFamily: "inherit" }}>
        ＋ 聞きたいことを添える
      </button>
    );
  }
  const chip = (on: boolean): React.CSSProperties => ({ padding: "4px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: on ? 700 : 500, fontFamily: "inherit", cursor: "pointer",
    border: `1.5px solid ${on ? "var(--royal)" : "var(--line)"}`, background: on ? "var(--royal-50)" : "#fff", color: on ? "var(--royal)" : "var(--ink-soft)" });
  return (
    <div data-state="ask-picker" style={{ display: "grid", gap: 8, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-tint)", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>聞きたいこと（任意）</span>
        <button type="button" data-action="ask-close" onClick={close}
          style={{ background: "none", border: "none", padding: 0, fontSize: 12, color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit" }}>
          付けない
        </button>
      </div>
      {loadError && <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--error)" }}>{loadError}</p>}
      {!sections && !loadError && <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>読み込み中…</p>}
      {sections?.map((s) => (
        <div key={s.group} style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 4 }}>{s.title}</div>
          <div role="radiogroup" aria-label={s.title} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {s.topics.map((t) => {
              const on = value?.topic === t.value;
              return (
                <button key={t.value} type="button" role="radio" aria-checked={on} data-topic={t.value} className="btn-fixed-size" style={chip(on)}
                  onClick={() => onChange(on ? null : { topic: t.value, format: value?.format ?? DEFAULT_MESSAGE_FORMAT })}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {value && (
        <div role="radiogroup" aria-label="どんな形で" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-soft)", marginRight: 2 }}>どんな形で</span>
          {MESSAGE_FORMATS.map((f) => {
            const on = value.format === f.value;
            return (
              <button key={f.value} type="button" role="radio" aria-checked={on} data-format={f.value} className="btn-fixed-size" style={chip(on)}
                onClick={() => onChange({ topic: value.topic, format: f.value })}>
                {f.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
