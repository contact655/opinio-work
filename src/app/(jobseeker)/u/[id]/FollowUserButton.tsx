"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * ユーザーのフォローボタン。
 * 企業フォロー（CompanyDetailClient の FollowButton）と同じ挙動に揃えてある。
 *
 * ⚠️ オーナー本人には出さない。呼び出し側で viewerIsOwner を見て出し分けること。
 *    API 側でも自分自身は 400 で弾いているが、押せるボタンを出さないのが先。
 */
export function FollowUserButton({
  targetUserId,
  initialFollowed,
  isAuthenticated,
  compact = false,
}: {
  targetUserId: string;
  initialFollowed: boolean;
  isAuthenticated: boolean;
  /** 一覧のカードや右レールなど、行の高さが限られる場所で使う小さい版。
   *  ⚠️ 12px を下回らせないこと（LP以外の12px未満を潰す方針）。 */
  compact?: boolean;
}) {
  const [followed, setFollowed] = useState(initialFollowed);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggle = async () => {
    if (!isAuthenticated) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    // 楽観更新 → 失敗したら戻す
    const next = !followed;
    setFollowed(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/jobseeker/users/${targetUserId}/follow`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) setFollowed(!next);
    } catch {
      setFollowed(!next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={followed}
      style={{
        display: "inline-flex", alignItems: "center", gap: compact ? 3 : 5,
        padding: compact ? "5px 11px" : "8px 16px", borderRadius: 100,
        fontSize: compact ? 12 : 13, fontWeight: 700,
        flexShrink: 0, whiteSpace: "nowrap",
        border: `1.5px solid ${followed ? "var(--royal)" : "var(--line)"}`,
        background: followed ? "var(--royal-50)" : "#fff",
        color: followed ? "var(--royal)" : "var(--ink-soft)",
        cursor: loading ? "default" : "pointer",
        transition: "all 0.2s",
        opacity: loading ? 0.7 : 1,
        fontFamily: "inherit",
      }}
    >
      {followed ? (
        <>
          <svg width={compact ? 11 : 13} height={compact ? 11 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          フォロー中
        </>
      ) : (
        <>
          <svg width={compact ? 11 : 13} height={compact ? 11 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          フォロー
        </>
      )}
    </button>
  );
}
