"use client";

import { useEffect, useRef, useState } from "react";
import { INTEREST_CONSENT_VERSION, INTEREST_NOTE_MAX, interestConfirmText } from "@/lib/interest/constants";

/**
 * ★「話を聞いてみたい」を押す前の確認（2026-10-27 / 話を聞きたい人 フェーズ1a）。
 *   企業ページ・合う会社の下段・上段の提案で**同じ部品**を使う。文言は lib/interest/constants.ts の interestConfirmText だけ。
 * ⚠️ 送るときに consentVersion（見せた文言の版）を一緒に送る。サーバーは今の版でなければ受け付けない。
 * ⚠️ 押すまで何も届かない。［やめる］では何も記録しない。
 * ⚠️ 担当者がいない会社では出さない（ボタンごと出さず、「保存」だけ）。
 */
export default function InterestConfirmDialog(props: {
  open: boolean;
  companyName: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (input: { note: string; consentVersion: string }) => void;
}) {
  const [note, setNote] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (!props.open) return;
    setNote("");
    const t = setTimeout(() => ref.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !props.busy) props.onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);
  if (!props.open) return null;
  const text = interestConfirmText(props.companyName);
  return (
    <div role="presentation" onClick={() => { if (!props.busy) props.onCancel(); }}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="interest-confirm-title" data-state="interest-confirm"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 14, padding: "20px 20px 16px", boxShadow: "0 10px 40px rgba(0,0,0,0.18)" }}>
        <h2 id="interest-confirm-title" style={{ fontSize: 17, fontWeight: 700, margin: "0 0 10px" }}>{text.title}</h2>
        <div data-state="interest-confirm-deliver" style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink)" }}>
          {text.body.map((line) => <p key={line} style={{ margin: 0 }}>{line}</p>)}
        </div>
        <label htmlFor="interest-note" style={{ display: "block", fontSize: 12, fontWeight: 600, margin: "14px 0 4px" }}>
          会社へのひとこと<span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>（任意・{INTEREST_NOTE_MAX}字まで）</span>
        </label>
        <textarea id="interest-note" ref={ref} value={note} maxLength={INTEREST_NOTE_MAX} rows={3}
          onChange={(e) => setNote(e.target.value)} placeholder="聞いてみたいことや、いまの状況など"
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 16, lineHeight: 1.6, resize: "vertical", boxSizing: "border-box" }} />
        <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "2px 0 0", textAlign: "right" }}>{note.length} / {INTEREST_NOTE_MAX}</p>
        {props.error && (
          <p role="alert" style={{ fontSize: 13, color: "#B3261E", margin: "6px 0 0" }}>{props.error}</p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button type="button" onClick={props.onCancel} disabled={props.busy}
            style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "none", color: "var(--ink-soft)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            やめる
          </button>
          <button type="button" data-action="interest-confirm" disabled={props.busy}
            onClick={() => props.onConfirm({ note: note.trim(), consentVersion: INTEREST_CONSENT_VERSION })}
            style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: props.busy ? "default" : "pointer", opacity: props.busy ? 0.6 : 1 }}>
            {props.busy ? "届けています…" : "届ける"}
          </button>
        </div>
      </div>
    </div>
  );
}
