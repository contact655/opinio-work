"use client";

import Link from "next/link";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function JobseekerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // ⚠️ これが無いと Sentry に届かない（src/app/error.tsx のコメント参照）
    Sentry.captureException(error);
    console.error("[JobseekerError]", error);
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
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--error-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: "0 0 12px" }}>
          エラーが発生しました
        </h2>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 8px" }}>
          予期しないエラーが発生しました。<br />
          しばらく時間をおいてから再度お試しください。
        </p>
        {error.digest && (
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "monospace", margin: "0 0 32px" }}>
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
          <Link href="/" style={{
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
            トップページへ
          </Link>
        </div>

        <p style={{ marginTop: 32, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
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
