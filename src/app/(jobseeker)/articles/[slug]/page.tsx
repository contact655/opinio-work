import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  TYPE_BADGE,
  TYPE_EYECATCH_ICON,
  type Article,
  type ArticleSubject,
  type QA,
  type ThemeItem,
  type Chapter,
} from "@/app/articles/mockArticleData";
import {
  getArticleBySlug,
  getArticlesBySlugs,
} from "@/lib/supabase/queries";
import { ReadingProgress } from "@/components/jobseeker/ReadingProgress";
import { BackToTop } from "@/components/jobseeker/BackToTop";

// 5分間ページキャッシュ（ISR）
export const revalidate = 300;

// ─── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const article = await getArticleBySlug(params.slug);
  if (!article) return { title: "記事 — OPINIO" };

  const typeLabel =
    article.type === "employee" ? "社員インタビュー"
    : article.type === "mentor" ? "メンターの声"
    : article.type === "ceo" ? "CEO取材"
    : "組織レポート";

  const description = article.subtitle
    ? article.subtitle
    : `${article.company_name}の${typeLabel}。読了${article.read_min}分。IT/SaaS業界のリアルな働き方をOPINIOが取材。`;

  const ogImageUrl = `/api/og?type=article&name=${encodeURIComponent(article.title)}&sub=${encodeURIComponent(article.company_name)}&badge=${encodeURIComponent(typeLabel)}`;

  return {
    title: `${article.title} — OPINIO`,
    description,
    alternates: { canonical: `/articles/${params.slug}` },
    keywords: [article.company_name, typeLabel, "IT転職", "SaaS転職", "社員インタビュー"].filter(Boolean),
    openGraph: {
      title: `${article.title} — OPINIO`,
      description,
      type: "article",
      url: `/articles/${params.slug}`,
      publishedTime: article.date,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: article.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${article.title} — OPINIO`,
      description,
      images: [ogImageUrl],
    },
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ROYAL = "var(--royal)";
const LINE  = "var(--line)";
const INK   = "var(--ink)";
const INK_SOFT = "var(--ink-soft)";
const INK_MUTE = "var(--ink-mute)";

function SubjectCard({ subject }: { subject: ArticleSubject }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "60px 1fr",
      gap: "var(--space-4)",
      padding: "var(--space-4) var(--space-6)",
      background: "var(--bg-tint)",
      border: `1px solid ${LINE}`,
      borderRadius: 14,
      marginBottom: "var(--space-8)",
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: "50%",
        background: subject.gradient,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: "var(--text-lg)", fontWeight: 700,
        boxShadow: `0 0 0 2.5px ${ROYAL}, 0 0 0 5px rgba(0,35,102,0.1)`,
        flexShrink: 0,
      }}>
        {subject.initial}
      </div>

      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--text-base)", fontWeight: 700, color: INK }}>
            {subject.name}
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 11.5 }}>
          <div>
            <span style={{ color: INK_MUTE, marginRight: 4 }}>取材時</span>
            <span style={{ color: INK_SOFT, fontWeight: 500 }}>{subject.role_at_interview}</span>
          </div>
          <div>
            <span style={{ color: INK_MUTE, marginRight: 4 }}>現在</span>
            <span style={{ color: INK_SOFT, fontWeight: 500 }}>{subject.current_status}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QASection({ qa }: { qa: QA[] }) {
  return (
    <div style={{ marginTop: 40 }}>
      {qa.map((item, idx) => (
        <div key={idx} style={{ marginBottom: 40 }}>
          {/* Q */}
          <div style={{ display: "flex", gap: 14, alignItems: "baseline", marginBottom: "var(--space-4)" }}>
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700,
              color: ROYAL, letterSpacing: "0.1em", flexShrink: 0, paddingTop: 4,
            }}>
              Q.{String(idx + 1).padStart(2, "0")}
            </span>
            <p style={{
              fontFamily: 'var(--font-noto-serif)',
              fontSize: "var(--text-md)", fontWeight: 600, color: INK,
              lineHeight: 1.6, margin: 0,
            }}>
              {item.q}
            </p>
          </div>
          {/* A */}
          <div style={{ paddingLeft: 36 }}>
            {item.a.map((para, pi) => (
              <p key={pi} style={{
                fontSize: "var(--text-md)", lineHeight: 2, color: INK,
                marginBottom: pi < item.a.length - 1 ? "var(--space-4)" : 0,
              }}>
                {para}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function _ThemesSection({ themes }: { themes: ThemeItem[] }) {
  return (
    <div style={{
      marginTop: 48,
      padding: "var(--space-8)",
      background: "linear-gradient(135deg, #FEF3C7 0%, #fff 100%)",
      border: "1px solid #FDE68A",
      borderRadius: 16,
    }}>
      <div style={{ marginBottom: "var(--space-2)", display: "flex", alignItems: "baseline", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <h3 style={{
          fontFamily: 'var(--font-noto-serif)',
          fontWeight: 700, fontSize: "var(--text-lg)", color: INK, margin: 0,
        }}>
          相談できるテーマ
        </h3>
        <span style={{
          fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
          color: "#B45309", letterSpacing: "0.2em", textTransform: "uppercase",
        }}>
          CONSULTATION THEMES
        </span>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: INK_SOFT, lineHeight: 1.8, marginBottom: "var(--space-6)" }}>
        このメンターが特に得意とするテーマです。相談時の参考にしてください。
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {themes.map((theme) => (
          <div key={theme.title} style={{
            display: "grid", gridTemplateColumns: "32px 1fr", gap: "var(--space-3)",
            padding: 14, background: "#fff",
            border: `1px solid ${LINE}`, borderRadius: 10,
            alignItems: "flex-start",
          }}>
            <div style={{
              width: 32, height: 32, background: "var(--warm-soft)", color: "#B45309",
              borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "var(--text-md)", flexShrink: 0,
            }}>
              {theme.icon}
            </div>
            <div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: INK, marginBottom: 4, lineHeight: 1.5 }}>
                {theme.title}
              </div>
              <div style={{ fontSize: 11, color: INK_SOFT, lineHeight: 1.7 }}>
                {theme.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyCTA({ article }: { article: Article }) {
  return (
    <div style={{
      marginTop: 48,
      background: `linear-gradient(135deg, ${ROYAL} 0%, #3B5FD9 100%)`,
      color: "#fff",
      padding: "var(--space-8) var(--space-6)",
      borderRadius: 20,
      textAlign: "center",
      boxShadow: "0 20px 48px rgba(0,35,102,0.22)",
    }}>
      <div style={{ marginBottom: "var(--space-2)", opacity: 0.9, fontSize: "var(--text-sm)" }}>
        この企業について、もっと知る
      </div>
      <h3 style={{
        fontFamily: 'var(--font-noto-serif)',
        fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-4)", lineHeight: 1.5,
      }}>
        {article.company_name}で、働く。
      </h3>
      <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          href={`/jobs?company=${article.company_id}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px var(--space-6)", background: "#fff", color: ROYAL,
            borderRadius: 9, fontSize: "var(--text-sm)", fontWeight: 700, textDecoration: "none",
          }}
        >
          求人を見る
        </Link>
        <Link
          href={`/companies/${article.company_id}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px var(--space-6)", background: "transparent", color: "#fff",
            border: "2px solid rgba(255,255,255,0.5)",
            borderRadius: 9, fontSize: "var(--text-sm)", fontWeight: 700, textDecoration: "none",
          }}
        >
          企業を見る
        </Link>
      </div>
    </div>
  );
}

function ChaptersSection({ chapters }: { chapters: Chapter[] }) {
  return (
    <div>
      {chapters.map((ch) => (
        <div key={ch.num} style={{
          marginTop: 48, paddingTop: 40,
          borderTop: `1px solid ${LINE}`,
        }}>
          <h3 style={{
            fontFamily: 'var(--font-noto-serif)',
            fontWeight: 700, fontSize: "var(--text-xl)", lineHeight: 1.55,
            color: INK, marginBottom: "var(--space-6)",
            display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap",
          }}>
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: "var(--text-sm)", fontWeight: 700,
              color: "var(--purple)", letterSpacing: "0.1em",
              padding: "2px 10px",
              border: "2px solid #7C3AED",
              borderRadius: 6, flexShrink: 0,
            }}>
              CHAPTER {ch.num}
            </span>
            {ch.title}
          </h3>

          {ch.body.map((para, i) => (
            <p key={i} style={{
              fontSize: "var(--text-md)", lineHeight: 2, color: INK,
              marginBottom: i < ch.body.length - 1 ? "var(--space-4)" : 0,
            }}>
              {para}
            </p>
          ))}

          {ch.list && (
            <ul style={{
              listStyle: "none", padding: "var(--space-4)",
              background: "var(--bg-tint)", borderRadius: 10, margin: "var(--space-4) 0",
            }}>
              {ch.list.map((item, i) => (
                <li key={i} style={{
                  padding: "var(--space-2) 0",
                  borderBottom: i < ch.list!.length - 1 ? "1px dashed var(--line)" : "none",
                  fontSize: "var(--text-base)", lineHeight: 1.8,
                  display: "flex", gap: "var(--space-3)",
                }}>
                  <strong style={{
                    color: ROYAL, fontFamily: "Inter, sans-serif",
                    fontWeight: 700, minWidth: 80, flexShrink: 0,
                  }}>
                    {item.key}
                  </strong>
                  <span style={{ color: INK_SOFT }}>{item.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function ContributorsSection({ subjects }: { subjects: ArticleSubject[] }) {
  return (
    <div style={{
      marginTop: 56,
      padding: "var(--space-6) var(--space-8)",
      background: "linear-gradient(135deg, #F3E8FF 0%, #fff 100%)",
      border: "1px solid #E9D5FF",
      borderRadius: 16,
    }}>
      <div style={{ marginBottom: "var(--space-2)", display: "flex", alignItems: "baseline", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <h3 style={{
          fontFamily: 'var(--font-noto-serif)',
          fontWeight: 700, fontSize: "var(--text-lg)", color: INK, margin: 0,
        }}>
          取材協力
        </h3>
        <span style={{
          fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
          color: "var(--purple)", letterSpacing: "0.2em", textTransform: "uppercase",
        }}>
          CONTRIBUTORS
        </span>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: INK_SOFT, lineHeight: 1.8, marginBottom: "var(--space-4)" }}>
        今回の取材にご協力いただいた方々です。
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {subjects.map((s) => (
          <div key={s.name} style={{
            display: "grid", gridTemplateColumns: "44px 1fr",
            gap: "var(--space-3)", alignItems: "center",
            padding: "var(--space-3) 14px", background: "#fff",
            border: `1px solid ${LINE}`, borderRadius: 10,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: s.gradient, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 600, fontSize: "var(--text-md)", flexShrink: 0,
            }}>
              {s.initial}
            </div>
            <div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: INK, marginBottom: 2 }}>
                {s.name}
              </div>
              <div style={{ fontSize: 11, color: INK_SOFT }}>{s.current_status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RelatedArticles({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null;

  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: "var(--space-4)", paddingBottom: "var(--space-2)",
        borderBottom: `2px solid ${INK}`,
      }}>
        <h3 style={{
          fontFamily: 'var(--font-noto-serif)',
          fontWeight: 700, fontSize: "var(--text-lg)", color: INK,
          display: "flex", alignItems: "baseline", gap: "var(--space-3)", margin: 0,
        }}>
          関連記事
          <span style={{
            fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
            color: INK_MUTE, letterSpacing: "0.2em", textTransform: "uppercase",
          }}>
            RELATED ARTICLES
          </span>
        </h3>
        <Link href="/articles" style={{ color: ROYAL, fontSize: 12, fontWeight: 600 }}>
          すべての記事 →
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--space-4)" }}>
        {articles.map((a) => {
          const badge = TYPE_BADGE[a.type];
          return (
            <Link key={a.slug} href={`/articles/${a.slug}`} style={{ textDecoration: "none" }}>
              <div style={{
                background: "#fff", border: `1px solid ${LINE}`,
                borderRadius: 12, overflow: "hidden",
                display: "flex", flexDirection: "column",
                transition: "all 0.2s",
              }}
                className="related-article-hover"
              >
                <div style={{
                  height: 110, background: a.eyecatch_gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 36, opacity: 0.3 }}>{TYPE_EYECATCH_ICON[a.type]}</span>
                </div>
                <div style={{ padding: "var(--space-3) 14px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "2px 8px", borderRadius: 100,
                    background: badge.bg, color: badge.color,
                    fontSize: 9.5, fontWeight: 700, marginBottom: 6, alignSelf: "flex-start",
                  }}>
                    {badge.label}
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-noto-serif)',
                    fontSize: 12, fontWeight: 600, lineHeight: 1.6,
                    color: INK, marginBottom: "var(--space-2)",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  } as React.CSSProperties}>
                    {a.title}
                  </p>
                  <div style={{ marginTop: "auto", fontSize: 10, color: INK_MUTE }}>
                    {a.company_name} · {a.date.slice(2).replace(/-/g, "/")}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const [article, ] = await Promise.all([
    getArticleBySlug(params.slug),
  ]);

  if (!article) notFound();

  // Fetch related articles server-side (slugs from DB)
  const relatedArticles = await getArticlesBySlugs(
    (article.related_article_slugs ?? []).slice(0, 4)
  );

  const badge = TYPE_BADGE[article.type];
  const icon  = TYPE_EYECATCH_ICON[article.type];
  const mainSubject = article.subject ?? article.subjects?.[0];

  return (
    <>
      <ReadingProgress />
      <BackToTop />

      {/* Breadcrumb */}
      <nav aria-label="パンくずリスト" style={{ background: "var(--bg-tint)", borderBottom: `1px solid ${LINE}`, padding: "var(--space-2) 0" }}>
        <div style={{ maxWidth: "var(--max-w-text)", margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ fontSize: 12, color: INK_MUTE, display: "flex", alignItems: "center", gap: 5 }}>
            <Link href="/" style={{ color: INK_MUTE }}>OPINIO</Link>
            <span>/</span>
            <Link href="/articles" style={{ color: INK_MUTE }}>取材記事</Link>
            <span>/</span>
            <span aria-current="page" style={{ color: INK_SOFT }}>{badge.label}</span>
          </div>
        </div>
      </nav>

      {/* Article body */}
      <article style={{ maxWidth: "var(--max-w-text)", margin: "0 auto", padding: "var(--space-8) var(--space-6) 80px" }}>

        {/* Hero */}
        <div style={{ marginBottom: 40 }}>
          {/* Eyecatch image */}
          <div style={{
            height: 260, background: article.eyecatch_gradient,
            borderRadius: 16, marginBottom: "var(--space-6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <span style={{ fontSize: 80, opacity: 0.25 }}>{icon}</span>
            <div style={{
              position: "absolute", top: 16, left: 16,
              display: "inline-flex", alignItems: "center",
              padding: "var(--space-1) var(--space-3)", borderRadius: 100,
              background: badge.bg, color: badge.color,
              fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
            }}>
              {badge.label}
            </div>
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'var(--font-noto-serif)',
            fontWeight: 700, fontSize: "clamp(24px, 3vw, 34px)",
            color: INK, lineHeight: 1.55, marginBottom: "var(--space-4)",
            letterSpacing: "0.02em",
          }}>
            {article.title}
          </h1>

          <p style={{
            fontFamily: 'var(--font-noto-serif)',
            fontSize: "var(--text-md)", color: INK_SOFT,
            lineHeight: 1.7, marginBottom: 22,
          }}>
            {article.subtitle}
          </p>

          {/* Meta */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: article.company_gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 8, fontWeight: 700,
              }}>
                {article.company_initial}
              </div>
              <span style={{ color: INK_SOFT, fontWeight: 600 }}>
                {article.company_name}
              </span>
            </div>
            <span style={{ color: INK_MUTE }}>
              {article.date.replace(/-/g, "/")}
            </span>
            <span style={{ color: INK_MUTE }}>
              {article.read_min} min read
            </span>
          </div>
        </div>

        {/* Subject card */}
        {article.type !== "report" && mainSubject && (
          <SubjectCard subject={mainSubject} />
        )}

        {/* ── employee / mentor / ceo body ── */}
        {article.type !== "report" && (
          <>
            {/* EDITOR'S NOTE */}
            {article.editor_note && (
              <div style={{
                padding: "var(--space-4) var(--space-6)", background: "var(--bg-tint)",
                borderLeft: `3px solid ${ROYAL}`, borderRadius: "0 10px 10px 0",
                marginBottom: "var(--space-8)",
              }}>
                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                  color: INK_MUTE, letterSpacing: "0.15em", marginBottom: "var(--space-2)",
                }}>
                  EDITOR&apos;S NOTE
                </div>
                <p style={{ fontSize: "var(--text-base)", lineHeight: 1.9, color: INK_SOFT, margin: 0 }}>
                  {article.editor_note}
                </p>
              </div>
            )}

            {/* Body paragraphs */}
            {article.body?.map((para, i) => (
              <p key={i} style={{
                fontSize: "var(--text-md)", lineHeight: 2, color: INK,
                marginBottom: "var(--space-4)",
              }}>
                {para}
              </p>
            ))}

            {/* Pull quote */}
            {article.quote && (
              <blockquote style={{
                padding: "var(--space-4) 0 var(--space-4) var(--space-4)",
                margin: "var(--space-6) 0",
                borderLeft: `3px solid ${ROYAL}`,
                fontFamily: 'var(--font-noto-serif)',
                fontSize: "var(--text-md)", color: INK,
                fontStyle: "italic", lineHeight: 1.8,
              }}>
                {article.quote}
              </blockquote>
            )}

            {/* Q&A */}
            {article.qa && <QASection qa={article.qa} />}

            {/* Editor outro */}
            {article.editor_outro && (
              <div style={{
                marginTop: 48, padding: "var(--space-6)",
                background: "var(--bg-tint)", borderRadius: 12,
              }}>
                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                  color: INK_MUTE, letterSpacing: "0.15em", marginBottom: "var(--space-2)",
                }}>
                  EDITOR&apos;S OUTRO
                </div>
                <p style={{ fontSize: "var(--text-base)", lineHeight: 1.9, color: INK_SOFT, margin: 0 }}>
                  {article.editor_outro}
                </p>
              </div>
            )}

            {/* CEO: company CTA */}
            {article.type === "ceo" && (
              <CompanyCTA article={article} />
            )}
          </>
        )}

        {/* ── report body ── */}
        {article.type === "report" && (
          <>
            {article.editor_note && (
              <div style={{
                padding: "var(--space-4) var(--space-6)", background: "var(--bg-tint)",
                borderLeft: `3px solid ${ROYAL}`, borderRadius: "0 10px 10px 0",
                marginBottom: "var(--space-8)",
              }}>
                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                  color: INK_MUTE, letterSpacing: "0.15em", marginBottom: "var(--space-2)",
                }}>
                  EDITOR&apos;S NOTE
                </div>
                <p style={{ fontSize: "var(--text-base)", lineHeight: 1.9, color: INK_SOFT, margin: 0 }}>
                  {article.editor_note}
                </p>
              </div>
            )}

            {article.chapters && <ChaptersSection chapters={article.chapters} />}

            {article.subjects && <ContributorsSection subjects={article.subjects} />}

            {article.editor_outro && (
              <div style={{
                marginTop: 48, padding: "var(--space-6)",
                background: "var(--bg-tint)", borderRadius: 12,
              }}>
                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                  color: INK_MUTE, letterSpacing: "0.15em", marginBottom: "var(--space-2)",
                }}>
                  EDITOR&apos;S OUTRO
                </div>
                <p style={{ fontSize: "var(--text-base)", lineHeight: 1.9, color: INK_SOFT, margin: 0 }}>
                  {article.editor_outro}
                </p>
              </div>
            )}
          </>
        )}
      </article>

      {/* Related section */}
      <div style={{
        background: "var(--bg-tint)",
        padding: "56px var(--space-6) 72px",
        borderTop: `1px solid ${LINE}`,
        marginTop: 48,
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <RelatedArticles articles={relatedArticles} />
        </div>
      </div>

      <style>{`
        .related-article-hover:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 8px 20px rgba(15,23,42,0.06) !important;
          transform: translateY(-2px) !important;
        }
      `}</style>
    </>
  );
}
