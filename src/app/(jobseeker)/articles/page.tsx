import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  TYPE_BADGE,
  TYPE_EYECATCH_ICON,
  type Article,
} from "@/app/articles/mockArticleData";
import { getArticles } from "@/lib/supabase/queries";
import ArticleFilterBar from "./ArticleFilterBar";

export const metadata: Metadata = {
  title: "取材記事 — Opinio",
  description:
    "LayerX・SmartHR・Ubie・Salesforceなど、IT/SaaS業界のリアルな働き方を取材。社員インタビュー・メンターの声・CEO取材・組織レポートの4カテゴリで届けます。",
};

// ─── Article Card ─────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: Article }) {
  const badge = TYPE_BADGE[article.type];
  const icon  = TYPE_EYECATCH_ICON[article.type];
  const mainSubject = article.subject ?? article.subjects?.[0];

  return (
    <Link href={`/articles/${article.slug}`} style={{ textDecoration: "none" }}>
      <article style={{
        display: "flex", flexDirection: "column",
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        overflow: "hidden",
        height: "100%",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
      }}
        className="article-card"
      >
        {/* Eyecatch */}
        <div style={{
          height: 140,
          background: article.eyecatch_gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
        }}>
          <span style={{ fontSize: 48, opacity: 0.3 }}>{icon}</span>

          {/* Category badge */}
          <div style={{
            position: "absolute", top: 12, left: 14,
            display: "inline-flex", alignItems: "center",
            padding: "4px 10px", borderRadius: 100,
            background: badge.bg, color: badge.color,
            fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em",
          }}>
            {badge.label}
          </div>

          {/* Read time */}
          <div style={{
            position: "absolute", bottom: 10, right: 12,
            fontSize: 10, color: "rgba(255,255,255,0.85)",
            fontFamily: "Inter, sans-serif", fontWeight: 500,
          }}>
            {article.read_min} min read
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 18px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
          <h2 style={{
            fontFamily: 'var(--font-noto-serif)',
            fontSize: 14, fontWeight: 700, lineHeight: 1.6,
            color: "var(--ink)", marginBottom: 10,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          } as React.CSSProperties}>
            {article.title}
          </h2>

          {/* Subtitle */}
          <p style={{
            fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.7,
            marginBottom: 14, flex: 1,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          } as React.CSSProperties}>
            {article.subtitle}
          </p>

          {/* Footer: company + subject avatars + date */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            paddingTop: 12, borderTop: "1px solid var(--line-soft, #F1F5F9)",
          }}>
            {/* Company logo */}
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: article.company_gradient,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 9, fontWeight: 700, flexShrink: 0,
            }}>
              {article.company_initial}
            </div>

            <span style={{ fontSize: 11, color: "var(--ink-soft)", flex: 1, fontWeight: 500 }}>
              {article.company_name}
            </span>

            {/* Subject avatar(s) */}
            {article.type === "report" && article.subjects ? (
              <div style={{ display: "flex", gap: -4 }}>
                {article.subjects.slice(0, 2).map((s, i) => (
                  <div key={i} style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: s.gradient, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, fontWeight: 700, border: "1.5px solid #fff",
                    marginLeft: i > 0 ? -6 : 0,
                  }}>
                    {s.initial}
                  </div>
                ))}
              </div>
            ) : mainSubject ? (
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: mainSubject.gradient, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, fontWeight: 700, border: "1.5px solid #fff",
              }}>
                {mainSubject.initial}
              </div>
            ) : null}

            <span style={{ fontSize: 10.5, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
              {article.date.replace(/-/g, "/").slice(2)}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function ArticlesPage({ searchParams }: { searchParams: SearchParams }) {
  const typeParam = typeof searchParams.type === "string" ? searchParams.type : undefined;
  const sortParam = typeof searchParams.sort === "string" ? searchParams.sort : undefined;

  const [allArticles, filteredArticles] = await Promise.all([
    getArticles(),
    getArticles({ type: typeParam, sort: sortParam }),
  ]);

  // Stats per type
  const counts = {
    employee: allArticles.filter((a) => a.type === "employee").length,
    mentor:   allArticles.filter((a) => a.type === "mentor").length,
    ceo:      allArticles.filter((a) => a.type === "ceo").length,
    report:   allArticles.filter((a) => a.type === "report").length,
  };

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5 }}>
            <Link href="/" style={{ color: "var(--ink-mute)" }}>Opinio</Link>
            <span>/</span>
            <span style={{ color: "var(--ink-soft)" }}>取材記事</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "48px 0 40px" }}>
        <div style={{ maxWidth: "var(--max-w-text)", margin: "0 auto", textAlign: "center" }} className="px-5">

          {/* Category stats */}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { label: "社員インタビュー", count: counts.employee, color: "var(--success)", bg: "var(--success-soft)" },
              { label: "メンターの声",     count: counts.mentor,   color: "#B45309", bg: "var(--warm-soft)" },
              { label: "CEO・経営陣",      count: counts.ceo,      color: "var(--royal)", bg: "var(--royal-50)" },
              { label: "取材レポート",     count: counts.report,   color: "var(--purple)", bg: "#F3E8FF" },
            ].map(({ label, count, color, bg }) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 100,
                background: bg, color, fontSize: 11.5, fontWeight: 600,
              }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 15, fontWeight: 700 }}>{count}</span>
                {label}
              </div>
            ))}
          </div>

          <h1 style={{
            fontFamily: 'var(--font-noto-serif)',
            fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 500,
            color: "var(--ink)", letterSpacing: "0.04em",
            marginBottom: 16, lineHeight: 1.4,
          }}>
            取材で、知る。
          </h1>

          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8, maxWidth: 480, margin: "0 auto 24px" }}>
            IT/SaaS業界で働く人たちのリアルな声を、4つの視点でお届けします。
            転職を考える前に、まず「人」を知ることから始めましょう。
          </p>

          {/* Article type grid */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            {[
              { icon: "💬", label: "社員インタビュー", desc: "現場の声" },
              { icon: "🌟", label: "メンターの声",     desc: "経験談" },
              { icon: "👔", label: "CEO・経営陣",      desc: "ビジョン" },
              { icon: "📊", label: "取材レポート",     desc: "組織分析" },
            ].map(({ icon, label, desc }) => (
              <div key={label} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: "10px 16px", borderRadius: 12,
                border: "1px solid var(--line)", background: "var(--bg-tint)",
                minWidth: 90,
              }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)" }}>{label}</span>
                <span style={{ fontSize: 10, color: "var(--ink-mute)" }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <Suspense fallback={<div style={{ height: 52, background: "#fff", borderBottom: "1px solid var(--line)" }} />}>
        <ArticleFilterBar total={filteredArticles.length} />
      </Suspense>

      {/* Grid */}
      <div style={{ background: "var(--bg-tint)" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 py-8 md:px-12 md:py-10">
          {filteredArticles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--ink-mute)" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📰</div>
              <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--ink-soft)" }}>
                該当する記事が見つかりませんでした
              </p>
              <p style={{ fontSize: 14 }}>カテゴリを変更してみてください</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredArticles.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .article-card:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 16px 40px rgba(15,23,42,0.08) !important;
          transform: translateY(-2px) !important;
        }
      `}</style>
    </>
  );
}
