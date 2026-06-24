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

// 5分間ページキャッシュ（ISR）
export const revalidate = 300;

export const metadata: Metadata = {
  title: "取材記事 — OPINIO",
  description:
    "LayerX・SmartHR・Ubie・Salesforceなど、IT/SaaS業界のリアルな働き方を取材。社員インタビュー・CEO取材・組織レポートを届けます。",
  keywords: ["IT業界インタビュー", "SaaS転職", "社員の声", "組織文化", "キャリア", "OPINIO"],
  alternates: { canonical: "/articles" },
  openGraph: {
    title: "IT/SaaS業界の取材記事 | OPINIO",
    description: "LayerX・SmartHR・Ubie・Salesforceなど、IT/SaaS業界のリアルな働き方を取材。社員・CEO・組織レポートの3カテゴリ。",
    type: "website",
    url: "/articles",
    images: [{ url: "/api/og?type=list&title=%E5%8F%96%E6%9D%90%E8%A8%98%E4%BA%8B&sub=IT%2FSaaS%E6%A5%AD%E7%95%8C%E3%81%AE%E3%83%AA%E3%82%A2%E3%83%AB%E3%81%AA%E5%83%8D%E3%81%8D%E6%96%B9", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

// ─── Article Card ─────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: Article }) {
  const badge = TYPE_BADGE[article.type];
  const icon  = TYPE_EYECATCH_ICON[article.type];
  const mainSubject = article.subject ?? article.subjects?.[0];

  return (
    <Link href={`/articles/${article.slug}`} prefetch={true} style={{ textDecoration: "none" }}>
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
          height: 140,
          background: article.eyecatch_gradient || "linear-gradient(135deg, var(--royal), #3B5FD9)",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}>
          {/* 背景デコレーション */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.15) 0%, transparent 60%)",
          }} />
          {/* 引用マーク（インタビュー系記事） */}
          {(article.type === "employee" || article.type === "mentor" || article.type === "ceo") && (
            <span style={{
              position: "absolute", left: 14, bottom: 10, zIndex: 1,
              fontFamily: "Georgia, serif", fontSize: 64, lineHeight: 1,
              color: "rgba(255,255,255,0.15)", fontWeight: 700, userSelect: "none",
            }}>&ldquo;</span>
          )}
          <span style={{ fontSize: 44, opacity: 0.18, position: "relative", zIndex: 1 }}>{icon}</span>

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
        <div style={{ padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
          {/* 取材対象者の役職（社員/メンター/CEO記事のみ） */}
          {mainSubject?.role_at_interview && (
            <div style={{
              fontSize: 10.5, color: "var(--ink-mute)", fontWeight: 600,
              marginBottom: 6, lineHeight: 1.4,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              letterSpacing: "0.02em",
            }}>
              {mainSubject.role_at_interview}
            </div>
          )}

          <h2 style={{
            fontFamily: 'var(--font-noto-serif)',
            fontSize: 14.5, fontWeight: 700, lineHeight: 1.55,
            color: "var(--ink)", marginBottom: "var(--space-2)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
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
            fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7,
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
            display: "flex", alignItems: "center", gap: "var(--space-2)",
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
            <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-soft)", flex: 1, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {article.company_name}
            </span>


            <span style={{ fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
              {article.date.replace(/-/g, "/").slice(2)}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

// ─── Article List Row (リスト表示) ────────────────────────────────────────────

function ArticleListRow({ article }: { article: Article }) {
  const badge = TYPE_BADGE[article.type];
  const mainSubject = article.subject ?? article.subjects?.[0];

  return (
    <Link href={`/articles/${article.slug}`} prefetch={true} style={{ textDecoration: "none" }}>
      <article style={{
        display: "flex", alignItems: "center", gap: 16,
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "14px 18px",
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
      }} className="article-card">
        {/* カテゴリバッジ */}
        <div style={{
          flexShrink: 0,
          display: "inline-flex", alignItems: "center",
          padding: "4px 10px", borderRadius: 100,
          background: badge.bg, color: badge.color,
          fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
          minWidth: 80, justifyContent: "center",
        }}>
          {badge.label}
        </div>

        {/* タイトル + 取材対象者 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {mainSubject?.role_at_interview && (
            <div style={{ fontSize: 10.5, color: "var(--ink-mute)", fontWeight: 600, marginBottom: 3, lineHeight: 1.3 }}>
              {mainSubject.role_at_interview}
            </div>
          )}
          <div style={{
            fontSize: 14, fontWeight: 700, color: "var(--ink)",
            lineHeight: 1.45, fontFamily: "var(--font-noto-serif)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {article.title}
          </div>
        </div>

        {/* 会社 + 読了時間 + 日付 */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 18, height: 18, borderRadius: 4,
              background: article.company_gradient,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 8, fontWeight: 700, flexShrink: 0,
            }}>
              {article.company_initial}
            </div>
            <span style={{ fontSize: 11, color: "var(--ink-soft)", fontWeight: 500, whiteSpace: "nowrap" }}>
              {article.company_name}
            </span>
          </div>
          {article.read_min && (
            <span style={{
              fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 3,
              fontFamily: "Inter, sans-serif",
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {article.read_min}分
            </span>
          )}
          <span style={{ fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
            {article.date.replace(/-/g, "/").slice(2)}
          </span>
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
  const qParam    = typeof searchParams.q    === "string" ? searchParams.q    : undefined;
  const pageParam  = typeof searchParams.page === "string" ? Math.max(1, parseInt(searchParams.page, 10)) : 1;
  const viewParam  = typeof searchParams.view === "string" ? searchParams.view : "grid";

  const [_allArticles, filteredArticles] = await Promise.all([
    getArticles(),
    getArticles({ type: typeParam, sort: sortParam, q: qParam }),
  ]);


  // Pagination (フィーチャー記事を除いたグリッド分を対象)
  const gridArticles = typeParam ? filteredArticles : filteredArticles.slice(1);
  const totalPages   = Math.max(1, Math.ceil(gridArticles.length / PER_PAGE));
  const safePage     = Math.min(pageParam, totalPages);
  const pagedGridArticles = gridArticles.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <>
      {/* Breadcrumb */}
      <nav aria-label="パンくずリスト" style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5 }}>
            <Link href="/" style={{ color: "var(--ink-mute)" }}>OPINIO</Link>
            <span>/</span>
            <span aria-current="page" style={{ color: "var(--ink-soft)" }}>取材記事</span>
          </div>
        </div>
      </nav>


      {/* Filter bar */}
      <Suspense fallback={<div style={{ height: 52, background: "#fff", borderBottom: "1px solid var(--line)" }} />}>
        <ArticleFilterBar total={filteredArticles.length} />
      </Suspense>

      {/* Grid */}
      <div style={{ background: "var(--bg-tint)" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 py-8 md:px-12 md:py-10">
          {filteredArticles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--ink-mute)" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6z" />
                </svg>
              </div>
              <p style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-2)", color: "var(--ink-soft)" }}>
                該当する記事が見つかりませんでした
              </p>
              <p style={{ fontSize: "var(--text-base)" }}>カテゴリを変更してみてください</p>
            </div>
          ) : (
            <>
              {/* Featured article (グリッド表示時のみ) */}
              {viewParam !== "list" && !typeParam && filteredArticles.length > 0 && (() => {
                const featured = filteredArticles[0];
                const badge = TYPE_BADGE[featured.type];
                const icon = TYPE_EYECATCH_ICON[featured.type];
                const mainSubject = featured.subject ?? featured.subjects?.[0];
                return (
                  <Link href={`/articles/${featured.slug}`} style={{ textDecoration: "none", display: "block", marginBottom: "var(--space-6)" }}>
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
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
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
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-mute)" }}>
                            · {featured.date.replace(/-/g, "/").slice(2)}
                          </span>
                        </div>
                        <h2 style={{
                          fontFamily: "var(--font-noto-serif)",
                          fontSize: "var(--text-lg)", fontWeight: 700, lineHeight: 1.55,
                          color: "var(--ink)", marginBottom: 10,
                        }}>
                          {featured.title}
                        </h2>
                        <p style={{
                          fontSize: "var(--text-sm)", color: "var(--ink-soft)", lineHeight: 1.75,
                          marginBottom: "var(--space-4)",
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
                              fontSize: "var(--text-xs)", color: "var(--ink-mute)",
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
              {viewParam === "list" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filteredArticles.map((article) => (
                    <ArticleListRow key={article.slug} article={article} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {pagedGridArticles.map((article) => (
                    <ArticleCard key={article.slug} article={article} />
                  ))}
                </div>
              )}

              {/* ── Pagination（グリッド表示のみ） ── */}
              {viewParam !== "list" && totalPages > 1 && (
                <div style={{
                  display: "flex", justifyContent: "center", alignItems: "center",
                  gap: "var(--space-2)", marginTop: 40,
                }}>
                  {safePage > 1 && (
                    <Link
                      href={`/articles?${new URLSearchParams({ ...(typeParam ? { type: typeParam } : {}), ...(sortParam ? { sort: sortParam } : {}), page: String(safePage - 1) })}`}
                      style={{
                        padding: "var(--space-2) var(--space-4)", borderRadius: 8, fontSize: "var(--text-sm)",
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
                        fontSize: "var(--text-sm)", fontWeight: p === safePage ? 700 : 400,
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
                        padding: "var(--space-2) var(--space-4)", borderRadius: 8, fontSize: "var(--text-sm)",
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

      {/* ── 読んだあとは企業へ ── */}
      <div style={{ background: "#fff", borderTop: "1px solid var(--line)", padding: "48px 24px" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}>
          <div style={{
            background: "linear-gradient(135deg, var(--royal-50) 0%, #EEF2FF 100%)",
            border: "1.5px solid var(--royal-100)",
            borderRadius: 16,
            padding: "32px 40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-6)",
            flexWrap: "wrap",
          }}>
            <div>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", marginBottom: "var(--space-2)", textTransform: "uppercase" }}>
                NEXT STEP
              </div>
              <p style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(15px, 2vw, 18px)", fontWeight: 500,
                color: "var(--ink)", margin: 0, lineHeight: 1.55,
              }}>
                気になったら、企業ページで在籍者にDMしてみよう。
              </p>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)", marginTop: "var(--space-2)", lineHeight: 1.7 }}>
                OPINIOに登録している企業の在籍ユーザーにDMで直接コンタクトできます。完全無料。
              </p>
            </div>
            <Link href="/companies" style={{
              display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
              padding: "var(--space-3) var(--space-6)", borderRadius: 8, fontSize: "var(--text-base)", fontWeight: 700,
              background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
              color: "#fff", textDecoration: "none",
              boxShadow: "0 4px 16px rgba(0,35,102,0.25)",
              flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              企業を見る
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        .article-card:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 12px 32px rgba(0,35,102,0.13) !important;
          transform: translateY(-4px) !important;
        }
        .article-card { cursor: pointer; }
      `}</style>
    </>
  );
}
