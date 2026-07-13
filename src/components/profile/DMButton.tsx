"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  targetUserId: string;
  targetName: string;
  targetAvatarUrl?: string | null;
};

export function DMButton({ targetUserId, targetName }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      // まず既存会話を探す
      const getRes = await fetch(`/api/dm/start?targetUserId=${targetUserId}`);
      if (getRes.status === 401) {
        router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (getRes.ok) {
        const getData = await getRes.json();
        if (getData.conversation?.id) {
          router.push(`/mypage/conversations?open=${getData.conversation.id}`);
          return;
        }
      }

      // 既存会話がない場合はスレッドだけ作成（メッセージなし）
      const postRes = await fetch("/api/dm/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      if (postRes.status === 401) {
        router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (postRes.ok) {
        const postData = await postRes.json();
        const convId = postData.conversationId;
        if (convId) {
          router.push(`/mypage/conversations?open=${convId}`);
          return;
        }
      }

      // それでも取れなければリスト画面へ
      router.push("/mypage/conversations");
    } catch {
      setError("エラーが発生しました");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "9px 18px", borderRadius: 8,
          border: "1.5px solid var(--royal-100)",
          background: loading ? "var(--line)" : "var(--royal-50)",
          color: loading ? "var(--ink-mute)" : "var(--royal)",
          fontSize: 13, fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          flexShrink: 0, whiteSpace: "nowrap",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {loading ? "準備中..." : `${targetName} にDMを送る`}
      </button>
      {error && <span style={{ fontSize: 12, color: "var(--error)" }}>{error}</span>}
    </>
  );
}
