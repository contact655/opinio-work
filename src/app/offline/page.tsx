import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "オフライン — OPINIO",
  description: "インターネット接続がありません",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #001845 0%, #002366 100%)",
        fontFamily: "'Noto Sans JP', sans-serif",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "20px",
          padding: "48px 40px",
          maxWidth: "400px",
          width: "100%",
          textAlign: "center",
        }}
      >
        {/* アイコン */}
        <div style={{ fontSize: "56px", marginBottom: "20px" }}>📡</div>

        {/* OPINIO ロゴ */}
        <div
          style={{
            fontSize: "13px",
            fontWeight: "700",
            letterSpacing: "0.15em",
            color: "rgba(255,255,255,0.5)",
            marginBottom: "8px",
            textTransform: "uppercase",
          }}
        >
          OPINIO
        </div>

        <h1
          style={{
            fontSize: "22px",
            fontWeight: "700",
            color: "white",
            margin: "0 0 12px",
          }}
        >
          オフラインです
        </h1>

        <p
          style={{
            fontSize: "15px",
            color: "rgba(255,255,255,0.65)",
            lineHeight: "1.7",
            margin: "0 0 32px",
          }}
        >
          インターネット接続を確認してから、
          <br />
          もう一度お試しください。
        </p>

        {/* ボタン */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              display: "block",
              width: "100%",
              padding: "14px 24px",
              background: "linear-gradient(135deg, #3B5FD9, #002366)",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            再読み込み
          </button>

          <Link
            href="/"
            style={{
              display: "block",
              width: "100%",
              padding: "14px 24px",
              background: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: "500",
              cursor: "pointer",
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            ホームへ戻る
          </Link>
        </div>

        {/* ヒント */}
        <p
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.35)",
            margin: "24px 0 0",
            lineHeight: "1.6",
          }}
        >
          以前閲覧したページはオフラインでも
          <br />
          確認できる場合があります。
        </p>
      </div>
    </div>
  );
}
