import Link from "next/link";

/**
 * ★`/biz/dashboard` のカードの見出し（2026-09-21）。
 *
 * それまでは明朝体＋英語の小見出し（JOB STATUS / TEAM）のカードと、
 * ゴシック体のカードが混ざっていた。**ダッシュボードのカードはこれを使う。**
 * ⚠️ 英語の小見出しを戻さないこと（日本語の見出しと同じことを言っているだけ）。
 */
export function DashboardCardHeading({
  title,
  link,
}: {
  title: string;
  link?: { href: string; label: string };
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--line-soft)",
    }}>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{title}</h2>
      {link && (
        <Link href={link.href} style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
          {link.label} →
        </Link>
      )}
    </div>
  );
}
