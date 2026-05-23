import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "60vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "64px 24px",
    }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
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

        <h2 style={{
          fontSize: 20,
          fontWeight: 700,
          color: "var(--ink)",
          margin: "0 0 12px",
        }}>
          ページが見つかりません
        </h2>

        <p style={{
          fontSize: 14,
          color: "var(--ink-soft)",
          lineHeight: 1.8,
          margin: "0 0 32px",
        }}>
          お探しのページは削除されたか、URLが変更された可能性があります。
        </p>

        <Link href="/biz/dashboard" style={{
          display: "inline-block",
          background: "var(--royal)",
          color: "#fff",
          padding: "12px 28px",
          borderRadius: 8,
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 14,
        }}>
          ダッシュボードへ
        </Link>
      </div>
    </div>
  );
}
