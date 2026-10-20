import type { Metadata } from "next";
import Link from "next/link";
import OpinioLogo from "@/components/common/OpinioLogo";
import { verifyUnsubscribeToken } from "@/lib/notify/unsubscribe";
import { EMAIL_SETTING_LABELS } from "@/lib/constants/emailSettings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "メールのお知らせを止める", robots: { index: false, follow: false } };

/**
 * ★メールのリンクから開く「このお知らせを止める」ページ（ログイン不要。2026-10-20）。
 * ⚠️★開いただけでは止めない。「止める」を押した POST（/api/unsubscribe）で止める
 *    （メールの安全確認ツールがリンクを先に開くことがあるため）。
 * ⚠️ 誰のアカウントかは画面に出さない（リンクを転送された人にメールアドレスや名前を見せない）。
 */
export default function UnsubscribePage({ searchParams }: { searchParams: { t?: string; done?: string; error?: string } }) {
  const t = typeof searchParams.t === "string" ? searchParams.t : "";
  const v = verifyUnsubscribeToken(t);
  const label = v ? EMAIL_SETTING_LABELS[v.setting] : null;

  const box: React.CSSProperties = { maxWidth: 480, margin: "0 auto", padding: "28px 24px", background: "#fff", border: "1px solid var(--line)", borderRadius: 14 };
  const p: React.CSSProperties = { fontSize: 14, lineHeight: 1.8, color: "var(--ink-soft)", margin: "12px 0 0" };
  const settingsLink = <Link href="/mypage/settings" style={{ color: "var(--royal)", fontWeight: 700 }}>設定</Link>;

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-tint, #f8fafc)", padding: "48px 16px" }}>
      <div style={box}>
        <Link href="/" aria-label="OPINIO" style={{ color: "var(--brand-ink, #141414)", display: "inline-block" }}><OpinioLogo height={22} /></Link>
        {!v ? (
          <div data-state="unsubscribe-invalid">
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "20px 0 0" }}>このリンクは使えません</h1>
            <p style={p}>リンクが途中で切れているか、古い形式の可能性があります。ログインして{settingsLink}から止めてください。</p>
          </div>
        ) : searchParams.done ? (
          <div data-state="unsubscribe-done">
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "20px 0 0" }}>「{label}」を止めました</h1>
            <p style={p}>これからはこのお知らせをメールで送りません。ほかのお知らせはそのまま届きます。再開したいときは、ログインして{settingsLink}から戻せます。</p>
          </div>
        ) : (
          <div data-state="unsubscribe-confirm">
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "20px 0 0" }}>「{label}」を止めますか？</h1>
            <p style={p}>止めても、OPINIO のお知らせ（ベル）にはこれまでどおり出ます。メールで届かなくなるのはこのお知らせだけです。</p>
            {searchParams.error && <p role="alert" style={{ ...p, color: "var(--danger-ink, #b91c1c)" }}>止められませんでした。時間をおいてもう一度お試しください。</p>}
            <form method="post" action={`/api/unsubscribe?t=${encodeURIComponent(t)}`} style={{ marginTop: 20 }}>
              <button type="submit" data-action="unsubscribe"
                style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                止める
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
