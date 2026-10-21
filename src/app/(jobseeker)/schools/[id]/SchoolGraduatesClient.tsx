"use client";

import { useState } from "react";
import type React from "react";
import Link from "next/link";
import { LinkPreviewCard } from "@/components/feed/LinkPreviewCard";
import { PeopleCardRow, JOB_PEOPLE_CSS } from "@/components/jobs/JobPeopleCards";
import { AVATAR_COLOR } from "@/lib/avatarColor";

// ─── 型定義 ───────────────────────────────────────────────────────────────────

export type Graduate = {
  userId: string;
  name: string;
  avatarInitial: string;
  avatarGradient: string;
  avatarUrl: string | null;
  catchphrase: string | null;
  faculty: string | null;
  degree: string | null;
  graduatedAt: string | null;
  /** ★在学中か（学歴の is_current。2026-10-21） */
  isCurrent: boolean;
  currentCompany: string | null;
  currentRoleTitle: string | null;
  careerSummary: string | null;
};

export type SchoolPost = {
  id: string;
  content: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkTitle: string | null;
  linkImageUrl: string | null;
  linkDescription: string | null;
  linkDomain: string | null;
  createdAt: string;
  userId: string;
  userName: string;
  userAvatarColor: string | null;
  userAvatarUrl: string | null;
};

type Props = {
  graduates: Graduate[];
  posts: SchoolPost[];
  /** ⚠️ 空状態の文言だけに使う。既定 false（fail-closed＝「登録がありません」と断定しない側） */
  isLoggedIn?: boolean;
  /** ★出身者を並べる学校か（大学・大学院・高校だけ。2026-10-21） */
  listable?: boolean;
  /** ★「〈学校〉を出た人の、いま」（サーバーで描いた DestinationsBlock。無ければ null） */
  destinations?: React.ReactNode;
};
type Tab = "graduates" | "posts";

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function formatGradYear(graduatedAt: string | null): string | null {
  if (!graduatedAt) return null;
  return `${graduatedAt.slice(0, 4)}年卒`;
}

function subText(g: Graduate): string {
  return [g.faculty, g.degree, formatGradYear(g.graduatedAt)].filter(Boolean).join(" · ");
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "今";
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ name, gradient, url, size }: { name: string; gradient: string; url: string | null; size: number }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} style={{
        width: size, height: size, borderRadius: "50%", objectFit: "cover",
        border: "2px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 800, color: "#fff",
      flexShrink: 0, border: "2px solid #fff",
      boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
    }}>
      {name.charAt(0)}
    </div>
  );
}



// ─── 投稿カード（read-only） ──────────────────────────────────────────────────

function SchoolPostCard({ post }: { post: SchoolPost }) {
  const gradient = post.userAvatarColor
    ? `linear-gradient(135deg, ${post.userAvatarColor}99, ${post.userAvatarColor})`
    : "linear-gradient(135deg, #7C3AED, #a855f7)";

  return (
    <article style={{
      background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
      padding: "20px 22px", marginBottom: 12,
    }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <Link href={`/u/${post.userId}`} style={{ flexShrink: 0, textDecoration: "none" }}>
          <Avatar name={post.userName} gradient={gradient} url={post.userAvatarUrl} size={44} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/u/${post.userId}`} style={{
            fontSize: 14, fontWeight: 700, color: "var(--ink)", textDecoration: "none",
            display: "block",
          }}>
            {post.userName}
          </Link>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 2 }}>
            {timeAgo(post.createdAt)}
          </div>
        </div>
      </div>

      {/* 本文 */}
      {post.content && (
        <div style={{
          fontSize: 14, color: "var(--ink)", lineHeight: 1.75, marginBottom: 12,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {post.content}
        </div>
      )}

      {/* 画像 */}
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" style={{
          width: "100%", borderRadius: 10, marginBottom: 12,
          objectFit: "cover", maxHeight: 320,
        }} />
      )}

      {/* リンクプレビュー */}
      {post.linkUrl && (
        <div style={{ marginTop: 4 }}>
          <LinkPreviewCard
            linkUrl={post.linkUrl}
            linkTitle={post.linkTitle}
            linkImageUrl={post.linkImageUrl}
            linkDescription={post.linkDescription}
            linkDomain={post.linkDomain}
          />
        </div>
      )}
    </article>
  );
}

// ─── 投稿タブ 空状態 ──────────────────────────────────────────────────────────

function PostsEmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "60px 24px 48px" }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={1.2} strokeLinecap="round" style={{ marginBottom: 16 }}>
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
        まだ投稿がありません
      </p>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, maxWidth: 280, margin: "0 auto" }}>
        出身者がフィードに投稿すると、<br />ここに集まります。
      </p>
    </div>
  );
}

// ─── 人のカード（2026-10-21 / 会社ページの社員と同じ縦長のカード） ───────────────

/**
 * ★会社ページの現役社員・OB/OG と同じカード（JOB_PEOPLE_CSS の .jpc-*）。3人以上は横スクロール（PeopleCardRow）。
 *   2行目は、卒業生ならいまの会社と職種、在学中なら学部。
 * ⚠️ 「メッセージ」ボタンは付けない（JobPeopleCards の注記と同じ理由）
 */
function SchoolPersonCard({ g }: { g: Graduate }) {
  const now = [g.currentCompany, g.currentRoleTitle].filter(Boolean).join(" / ");
  const second = g.isCurrent ? (g.faculty ?? "") : (now || subText(g));
  return (
    <a href={`/u/${g.userId}`} className="jpc-card" data-state="school-person-card" title={[g.name, second, g.isCurrent ? null : subText(g)].filter(Boolean).join(" / ")}>
      <span className="jpc-avatar" style={{ background: g.avatarUrl ? undefined : AVATAR_COLOR.bg, color: AVATAR_COLOR.text }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {g.avatarUrl ? <img src={g.avatarUrl} alt="" /> : g.avatarInitial}
      </span>
      <span className="jpc-name">{g.name}</span>
      <span className="jpc-role">{second}</span>
    </a>
  );
}

function PeopleGroup({ title, list }: { title: string; list: Graduate[] }) {
  if (list.length === 0) return null;
  return (
    <section data-state="school-people-group" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 24px 18px", marginBottom: 16, overflow: "hidden" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", marginBottom: 12 }}>
        {title}<span style={{ marginLeft: 6, fontSize: 13, fontWeight: 500, color: "var(--ink-mute)" }}>({list.length}名)</span>
      </div>
      <PeopleCardRow count={list.length}>
        {list.map((g) => <SchoolPersonCard key={g.userId} g={g} />)}
      </PeopleCardRow>
    </section>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function SchoolGraduatesClient({ graduates, posts, isLoggedIn = false, listable = true, destinations = null }: Props) {
  const [tab, setTab] = useState<Tab>("graduates");

  return (
    <>
      <style>{`
        .sch-tab-btn {
          padding: 10px 20px;
          border: none; background: transparent; cursor: pointer;
          font-size: 14px; font-weight: 600; font-family: inherit;
          color: var(--ink-mute);
          border-bottom: 2.5px solid transparent;
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .sch-tab-btn:hover { color: var(--ink); }
        .sch-tab-btn.active { color: var(--royal); border-bottom-color: var(--royal); }
      `}</style>

      {/* ── タブバー ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--line)", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {([
            { key: "graduates" as const, label: "出身者", count: graduates.length },
            { key: "posts" as const, label: "投稿", count: posts.length },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`sch-tab-btn${tab === key ? " active" : ""}`}
            >
              {label}
              <span style={{
                marginLeft: 6,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 20, height: 20, borderRadius: 10,
                background: tab === key ? "var(--royal-50)" : "var(--line-soft)",
                color: tab === key ? "var(--royal)" : "var(--ink-mute)",
                fontSize: 12, fontWeight: 700, fontFamily: "var(--font-inter), var(--font-noto)",
              }}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 出身者タブ ── */}
      {tab === "graduates" && (
        graduates.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--ink-soft)", fontSize: 15 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={1.2} strokeLinecap="round" style={{ marginBottom: 12 }}>
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
            {/* ⚠️ 未ログインには「登録されていません」と言わない。
                   実ユーザーは全員 `login_only` なので、未ログインには必ず0件になる。 */}
            <p>{!listable
              ? "出身者を表示しているのは、大学・大学院・高校だけです。"
              : isLoggedIn
              ? "この学校の出身者はまだ登録されていません。"
              : "出身者はログインすると表示されます。"}</p>
          </div>
        ) : (
          /* ★在学中・卒業生に分けて、会社ページと同じカードで並べる。下に「〈学校〉を出た人の、いま」（2026-10-21） */
          <>
            <style>{JOB_PEOPLE_CSS}</style>
            <PeopleGroup title="在学中" list={graduates.filter((g) => g.isCurrent)} />
            <PeopleGroup title="卒業生" list={graduates.filter((g) => !g.isCurrent)} />
            {destinations}
          </>
        )
      )}

      {/* ── 投稿タブ ── */}
      {tab === "posts" && (
        posts.length === 0
          ? <PostsEmptyState />
          : <div>
              {posts.map((p) => <SchoolPostCard key={p.id} post={p} />)}
            </div>
      )}
    </>
  );
}
