"use client";

import { useId, useState } from "react";

/**
 * ★届いたメッセージリクエストの返信欄（2026-10-11 / 柴さんの指示。LinkedIn の InMail に寄せた）。
 *   **企業からのリクエスト（/mypage/approaches）・個人からのリクエスト（/mypage/conversations）・
 *   企業の画面の見本（/biz/approaches の「見本：相手にはこう届きます」）が同じ部品を使う。**
 * ⚠️★片方だけ書き換えないこと（見本が嘘になる）。
 *
 * - ひな形のボタンは返信欄に文を入れるだけ。送るのは本人が「送信」を押したとき
 * - 「今回は見送る」は返信欄の下に小さく。押すと1行の説明（declineNote）と「見送る」「やめる」を出す
 * - sample のときは押せない見た目にし、押しても何も起きない（aria-disabled。入力もできない）
 * - extra … 個人からのリクエストの「ブロック」「運営に報告」など、見送りの横に置くもの
 */
export const REPLY_TEMPLATES = ["話を聞いてみたいです", "まず質問させてください"] as const;
export const REPLY_MAX = 2000;

export function RequestReplyBox({
  onSend,
  onDecline,
  declineNote,
  sample = false,
  extra,
}: {
  /** 送信。エラーの文言を返す（成功なら null。成功したら呼び出し側が画面を移す） */
  onSend?: (body: string) => Promise<string | null>;
  onDecline?: () => Promise<string | null>;
  /** 「見送っても企業には伝わりません」など */
  declineNote: string;
  sample?: boolean;
  extra?: React.ReactNode;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const id = useId();
  const len = text.trim().length;
  const tooLong = text.length > REPLY_MAX;
  const canSend = !sample && !busy && len > 0 && !tooLong;

  const send = async () => {
    if (!canSend || !onSend) return;
    setBusy(true); setError(null);
    try {
      const err = await onSend(text);
      if (err) setError(err);
    } finally {
      setBusy(false);
    }
  };
  const decline = async () => {
    if (sample || busy || !onDecline) return;
    setBusy(true); setError(null);
    try {
      const err = await onDecline();
      if (err) setError(err);
    } finally {
      setBusy(false);
    }
  };
  const inert = (e: React.SyntheticEvent) => { if (sample) e.preventDefault(); };

  return (
    <div data-state={sample ? "reply-box-sample" : "reply-box"} style={{ marginTop: 14, minWidth: 0 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {REPLY_TEMPLATES.map((t) => (
          <button key={t} type="button" className="btn-fixed-size" aria-disabled={sample || undefined} data-template={t}
            onClick={(e) => { if (sample) { inert(e); return; } setText((cur) => (cur.trim() ? `${cur.trimEnd()}\n${t}` : t)); }}
            style={{ padding: "5px 12px", borderRadius: 999, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: sample ? "default" : "pointer", opacity: sample ? 0.6 : 1 }}>
            {t}
          </button>
        ))}
      </div>
      <label htmlFor={id} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>返信</label>
      <textarea id={id} value={text} readOnly={sample} aria-disabled={sample || undefined}
        onChange={(e) => { if (!sample) setText(e.target.value); }}
        placeholder="返信を書く（返信すると、そのままメッセージでやり取りが始まります）"
        rows={3}
        style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14, lineHeight: 1.7, fontFamily: "inherit", resize: "vertical", background: sample ? "var(--bg-tint, #f6f7f9)" : "#fff", color: "var(--ink)" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: tooLong ? "var(--error)" : "var(--ink-mute)" }}>{text.length} / {REPLY_MAX}</span>
        <button type="button" className="tap-min-h" data-action="send" aria-disabled={sample || undefined} disabled={!sample && !canSend}
          onClick={(e) => { if (sample) { inert(e); return; } void send(); }}
          style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: canSend ? "var(--royal)" : "var(--line)", color: canSend ? "#fff" : "var(--ink-mute)", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: canSend ? "pointer" : "default", opacity: sample ? 0.6 : 1 }}>
          {busy ? "送信中…" : "送信"}
        </button>
      </div>
      {error && <p role="alert" style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{error}</p>}

      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {!confirmDecline ? (
          <button type="button" data-action="decline" aria-disabled={sample || undefined}
            onClick={(e) => { if (sample) { inert(e); return; } setConfirmDecline(true); }}
            style={{ background: "none", border: "none", padding: "4px 0", fontSize: 12.5, color: "var(--ink-mute)", textDecoration: "underline", fontFamily: "inherit", cursor: sample ? "default" : "pointer" }}>
            今回は見送る
          </button>
        ) : (
          <span data-state="decline-confirm" style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: "var(--ink-soft)" }}>
            {declineNote}
            <button type="button" data-action="decline-confirm" disabled={busy} onClick={() => { void decline(); }}
              style={{ padding: "4px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>見送る</button>
            <button type="button" onClick={() => setConfirmDecline(false)}
              style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, color: "var(--ink-mute)", fontFamily: "inherit", cursor: "pointer" }}>やめる</button>
          </span>
        )}
        {extra}
      </div>
    </div>
  );
}
