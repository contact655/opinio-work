"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * 最後の砦。**ルートレイアウト自体が落ちたとき**だけ表示される。
 *
 * ⚠️ `src/app/error.tsx` とは別物。あちらはレイアウトが生きている前提で、
 *    レイアウトの内側に描画される。レイアウトが落ちた場合は呼ばれない。
 *
 * ⚠️ **自前で `<html>` と `<body>` を書く必要がある。**
 *    ルートレイアウトが失敗している以上、その2つが存在しないため。
 *    ここを省くと画面が真っ白になる。
 *
 * ⚠️ ここでは `--royal` などの CSS 変数を使わないこと。
 *    globals.css が読めていない状況でも表示できる必要があるので、
 *    色は生の16進数で直接書いている。
 *
 * ⚠️ フォントも next/font に頼らない。同じ理由でシステムフォントを直書きする。
 *
 * ── なぜ作ったか（2026-08-09）────────────────────────────────────────────
 * このファイルが無く、ビルドのたびに @sentry/nextjs が警告を出していた。
 * 無い状態ではレイアウト崩壊時に**画面も出ず、記録も残らない**。
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("[GlobalError:root]", error);
  }, [error]);

  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#f1f5f9",
          color: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#002366",
              letterSpacing: "-0.02em",
              marginBottom: 36,
            }}
          >
            OPINIO
          </div>

          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>
            エラーが発生しました
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, margin: "0 0 8px" }}>
            予期しないエラーが発生しました。
            <br />
            お手数ですが、ページを再読み込みしてください。
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#94a3b8",
                fontFamily: "monospace",
                margin: "0 0 28px",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}

          {/* ⚠️ reset() ではなく再読み込みにする。ルートレイアウトが落ちている場合、
                 同じツリーを描き直しても同じ場所で落ちる可能性が高い */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
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
            再読み込み
          </button>

          <p style={{ marginTop: 32, fontSize: 12, fontWeight: 500, color: "#94a3b8" }}>
            問題が解決しない場合は{" "}
            <a href="mailto:support@opinio.jp" style={{ color: "#3B5FD9" }}>
              support@opinio.jp
            </a>{" "}
            までお問い合わせください。
          </p>
        </div>
      </body>
    </html>
  );
}
