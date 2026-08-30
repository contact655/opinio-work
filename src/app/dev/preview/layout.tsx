import type { Metadata } from "next";
import Link from "next/link";
import { devOnly } from "./guard";

/* ⚠️ 検索エンジンに拾わせない。本番では 404 なので届かないが、
      **二重に**閉じておく（noindex は「もし出たとき」の保険）。 */
export const metadata: Metadata = {
  title: { absolute: "UI プレビュー（開発用）" },
  robots: { index: false, follow: false },
};

/* ⚠️ 固定データしか使わないが、静的化して本番の成果物に混ぜない。 */
export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/dev/preview/benefits",  label: "福利厚生" },
  { href: "/dev/preview/employees", label: "現役社員 / OB・OG" },
  { href: "/dev/preview/tools",     label: "ツール" },
  { href: "/dev/preview/cases",     label: "導入事例" },
  { href: "/dev/preview/teams",     label: "組織体制" },
];

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  devOnly();
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)" }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#fff", borderBottom: "1px solid var(--line)",
        padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <Link href="/dev/preview" style={{
          fontFamily: "var(--font-noto-serif)", fontWeight: 700, fontSize: 16,
          color: "var(--ink)", textDecoration: "none",
        }}>
          UI プレビュー
        </Link>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
          background: "var(--royal-50)", color: "var(--royal)",
        }}>開発用・本番では404</span>
        <nav style={{ display: "flex", gap: 12, marginLeft: "auto", flexWrap: "wrap" }}>
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} style={{
              fontSize: 13, color: "var(--ink-soft)", textDecoration: "none",
              fontFamily: "var(--font-inter), var(--font-noto)",
            }}>{s.label}</Link>
          ))}
        </nav>
      </header>
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px 80px" }}>{children}</main>
    </div>
  );
}
