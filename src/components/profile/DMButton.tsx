"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  targetUserId: string;
  targetName: string;
};

export function DMButton({ targetUserId, targetName }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/dm/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, message }),
      });
      if (res.status === 401) {
        router.push(`/auth?next=/u/${targetUserId}`);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "送信に失敗しました");
      router.push(`/mypage/conversations/${data.conversationId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "9px 18px", borderRadius: 8,
          border: "1.5px solid var(--royal-100)", background: "var(--royal-50)",
          color: "var(--royal)", fontSize: 13, fontWeight: 700,
          cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        DMを送る
      </button>

      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480,
            boxShadow: "0 20px 60px rgba(15,23,42,0.18)",
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                  {targetName} さんにDMを送る
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
                  返信があればマイページ→会話で確認できます
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--ink-mute)", fontSize: 18, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 20 }}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`${targetName} さんへのメッセージを書いてください...`}
                rows={5}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "12px 14px", borderRadius: 10,
                  border: "1.5px solid var(--line)", outline: "none",
                  fontSize: 14, lineHeight: 1.7, resize: "vertical",
                  fontFamily: "inherit", color: "var(--ink)",
                  background: "var(--bg-tint)",
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
                }}
              />
              {error && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--error)" }}>{error}</div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "0 20px 20px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  padding: "9px 18px", borderRadius: 8, cursor: "pointer",
                  border: "1.5px solid var(--line)", background: "#fff",
                  color: "var(--ink-soft)", fontSize: 13, fontWeight: 600,
                }}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !message.trim()}
                style={{
                  padding: "9px 20px", borderRadius: 8, cursor: sending || !message.trim() ? "not-allowed" : "pointer",
                  background: sending || !message.trim() ? "var(--line)" : "var(--royal)",
                  color: sending || !message.trim() ? "var(--ink-mute)" : "#fff",
                  fontSize: 13, fontWeight: 700, border: "none",
                  transition: "background 0.15s",
                }}
              >
                {sending ? "送信中..." : "送信する (⌘+Enter)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
