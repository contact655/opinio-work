import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div style={{
      minHeight: "60vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "64px 24px",
      background: "var(--bg-tint)",
    }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        {/* 404 */}
        <div style={{
          fontSize: 80,
          fontWeight: 800,
          color: "var(--royal-100)",
          lineHeight: 1,
          marginBottom: 8,
          fontFamily: "var(--font-inter)",
        }}>
          404
        </div>

        <h1 style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--ink)",
          margin: "0 0 12px",
        }}>
          ページが見つかりません
        </h1>

        <p style={{
          fontSize: 14,
          color: "var(--ink-soft)",
          lineHeight: 1.8,
          margin: "0 0 36px",
        }}>
          お探しのページは削除されたか、URLが変更された可能性があります。<br />
          以下のリンクからご確認ください。
        </p>

        {/* Quick links */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
          <Link href="/companies" style={{
            display: "inline-block",
            background: "var(--royal)",
            color: "#fff",
            padding: "10px 22px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}>
            企業を探す
          </Link>
          <Link href="/jobs" style={{
            display: "inline-block",
            background: "#fff",
            color: "var(--royal)",
            padding: "10px 22px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
            border: "1.5px solid var(--royal-100)",
          }}>
            求人を見る
          </Link>
          <Link href="/articles" style={{
            display: "inline-block",
            background: "#fff",
            color: "var(--royal)",
            padding: "10px 22px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
            border: "1.5px solid var(--royal-100)",
          }}>
            取材記事
          </Link>
        </div>

        <Link href="/" style={{ fontSize: 13, color: "var(--ink-mute)", textDecoration: "none" }}>
          ← トップページへ戻る
        </Link>
      </div>
    </div>
  );
}
