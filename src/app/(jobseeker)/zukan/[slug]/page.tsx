import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ZukanMarkdown } from "@/components/zukan/ZukanMarkdown";
import {
  ZukanAuthorBox,
  ZukanCeoCard,
  ZukanConsultCta,
} from "@/components/zukan/ZukanParts";
import {
  formatZukanDate,
  getPublishedZukanArticle,
  getPublishedZukanArticles,
  zukanOgImage,
} from "@/lib/zukan/articles";
import { ZUKAN_AUTHORS } from "@/lib/zukan/authors";
import { ZUKAN_TITLE } from "@/lib/constants/zukan";
import { resolvePublishedCompanyHref } from "@/lib/supabase/queries";

/**
 * 社長図鑑の記事詳細（/zukan/[slug]）。
 *
 * ★静的生成（SSG）。`generateStaticParams` は**公開記事だけ**を返し、
 *   `dynamicParams = false` なので、**draft の slug を直接開いても 404**（本物の 404）。
 *   ⚠️ `dynamicParams` を true に戻さないこと。戻すと要求時に作られるので、
 *      draft を弾くのは `getPublishedZukanArticle` の null だけになる。
 *
 * ⚠️ `revalidate` が効くのは**企業ページへのリンクを張るか**（`is_published`）の判定だけ。
 *    記事の中身は .md なのでデプロイでしか変わらない。
 */
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedZukanArticles().map((a) => ({ slug: a.slug }));
}

const SITE = "https://opinio.jp";

/** `/zukan/...` のような相対パスを絶対URLにする（JSON-LD は相対を受けない） */
function absoluteUrl(src: string): string {
  return src.startsWith("/") ? `${SITE}${src}` : src;
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const article = getPublishedZukanArticle(params.slug);
  if (!article) return { title: "ページが見つかりません", robots: { index: false } };

  const url = `${SITE}/zukan/${article.slug}`;
  const og = zukanOgImage(article);
  const title = `${article.title}｜${ZUKAN_TITLE}`;
  return {
    title,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: article.description,
      type: "article",
      url,
      siteName: "OPINIO",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [ZUKAN_AUTHORS[article.author].name],
      ...(og ? { images: [{ url: og, alt: article.title }] } : {}),
    },
    twitter: {
      card: og ? "summary_large_image" : "summary",
      title,
      description: article.description,
      ...(og ? { images: [og] } : {}),
    },
  };
}

export default async function ZukanArticlePage({ params }: { params: { slug: string } }) {
  const article = getPublishedZukanArticle(params.slug);
  if (!article) notFound();

  /* ⚠️ 企業ページへのリンクは「ページが公開されている企業」だけに張る（CLAUDE.md）。
        `resolvePublishedCompanyHref` は env に関係なく is_published を見る。 */
  const companyHref = article.companyId ? await resolvePublishedCompanyHref(article.companyId) : null;

  const og = zukanOgImage(article);
  const author = ZUKAN_AUTHORS[article.author];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    ...(og ? { image: [absoluteUrl(og)] } : {}),
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { "@type": "Person", name: author.name },
    publisher: { "@type": "Organization", name: "OPINIO", url: SITE },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/zukan/${article.slug}` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        /* 中身はリポジトリ内の .md（運営が書く）だけ。`<` は逃がしてある
           （本文に `</script>` が入っても閉じないように） */
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Breadcrumb items={[{ label: "OPINIO", href: "/" }, { label: ZUKAN_TITLE, href: "/zukan" }, { label: article.ceoName }]} />
      <article style={{ maxWidth: "var(--max-w-text)", margin: "0 auto", padding: "var(--space-8) 20px 80px" }}>
        <header style={{ marginBottom: 28 }}>
          <Link href="/zukan" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "var(--ink-mute)", textDecoration: "none" }}>
            {ZUKAN_TITLE} <span style={{ fontWeight: 600 }}>by OPINIO</span>
          </Link>
          <h1 style={{ fontFamily: "var(--font-noto-serif)", fontWeight: 700, fontSize: "clamp(23px, 3.2vw, 32px)", color: "var(--ink)", lineHeight: 1.55, margin: "10px 0 14px", letterSpacing: "0.02em" }}>
            {article.title}
          </h1>
          <p style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 13, color: "var(--ink-mute)", margin: 0 }}>
            <span>公開 <time dateTime={article.publishedAt}>{formatZukanDate(article.publishedAt)}</time></span>
            {article.updatedAt !== article.publishedAt && (
              <span>更新 <time dateTime={article.updatedAt}>{formatZukanDate(article.updatedAt)}</time></span>
            )}
            <span>文 {author.name}</span>
          </p>
        </header>

        <ZukanCeoCard article={article} companyHref={companyHref} />

        <ZukanMarkdown>{article.body}</ZukanMarkdown>

        <ZukanAuthorBox article={article} />
        <ZukanConsultCta />

        <p style={{ marginTop: 40, textAlign: "center" }}>
          <Link href="/zukan" style={{ fontSize: 14, fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>
            ← {ZUKAN_TITLE}の一覧へ
          </Link>
        </p>
      </article>
    </>
  );
}
