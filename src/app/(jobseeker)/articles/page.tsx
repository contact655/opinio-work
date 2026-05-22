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
  title: "取材記事 — OPINIO",
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
        boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
      }}
        className="article-card"
      >
        {/* Eyecatch */}
        <div style={{
          height: 150,
          background: article.eyecatch_gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}>
          {/* 背景デコレーション */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.12) 0%, transparent 60%)",
          }} />
          <span style={{ fontSize: 52, opacity: 0.25, position: "relative", zIndex: 1 }}>{icon}</span>

          {/* Category badge */}
          <div style={{
            position: "absolute", top: 12, left: 14, zIndex: 2,
            display: "inline-flex", alignItems: "center",
            padding: "4px 10px", borderRadius: 100,
            background: badge.bg, color: badge.color,
            fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em",
            backdropFilter: "blur(4px)",
          }}>
            {badge.label}
          </div>

          {/* 取材対象者アバター（右上） */}
          {mainSubject && (
            <div style={{
              position: "absolute", top: 10, right: 12, zIndex: 2,
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(0,0,0,0.28)", borderRadius: 100,
              padding: "3px 8px 3px 4px",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: mainSubject.gradient, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, fontWeight: 700, flexShrink: 0,
              }}>
                {mainSubject.initial}
              </div>
              <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.9)", fontWeight: 600, whiteSpace: "nowrap" }}>
                {mainSubject.name}
              </span>
            </div>
          )}

          {/* Read time */}
          {article.read_min && (
            <div style={{
              position: "absolute", bottom: 10, right: 12, zIndex: 2,
              fontSize: 10, color: "rgba(255,255,255,0.85)",
              fontFamily: "Inter, sans-serif", fontWeight: 500,
              display: "flex", alignItems: "center", gap: 3,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {article.read_min}分
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "16px 18px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
          {/* 取材対象者の役職（社員/メンター/CEO記事のみ） */}
          {mainSubject?.role_at_interview && (
            <div style={{
              fontSize: 10.5, color: "var(--ink-mute)", fontWeight: 500,
              marginBottom: 6, lineHeight: 1.4,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {mainSubject.role_at_interview}
            </div>
          )}

          <h2 style={{
            fontFamily: 'var(--font-noto-serif)',
            fontSize: 14, fontWeight: 700, lineHeight: 1.65,
            color: "var(--ink)", marginBottom: 8,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          } as React.CSSProperties}>
            {article.title}
          </h2>

          {/* テーマタグ（あれば最大2つ） */}
          {article.themes && article.themes.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
              {article.themes.slice(0, 2).map((t, i) => (
                <span key={i} style={{
                  fontSize: 9.5, fontWeight: 600, padding: "2px 7px", borderRadius: 100,
                  background: "var(--royal-50)", color: "var(--royal)",
                  border: "1px solid var(--royal-100)",
                }}>
                  {t.title}
                </span>
              ))}
            </div>
          )}

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

          {/* Footer: company + mentor CTA + date */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            paddingTop: 10, borderTop: "1px solid var(--line-soft, #F1F5F9)",
          }}>
            {/* Company logo */}
            <div style={{
              width: 22, height: 22, borderRadius: 5,
              background: article.company_gradient,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 8.5, fontWeight: 700, flexShrink: 0,
            }}>
              {article.company_initial}
            </div>
            <span style={{ fontSize: 11, color: "var(--ink-soft)", flex: 1, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {article.company_name}
            </span>

            {/* メンター相談ミニCTA */}
            {mainSubject?.is_mentor && mainSubject?.mentor_id && (
              <span style={{
                fontSize: 9.5, fontWeight: 700, padding: "3px 8px", borderRadius: 100,
                background: "var(--warm-soft)", color: "#B45309",
                border: "1px solid #FDE68A", whiteSpace: "nowrap", flexShrink: 0,
              }}>
                相談可
              </span>
            )}

            <span style={{ fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
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

const PER_PAGE = 9;

export default async function ArticlesPage({ searchParams }: { searchParams: SearchParams }) {
  const typeParam = typeof searchParams.type === "string" ? searchParams.type : undefined;
  const sortParam = typeof searchParams.sort === "string" ? searchParams.sort : undefined;
  const pageParam  = typeof searchParams.page === "string" ? Math.max(1, parseInt(searchParams.page, 10)) : 1;

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

  // Pagination (フィーチャー記事を除いたグリッド分を対象)
  const gridArticles = typeParam ? filteredArticles : filteredArticles.slice(1);
  const totalPages   = Math.max(1, Math.ceil(gridArticles.length / PER_PAGE));
  const safePage     = Math.min(pageParam, totalPages);
  const pagedGridArticles = gridArticles.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5 }}>
            <Link href="/" style={{ color: "var(--ink-mute)" }}>OPINIO</Link>
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
            <>
              {/* Featured article (最初の1件を大きく) */}
              {!typeParam && filteredArticles.length > 0 && (() => {
                const featured = filteredArticles[0];
                const badge = TYPE_BADGE[featured.type];
                const icon = TYPE_EYECATCH_ICON[featured.type];
                const mainSubject = featured.subject ?? featured.subjects?.[0];
                return (
                  <Link href={`/articles/${featured.slug}`} style={{ textDecoration: "none", display: "block", marginBottom: 24 }}>
                    <article
                      className="article-card"
                      style={{
                        display: "flex",
                        background: "#fff",
                        border: "1px solid var(--line)",
                        borderRadius: 16,
                        overflow: "hidden",
                        boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
                        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                      }}
                    >
                      {/* Eyecatch — left side */}
                      <div style={{
                        width: 280,
                        flexShrink: 0,
                        background: featured.eyecatch_gradient,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                      }}>
                        <span style={{ fontSize: 72, opacity: 0.25 }}>{icon}</span>
                        <div style={{
                          position: "absolute", top: 14, left: 14,
                          display: "inline-flex", alignItems: "center",
                          padding: "4px 10px", borderRadius: 100,
                          background: badge.bg, color: badge.color,
                          fontSize: 10.5, fontWeight: 700,
                        }}>
                          {badge.label}
                        </div>
                        <div style={{
                          position: "absolute", top: 14, right: 14,
                          background: "rgba(255,255,255,0.9)",
                          borderRadius: 6, padding: "3px 8px",
                          fontSize: 10, color: "var(--ink-soft)", fontWeight: 600,
                        }}>
                          FEATURED
                        </div>
                      </div>
                      {/* Body */}
                      <div style={{ padding: "28px 32px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 7,
                            background: featured.company_gradient,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontSize: 10, fontWeight: 700,
                          }}>
                            {featured.company_initial}
                          </div>
                          <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>
                            {featured.company_name}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                            · {featured.date.replace(/-/g, "/").slice(2)}
                          </span>
                        </div>
                        <h2 style={{
                          fontFamily: "var(--font-noto-serif)",
                          fontSize: 20, fontWeight: 700, lineHeight: 1.55,
                          color: "var(--ink)", marginBottom: 10,
                        }}>
                          {featured.title}
                        </h2>
                        <p style={{
                          fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.75,
                          marginBottom: 16,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        } as React.CSSProperties}>
                          {featured.subtitle}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {mainSubject && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{
                                width: 24, height: 24, borderRadius: "50%",
                                background: mainSubject.gradient, color: "#fff",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 9, fontWeight: 700,
                              }}>
                                {mainSubject.initial}
                              </div>
                              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{mainSubject.name}</span>
                            </div>
                          )}
                          {featured.read_min && (
                            <span style={{
                              fontSize: 11, color: "var(--ink-mute)",
                              fontFamily: "Inter, sans-serif",
                              display: "inline-flex", alignItems: "center", gap: 3,
                            }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                              </svg>
                              {featured.read_min}分で読めます
                            </span>
                          )}
                          <span style={{
                            marginLeft: "auto",
                            fontSize: 12, fontWeight: 600, color: "var(--royal)",
                            display: "flex", alignItems: "center", gap: 4,
                          }}>
                            読む
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                            </svg>
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })()}

              {/* Rest of articles */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {pagedGridArticles.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div style={{
                  display: "flex", justifyContent: "center", alignItems: "center",
                  gap: 8, marginTop: 40,
                }}>
                  {safePage > 1 && (
                    <Link
                      href={`/articles?${new URLSearchParams({ ...(typeParam ? { type: typeParam } : {}), ...(sortParam ? { sort: sortParam } : {}), page: String(safePage - 1) })}`}
                      style={{
                        padding: "8px 16px", borderRadius: 8, fontSize: 13,
                        border: "1px solid var(--line)", background: "#fff",
                        color: "var(--ink-soft)", textDecoration: "none",
                        fontWeight: 500,
                      }}
                    >
                      ← 前へ
                    </Link>
                  )}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Link
                      key={p}
                      href={`/articles?${new URLSearchParams({ ...(typeParam ? { type: typeParam } : {}), ...(sortParam ? { sort: sortParam } : {}), page: String(p) })}`}
                      style={{
                        width: 36, height: 36, borderRadius: 8,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: p === safePage ? 700 : 400,
                        background: p === safePage ? "var(--royal)" : "#fff",
                        color: p === safePage ? "#fff" : "var(--ink-soft)",
                        border: `1px solid ${p === safePage ? "var(--royal)" : "var(--line)"}`,
                        textDecoration: "none",
                      }}
                    >
                      {p}
                    </Link>
                  ))}
                  {safePage < totalPages && (
                    <Link
                      href={`/articles?${new URLSearchParams({ ...(typeParam ? { type: typeParam } : {}), ...(sortParam ? { sort: sortParam } : {}), page: String(safePage + 1) })}`}
                      style={{
                        padding: "8px 16px", borderRadius: 8, fontSize: 13,
                        border: "1px solid var(--line)", background: "#fff",
                        color: "var(--ink-soft)", textDecoration: "none",
                        fontWeight: 500,
                      }}
                    >
                      次へ →
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        .article-card:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 8px 24px rgba(0,35,102,0.10) !important;
          transform: translateY(-2px) !important;
        }
      `}</style>
    </>
  );
}
