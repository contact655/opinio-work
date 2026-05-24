"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // エラーログ（本番では Sentry 等に送信）
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f1f5f9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', sans-serif",
    }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", display: "inline-block", marginBottom: 40 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: "#002366", letterSpacing: "-0.02em" }}>OPINIO</span>
        </Link>

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "#fee2e2",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 12px" }}>
          エラーが発生しました
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, margin: "0 0 8px" }}>
          予期しないエラーが発生しました。<br />
          しばらく時間をおいてから再度お試しください。
        </p>
        {error.digest && (
          <p style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", margin: "0 0 32px" }}>
            Error ID: {error.digest}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button"
            onClick={reset}
            style={{
              display: "inline-block",
              background: "#002366",
              color: "#fff",
              padding: "12px 28px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            もう一度試す
          </button>
          <Link href="/" style={{
            display: "inline-block",
            background: "#fff",
            color: "#002366",
            padding: "12px 28px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
            border: "1.5px solid #002366",
          }}>
            トップページへ
          </Link>
        </div>

        <p style={{ marginTop: 32, fontSize: 12, color: "#94a3b8" }}>
          問題が解決しない場合は{" "}
          <a href="mailto:support@opinio.jp" style={{ color: "#3B5FD9" }}>
            support@opinio.jp
          </a>{" "}
          までお問い合わせください。
        </p>
      </div>
    </div>
  );
}
