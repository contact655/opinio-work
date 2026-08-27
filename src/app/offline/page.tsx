import type { Metadata } from "next";

/**
 * オフライン時の着地ページ（2026-08-20）。
 *
 * ⚠️ **これが無いと Service Worker のプリキャッシュが丸ごと失敗する。**
 *    `public/sw.js` の install は `cache.addAll(["/", "/companies", "/jobs", "/offline"])`
 *    を呼ぶが、`addAll` は**1つでも 404 なら全体を reject する**。
 *    `/offline` が存在しなかったため、`.catch()` に落ちて
 *    **1ページもキャッシュされていなかった**（本番で 404 を実測）。
 *
 * ⚠️ ここは**ネットワークが無いときに出る**ページなので、
 *    外部リソース（フォント・画像・API）に依存させないこと。
 */
export const metadata: Metadata = {
  /* ⚠️ `absolute` を使う。素の `title` だと「オフライン | OPINIO | OPINIO」になる
        （2026-08-28 に本番で実測） */
  title: { absolute: "オフライン | OPINIO" },
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
        background: "var(--bg-tint)",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "40px 32px",
          maxWidth: 380,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 44, lineHeight: 1 }}>📡</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: "16px 0 8px" }}>
          オフラインです
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink-soft)", margin: "0 0 24px" }}>
          インターネット接続を確認してから、もう一度お試しください。
          <br />
          一度開いたページは、接続が無くても表示できることがあります。
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            background: "var(--royal)",
            color: "#fff",
            borderRadius: 10,
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          トップへ
        </a>
      </div>
    </div>
  );
}
