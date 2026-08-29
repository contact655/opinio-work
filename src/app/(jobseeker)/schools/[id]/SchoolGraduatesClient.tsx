"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LinkPreviewCard } from "@/components/feed/LinkPreviewCard";

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

type Props = { graduates: Graduate[]; posts: SchoolPost[] };
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

// ─── グリッドカード（3名以上） ────────────────────────────────────────────────

function GridCard({ g }: { g: Graduate }) {
  const router = useRouter();
  const sub = subText(g);
  return (
    <div onClick={() => router.push(`/u/${g.userId}`)} className="sch-grid-card">
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
        <Avatar name={g.name} gradient={g.avatarGradient} url={g.avatarUrl} size={68} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4, textAlign: "center" }}>
        {g.name}
      </div>
      {(g.currentRoleTitle || g.currentCompany) && (
        <div style={{
          fontSize: 12, fontWeight: 600, color: "var(--royal)",
          marginBottom: 4, textAlign: "center", lineHeight: 1.4,
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {[g.currentRoleTitle, g.currentCompany].filter(Boolean).join(" @ ")}
        </div>
      )}
      {sub && (
        <div style={{
          fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginBottom: g.careerSummary ? 5 : 8,
          textAlign: "center", lineHeight: 1.5,
        }}>
          {sub}
        </div>
      )}
      {g.careerSummary && (
        <div style={{
          fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.5,
          marginBottom: 8, textAlign: "center",
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {g.careerSummary}
        </div>
      )}
      {g.catchphrase && (
        <div style={{
          fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.6,
          marginBottom: 10, textAlign: "center",
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {g.catchphrase}
        </div>
      )}
      <div style={{ marginTop: "auto", width: "100%" }}>
        <Link href={`/u/${g.userId}`} onClick={(e) => e.stopPropagation()} style={{
          display: "block", textAlign: "center", padding: "8px 14px",
          background: "var(--royal-50)", border: "1px solid var(--royal-100)",
          color: "var(--royal)", borderRadius: 9, fontSize: 12, fontWeight: 600, textDecoration: "none",
        }}>
          プロフィールを見る
        </Link>
      </div>
    </div>
  );
}

// ─── 横帯カード（1〜2名） ────────────────────────────────────────────────────

function BandCard({ g }: { g: Graduate }) {
  const router = useRouter();
  const sub = subText(g);
  return (
    <div onClick={() => router.push(`/u/${g.userId}`)}
      style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
        padding: "20px 24px", display: "flex", alignItems: "center", gap: 20,
        cursor: "pointer", transition: "box-shadow 0.15s, border-color 0.15s",
      }}
      className="sch-band-card"
    >
      <div style={{ flexShrink: 0 }}>
        <Avatar name={g.name} gradient={g.avatarGradient} url={g.avatarUrl} size={72} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{g.name}</div>
        {(g.currentRoleTitle || g.currentCompany) && (
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", marginBottom: 4, lineHeight: 1.4 }}>
            {[g.currentRoleTitle, g.currentCompany].filter(Boolean).join(" @ ")}
          </div>
        )}
        {sub && (
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginBottom: g.careerSummary ? 4 : 0 }}>{sub}</div>
        )}
        {g.careerSummary && (
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.5, marginBottom: g.catchphrase ? 6 : 0 }}>
            {g.careerSummary}
          </div>
        )}
        {g.catchphrase && (
          <div style={{
            fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.6,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>
            {g.catchphrase}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        <Link href={`/u/${g.userId}`} onClick={(e) => e.stopPropagation()} style={{
          display: "inline-flex", alignItems: "center", padding: "9px 18px",
          background: "var(--royal-50)", border: "1px solid var(--royal-100)",
          color: "var(--royal)", borderRadius: 9, fontSize: 12, fontWeight: 600,
          textDecoration: "none", whiteSpace: "nowrap",
        }}>
          プロフィールを見る
        </Link>
      </div>
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

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function SchoolGraduatesClient({ graduates, posts }: Props) {
  const [tab, setTab] = useState<Tab>("graduates");

  return (
    <>
      <style>{`
        .sch-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        @media (max-width: 1100px) { .sch-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 768px)  { .sch-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } }
        @media (max-width: 480px)  { .sch-grid { grid-template-columns: minmax(0, 1fr); gap: 10px; } }

        .sch-grid-card {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 20px 16px 16px;
          cursor: pointer;
          transition: box-shadow 0.15s, border-color 0.15s, transform 0.1s;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .sch-grid-card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.09);
          border-color: var(--royal-100);
          transform: translateY(-1px);
        }

        .sch-band-stack { display: flex; flex-direction: column; gap: 12px; }
        .sch-band-card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.09);
          border-color: var(--royal-100);
        }
        @media (max-width: 600px) {
          .sch-band-card { flex-direction: column !important; align-items: flex-start !important; }
        }

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
            <p>この学校の出身者はまだ登録されていません。</p>
          </div>
        ) : graduates.length <= 2 ? (
          <div className="sch-band-stack">
            {graduates.map((g) => <BandCard key={g.userId} g={g} />)}
          </div>
        ) : (
          <div className="sch-grid">
            {graduates.map((g) => <GridCard key={g.userId} g={g} />)}
          </div>
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
