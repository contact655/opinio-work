import OpinioLogo from "@/components/common/OpinioLogo";

/**
 * ★/biz の枠を描くための会社の情報を読み込めなかったときの画面（2026-10-30 / 柴さんの指示）。
 *
 * それまでは失敗を握りつぶし、**空のサイドバーで画面を描いていた**（「管理者」も出ず、壊れたように見える）。
 * 担当者であることは (app)/layout.tsx で確かめてあるので、ここに来るのは一時的な失敗。
 * ⚠️ JS が無くても戻れるよう、再読み込みは素のリンク（ページごと読み込み直す）。
 * ⚠️ 色で危険を示さない（本人の操作の失敗ではない）。
 */
export function BizLoadError({ retryHref }: { retryHref: string }) {
  return (
    <main
      id="main-content"
      data-state="biz-load-error"
      style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px", background: "var(--bg-tint)", boxSizing: "border-box",
      }}
    >
      <div style={{
        width: "100%", maxWidth: 440, padding: "28px 24px", borderRadius: 14,
        background: "#fff", border: "1px solid var(--line)", textAlign: "center", boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", justifyContent: "center", color: "var(--brand-ink)", marginBottom: 18 }}>
          <OpinioLogo height={22} />
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
          画面を読み込めませんでした
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.8, color: "var(--ink-soft)" }}>
          会社の情報を読み込めませんでした。少し待ってから、もう一度お試しください。
          <br />
          何度も続くときは、運営までお知らせください。
        </p>
        <a
          href={retryHref}
          data-state="biz-load-retry"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "10px 22px", borderRadius: 8, background: "var(--royal)", color: "#fff",
            fontSize: 14, fontWeight: 700, textDecoration: "none",
          }}
        >
          もう一度読み込む
        </a>
      </div>
    </main>
  );
}
