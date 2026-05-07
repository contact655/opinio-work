"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  conversationId: string;
};

export function JoinButton({ conversationId }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/biz/conversations/${conversationId}/join`,
        { method: "POST" }
      );

      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "参加に失敗しました");
      }

      // Server Component を再取得してページ状態を更新
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "参加に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      borderTop: "1px solid var(--line-soft)",
      padding: "16px",
      background: "var(--bg-tint)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 10,
    }}>
      <p style={{
        fontSize: 13,
        color: "var(--ink-soft)",
        margin: 0,
        textAlign: "center",
      }}>
        担当者としてこの対話に参加すると、メッセージの送受信ができます。
      </p>

      <button
        onClick={handleJoin}
        disabled={submitting}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 22px",
          borderRadius: 8,
          border: "none",
          cursor: submitting ? "default" : "pointer",
          fontFamily: "'Noto Sans JP', sans-serif",
          fontWeight: 600,
          fontSize: 14,
          background: submitting ? "var(--line)" : "var(--royal)",
          color: submitting ? "var(--ink-mute)" : "#fff",
          transition: "background 0.15s, color 0.15s",
        }}
      >
        {submitting ? (
          <>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              style={{ animation: "spin 0.8s linear infinite" }}
            >
              <circle
                cx="7" cy="7" r="5"
                stroke="currentColor" strokeOpacity="0.3" strokeWidth="2"
              />
              <path
                d="M7 2 A5 5 0 0 1 12 7"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              />
            </svg>
            参加中…
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
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            この対話に参加する
          </>
        )}
      </button>

      {error && (
        <p style={{
          fontSize: 12,
          color: "var(--error)",
          margin: 0,
          textAlign: "center",
        }}>
          {error}
        </p>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
