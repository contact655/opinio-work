import Link from "next/link";

/**
 * ページ上部のパンくず。ヘッダー直下に全幅で敷く。
 *
 * ── なぜ共通化したか（2026-08-07）────────────────────────────────────────────
 * /companies/[id] にローカル実装があり、/profile/edit にも同じ見た目のものが
 * 要るようになった。2箇所に同じ markup を置かない。
 *
 * ⚠️ 最後の項目は href を持たせない（現在地なので）。`aria-current="page"` が付く。
 */
export type Crumb = { label: string; href?: string };

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="パンくずリスト"
      style={{
        background: "var(--bg-tint)",
        borderBottom: "1px solid var(--line)",
        fontSize: "var(--text-xs)",
        color: "var(--ink-mute)",
      }}
    >
      <div
        style={{ maxWidth: "var(--max-w-wide)", margin: "0 auto" }}
        className="px-5 py-3 md:px-12"
      >
        {items.map((c, i) => (
          <span key={`${c.label}-${i}`}>
            {i > 0 && <span style={{ margin: "0 6px" }}>/</span>}
            {c.href ? (
              <Link href={c.href} style={{ color: "var(--ink-mute)" }}>
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" style={{ color: "var(--ink-soft)" }}>
                {c.label}
              </span>
            )}
          </span>
        ))}
      </div>
    </nav>
  );
}
