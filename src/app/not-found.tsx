import Link from "next/link";
import type { Metadata } from "next";
import OpinioLogo from "@/components/common/OpinioLogo";

export const metadata: Metadata = {
  title: { absolute: "ページが見つかりません | OPINIO" },
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f1f5f9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      fontFamily: "var(--font-inter), var(--font-noto)",
    }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", display: "inline-flex", marginBottom: 40, color: "var(--brand-ink)" }}>
          <OpinioLogo height={28} />
        </Link>

        {/* 404 Number */}
        <div style={{
          fontSize: 96,
          fontWeight: 800,
          lineHeight: 1,
          marginBottom: 16,
          background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          404
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 12px" }}>
          ページが見つかりません
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, margin: "0 0 36px" }}>
          お探しのページは移動または削除された可能性があります。<br />
          URLをご確認いただくか、トップページからお探しください。
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" style={{
            display: "inline-block",
            background: "var(--royal)",
            color: "#fff",
            padding: "12px 28px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 14,
          }}>
            トップページへ
          </Link>
          <Link href="/companies" style={{
            display: "inline-block",
            background: "#fff",
            color: "var(--royal)",
            padding: "12px 28px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
            border: "1.5px solid var(--royal)",
          }}>
            企業一覧を見る
          </Link>
        </div>

        {/* Quick links */}
        <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid #e2e8f0" }}>
          <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>よく見られているページ</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { href: "/jobs", label: "求人一覧" },
              { href: "/companies", label: "企業一覧" },
              { href: "/articles", label: "記事" },
              { href: "/auth", label: "ログイン" },
            ].map((link) => (
              <Link key={link.href} href={link.href} style={{
                fontSize: 12,
                color: "#3B5FD9",
                textDecoration: "none",
                padding: "4px 12px",
                background: "#eff3fc",
                borderRadius: 20,
              }}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
