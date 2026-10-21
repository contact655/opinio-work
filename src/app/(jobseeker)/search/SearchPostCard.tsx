"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PostHit } from "@/lib/search/postHits";
import { LinkPreviewCard } from "@/components/feed/LinkPreviewCard";
import { LikersDialog } from "@/components/feed/LikersDialog";
import { CommentSection } from "../feed/(list)/FeedClient";

/**
 * ★検索結果の投稿カード（2026-10-21 / 柴さんの指示。ホームのカードと同じ見え方・同じ操作）。
 *   投稿者・日時・本文（長ければ畳む）・画像・リンク・いいね・コメント（その場で開く）。
 * ⚠️ いいね・コメントはホームと同じ API（/api/jobseeker/posts/[id]/likes と CommentSection）を使う。別の経路を作らない
 * ⚠️ 本文の中の検索語は太字にする（なぜ当たったかが分かるように）
 * ⚠️ ホームの PostCard は使っていない（フィードの一覧の状態に強く結びついているため）。見た目を変えるときはホームと揃えること
 */
export type ViewerInfo = { myUserId: string | null; myName: string | null; myAvatarColor: string | null; myAvatarUrl: string | null };

const CLAMP_CHARS = 220;

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}日前`;
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean);
  if (escaped.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        terms.some((t) => t.toLowerCase() === p.toLowerCase())
          ? <strong key={i} style={{ color: "var(--ink)", fontWeight: 700 }}>{p}</strong>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}

const actionBtn = (active: boolean, color: string): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer",
  padding: "6px 12px", borderRadius: 8, color: active ? color : "var(--ink-soft)",
  fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 13, fontWeight: active ? 700 : 500,
});

export function SearchPostCard({ item, viewer }: { item: PostHit; viewer: ViewerInfo }) {
  const router = useRouter();
  const [liked, setLiked] = useState(item.likedByMe);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [liking, setLiking] = useState(false);
  const [commentCount, setCommentCount] = useState(item.commentCount);
  const [showComments, setShowComments] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const long = item.content.length > CLAMP_CHARS;
  const body = long && !expanded ? `${item.content.slice(0, CLAMP_CHARS)}…` : item.content;

  const toggleLike = async () => {
    if (!viewer.myUserId) { router.push("/auth?next=/search"); return; }
    if (liking) return;
    const was = liked;
    setLiking(true);
    setLiked(!was); setLikeCount((n) => Math.max(0, n + (was ? -1 : 1)));
    try {
      const res = await fetch(`/api/jobseeker/posts/${item.id}/likes`, { method: was ? "DELETE" : "POST" });
      if (!res.ok) { setLiked(was); setLikeCount((n) => Math.max(0, n + (was ? 1 : -1))); }
    } catch {
      setLiked(was); setLikeCount((n) => Math.max(0, n + (was ? 1 : -1)));
    } finally {
      setLiking(false);
    }
  };

  return (
    <article data-state="search-post" style={{ padding: "14px 14px 8px", borderRadius: 12, border: "1px solid var(--line)", background: "#fff", minWidth: 0 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Link href={`/u/${item.author.id}`} style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0, textDecoration: "none", color: "inherit" }}>
          {item.author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.author.avatarUrl} alt="" width={40} height={40} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: item.author.gradient, color: "#fff", fontWeight: 700, display: "grid", placeItems: "center", fontSize: 15 }}>
              {item.author.initial}
            </span>
          )}
          <span style={{ minWidth: 0, display: "block" }}>
            <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.author.name}</span>
            <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-mute)" }}>{relativeTime(item.createdAt)}</span>
          </span>
        </Link>
      </div>

      <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--ink)", lineHeight: 1.75, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        <Highlight text={body} terms={item.terms} />
        {long && (
          <button type="button" onClick={() => setExpanded((v) => !v)}
            style={{ marginLeft: 4, background: "none", border: "none", padding: 0, color: "var(--ink-mute)", fontWeight: 600, fontSize: 13, cursor: "pointer", minHeight: 0 }}>
            {expanded ? "閉じる" : "もっと見る"}
          </button>
        )}
      </p>

      {item.imageUrl && (
        <Link href={`/feed/${item.id}`} style={{ display: "block", marginTop: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt="" style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 10, display: "block" }} />
        </Link>
      )}
      {item.link && (
        <div style={{ marginTop: 10 }}>
          <LinkPreviewCard linkUrl={item.link.url} linkTitle={item.link.title} linkImageUrl={item.link.imageUrl}
            linkDescription={item.link.description} linkDomain={item.link.domain} />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 8, marginTop: 10, borderTop: "1px solid var(--line-soft, #f1f5f9)" }}>
        <button type="button" onClick={toggleLike} disabled={liking} aria-pressed={liked} data-action="search-post-like"
          title={viewer.myUserId ? (liked ? "いいねを解除" : "いいね") : "ログインしていいね"} style={actionBtn(liked, "var(--error)")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={liked ? 1.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span>いいね</span>
        </button>
        {likeCount > 0 && (
          <button type="button" data-action="open-likers" onClick={() => setShowLikers(true)}
            aria-label={`いいねした人を見る（${likeCount}人）`}
            style={{ background: "none", border: "none", padding: "6px 4px", cursor: "pointer", fontSize: 12.5, color: "var(--ink-mute)", fontWeight: 600 }}>
            {likeCount}
          </button>
        )}
        {showLikers && <LikersDialog postId={item.id} onClose={() => setShowLikers(false)} />}
        <button type="button" onClick={() => setShowComments((v) => !v)} aria-expanded={showComments} data-action="search-post-comments"
          style={actionBtn(showComments, "var(--royal)")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>コメント{commentCount > 0 ? ` ${commentCount}` : ""}</span>
        </button>
        <Link href={`/feed/${item.id}`} style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--ink-mute)", textDecoration: "none", padding: "6px 8px" }}>
          投稿を開く
        </Link>
      </div>

      {showComments && (
        <CommentSection postId={item.id} myUserId={viewer.myUserId} myName={viewer.myName}
          myAvatarColor={viewer.myAvatarColor} myAvatarUrl={viewer.myAvatarUrl}
          onCommentCountChange={(d) => setCommentCount((c) => Math.max(0, c + d))} />
      )}
    </article>
  );
}
