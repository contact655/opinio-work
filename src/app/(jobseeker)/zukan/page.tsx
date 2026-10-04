import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ZukanListCard } from "@/components/zukan/ZukanParts";
import { getPublishedZukanArticles } from "@/lib/zukan/articles";
import { ZUKAN_LEAD, ZUKAN_TITLE } from "@/lib/constants/zukan";

/**
 * 社長図鑑の一覧（/zukan）。記事は `content/zukan/*.md`。
 * ⚠️ 公開判定は `getPublishedZukanArticles()` に任せる。ここで status を見ない。
 * ⚠️ 記事はデプロイでしか変わらないので、事実上ビルド時に固まる静的ページ。
 */
export const revalidate = 3600;

/**
 * ★公開記事が0本のあいだは noindex（2026-10-04 / 柴さんの指示）。空のページを検索に載せない。
 *   1本以上になれば**自動で外れる**（判定は `getPublishedZukanArticles()`。ここで status を見ない）。
 *   ⚠️ follow は残す（フッター・パンくずのリンクは辿ってよい）。
 */
export function generateMetadata(): Metadata {
  const empty = getPublishedZukanArticles().length === 0;
  return {
    title: ZUKAN_TITLE,
    description: ZUKAN_LEAD,
    alternates: { canonical: "https://opinio.jp/zukan" },
    ...(empty ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: `${ZUKAN_TITLE} by OPINIO`,
      description: ZUKAN_LEAD,
      type: "website",
      url: "https://opinio.jp/zukan",
      siteName: "OPINIO",
    },
  };
}

export default function ZukanListPage() {
  const articles = getPublishedZukanArticles();

  return (
    <>
      <Breadcrumb items={[{ label: "OPINIO", href: "/" }, { label: ZUKAN_TITLE }]} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--space-8) 20px 80px" }}>
        <header style={{ marginBottom: 36 }}>
          <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, margin: 0, letterSpacing: "0.04em" }}>
            {ZUKAN_TITLE}
          </h1>
          <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", color: "var(--ink-mute)", margin: "4px 0 16px" }}>
            by OPINIO
          </p>
          <p style={{ fontSize: "var(--text-md)", color: "var(--ink-soft)", lineHeight: 1.9, margin: 0, maxWidth: 640 }}>
            {ZUKAN_LEAD}
          </p>
        </header>

        {articles.length === 0 ? (
          <p style={{ padding: "48px 20px", textAlign: "center", border: "1px dashed var(--line)", borderRadius: 14, color: "var(--ink-mute)", fontSize: 14, background: "#fff" }}>
            記事を準備しています。
          </p>
        ) : (
          <div className="zukan-grid">
            {articles.map((a) => (
              <ZukanListCard key={a.slug} article={a} />
            ))}
          </div>
        )}
      </div>
      <style>{`
        .zukan-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px 24px; }
        @media (max-width: 899px) { .zukan-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 16px; } }
        @media (max-width: 479px) { .zukan-list-card { padding: 6px; } }
        .zukan-list-card { display: block; text-decoration: none; border-radius: 16px; padding: 10px; transition: background 0.15s; }
        .zukan-list-card:hover { background: #fff; }
      `}</style>
    </>
  );
}
