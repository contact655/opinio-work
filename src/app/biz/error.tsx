"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function BizError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[BizError]", error);
  }, [error]);

  return (
    <div style={{
      minHeight: "60vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
    }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        {/* Icon */}
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: "0 0 12px" }}>
          エラーが発生しました
        </h2>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 8px" }}>
          予期しないエラーが発生しました。<br />
          しばらく時間をおいてから再度お試しください。
        </p>
        {error.digest && (
          <p style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "monospace", margin: "0 0 32px" }}>
            Error ID: {error.digest}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button"
            onClick={reset}
            style={{
              display: "inline-block",
              background: "var(--royal)",
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
          <Link href="/biz/dashboard" style={{
            display: "inline-block",
            background: "#fff",
            color: "var(--royal)",
            padding: "12px 28px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
            border: "1.5px solid var(--royal-100)",
          }}>
            ダッシュボードへ
          </Link>
        </div>

        <p style={{ marginTop: 32, fontSize: 12, color: "var(--ink-mute)" }}>
          問題が解決しない場合は{" "}
          <a href="mailto:support@opinio.jp" style={{ color: "var(--accent)" }}>
            support@opinio.jp
          </a>{" "}
          までお問い合わせください。
        </p>
      </div>
    </div>
  );
}
