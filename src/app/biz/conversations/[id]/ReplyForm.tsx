"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  conversationId: string;
};

export function ReplyForm({ conversationId }: Props) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = text.trim().length > 0 && !submitting;

  // Auto-resize textarea
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/biz/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        }
      );

      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        setError(data.error ?? "送信に失敗しました");
        return;
      }

      // Clear and refresh
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      router.refresh();
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  // Cmd+Enter / Ctrl+Enter to submit
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (canSubmit) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  }

  return (
    <div
      style={{
        borderTop: "1px solid var(--line-soft)",
        padding: "14px 16px",
        background: "#fff",
      }}
    >
      {/* Error banner */}
      {error && (
        <div
          style={{
            marginBottom: 10,
            padding: "8px 12px",
            borderRadius: 8,
            background: "var(--error-soft)",
            border: "1px solid #FECACA",
            fontSize: 12,
            color: "var(--error)",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "var(--bg-tint)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "10px 12px",
            transition: "border-color 0.15s",
          }}
          onFocus={() => {/* handled via CSS :focus-within */}}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={submitting}
            placeholder="メッセージを入力… (⌘+Enter で送信)"
            aria-label="返信メッセージ"
            rows={2}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              resize: "none",
              fontFamily: "'Noto Sans JP', sans-serif",
              fontSize: 14,
              color: "var(--ink)",
              lineHeight: 1.6,
              minHeight: 52,
              maxHeight: 200,
              overflow: "auto",
            }}
          />

          {/* Bottom row: char count + send button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            {/* Character count */}
            {text.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  color: text.length > 4800 ? "var(--error)" : "var(--ink-mute)",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {text.length} / 5000
              </span>
            )}

            {/* Send button */}
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 16px",
                borderRadius: 8,
                border: "none",
                cursor: canSubmit ? "pointer" : "default",
                fontFamily: "'Noto Sans JP', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                background: canSubmit
                  ? "var(--royal)"
                  : "var(--line)",
                color: canSubmit ? "#fff" : "var(--ink-mute)",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {submitting ? (
                <>
                  {/* Minimal spinner */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    style={{ animation: "spin 0.8s linear infinite" }}
                  >
                    <circle
                      cx="7"
                      cy="7"
                      r="5"
                      stroke="currentColor"
                      strokeOpacity="0.3"
                      strokeWidth="2"
                    />
                    <path
                      d="M7 2 A5 5 0 0 1 12 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  送信中…
                </>
              ) : (
                <>
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                  送信
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
