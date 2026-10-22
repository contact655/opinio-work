"use client";

import { useCallback, useEffect, useState } from "react";
import { AskPicker, type AskValue } from "@/components/messages/FirstMessage";
import { PENDING_FOLLOW_UP_MAX_LENGTH } from "@/lib/constants/messages";

type State = { kind: "none" } | { kind: "allowed" };

/**
 * ★返事待ちの会話の入力欄（2026-10-22 / 柴さんの判断・A案）。
 *   返信が無くても続けて送れる（2026-10-23 に回数と日数の制限を外した / 柴さんの指示）。送れないときは理由の1行だけ出す。
 *   判定は GET /api/dm/follow-up（送る API と同じ pendingFollowUpState）
 *   ⚠️ 一覧と並んだ画面（ConversationsClient）と会話だけの画面（ConversationDetailClient）の両方で使う。片方だけ変えないこと
 */
export function PendingFollowUp({ conversationId, fallbackText, onSent }: {
  conversationId: string;
  /** 読み込み前・取得に失敗したときの1行 */
  fallbackText: string;
  onSent: () => void | Promise<void>;
}) {
  const [state, setState] = useState<State | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [ask, setAsk] = useState<AskValue>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/dm/follow-up?conversationId=${encodeURIComponent(conversationId)}`);
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) { setState(null); setMessage(null); return; }
      setState(d.state as State);
      setMessage((d.message as string | null) ?? null);
    } catch { setState(null); setMessage(null); }
  }, [conversationId]);
  useEffect(() => { setText(""); setAsk(null); setError(null); void load(); }, [load]);

  const tooLong = text.trim().length > PENDING_FOLLOW_UP_MAX_LENGTH;
  const send = async () => {
    if (!text.trim() || tooLong || sending) return;
    setSending(true); setError(null);
    try {
      const r = await fetch("/api/dm/message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text.trim(), topic: ask?.topic ?? null, format: ask?.format ?? null, askCompanyId: ask?.companyId ?? null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "送信に失敗しました"); return; }
      setText(""); setAsk(null);
      await onSent();
      await load();
    } finally { setSending(false); }
  };

  if (state?.kind !== "allowed") {
    return (
      <p data-state="request-pending-banner" data-follow-up={state?.kind ?? "unknown"} style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        {message ?? fallbackText}
      </p>
    );
  }
  return (
    <div data-state="follow-up-composer" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", lineHeight: 1.6 }}>
        まだ返信がありません。返信が無くても、続けて送れます。
      </p>
      <AskPicker conversationId={conversationId} value={ask} onChange={setAsk} disabled={sending} />
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} disabled={sending}
          aria-label="メッセージを入力" placeholder="メッセージを入力…"
          style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${tooLong ? "var(--error)" : "var(--line)"}`, fontSize: 13, lineHeight: 1.5, resize: "none", fontFamily: "inherit", color: "var(--ink)" }} />
        <button type="button" onClick={() => void send()} disabled={sending || !text.trim() || tooLong} data-action="send-follow-up"
          style={{ padding: "9px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, flexShrink: 0, fontFamily: "inherit",
            cursor: sending || !text.trim() || tooLong ? "not-allowed" : "pointer",
            background: sending || !text.trim() || tooLong ? "var(--line)" : "var(--royal)", color: sending || !text.trim() || tooLong ? "var(--ink-mute)" : "#fff" }}>
          {sending ? "送信中…" : "送信"}
        </button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: tooLong ? "var(--error)" : "var(--ink-mute)" }}>
        <span>{error ? <span role="alert" style={{ color: "var(--error)", fontWeight: 600 }}>{error}</span> : null}</span>
        <span>{text.trim().length} / {PENDING_FOLLOW_UP_MAX_LENGTH}</span>
      </div>
    </div>
  );
}
