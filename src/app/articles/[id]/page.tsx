import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/common";
import { Footer } from "@/components/common";
import {
  MOCK_ARTICLES,
  getArticleBySlug,
  TYPE_BADGE,
  TYPE_EYECATCH_ICON,
  type Article,
  type ArticleSubject,
  type QA,
  type ThemeItem,
  type Chapter,
} from "../mockArticleData";
import { getJobById } from "@/app/jobs/mockJobData";
import { MOCK_COMPANIES } from "@/app/companies/mockCompanies";

// ─── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const article = getArticleBySlug(params.id);
  if (!article) return { title: "記事 — Opinio" };
  return {
    title: `${article.title} — Opinio`,
    description: article.subtitle,
  };
}

export function generateStaticParams() {
  return MOCK_ARTICLES.map((a) => ({ id: a.slug }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ROYAL = "#002366";
const LINE  = "#E2E8F0";
const INK   = "#0F172A";
const INK_SOFT = "#475569";
const INK_MUTE = "#94A3B8";

function SubjectCard({ subject }: { subject: ArticleSubject }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "60px 1fr",
      gap: 16,
      padding: "20px 22px",
      background: "var(--bg-tint)",
      border: `1px solid ${LINE}`,
      borderRadius: 14,
      marginBottom: 32,
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: "50%",
        background: subject.gradient,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: 20, fontWeight: 700,
        boxShadow: `0 0 0 2.5px ${ROYAL}, 0 0 0 5px rgba(0,35,102,0.1)`,
        flexShrink: 0,
      }}>
        {subject.initial}
      </div>

      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>
            {subject.name}
          </span>
          {subject.is_mentor && subject.mentor_id && (
            <Link
              href={`/mentors/${subject.mentor_id}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 9px", borderRadius: 100,
                background: "#FEF3C7", color: "#B45309",
                fontSize: 10, fontWeight: 700,
                border: "1px solid #FDE68A", textDecoration: "none",
              }}
            >
              ★ メンター登録済み
            </Link>
          )}
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
          <div style={{ display: "flex", gap: 14, alignItems: "baseline", marginBottom: 16 }}>
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700,
              color: ROYAL, letterSpacing: "0.1em", flexShrink: 0, paddingTop: 4,
            }}>
              Q.{String(idx + 1).padStart(2, "0")}
            </span>
            <p style={{
              fontFamily: '"Noto Serif JP", serif',
              fontSize: 17, fontWeight: 600, color: INK,
              lineHeight: 1.6, margin: 0,
            }}>
              {item.q}
            </p>
          </div>
          {/* A */}
          <div style={{ paddingLeft: 36 }}>
            {item.a.map((para, pi) => (
              <p key={pi} style={{
                fontSize: 16, lineHeight: 2, color: INK,
                marginBottom: pi < item.a.length - 1 ? 16 : 0,
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

function ThemesSection({ themes }: { themes: ThemeItem[] }) {
  return (
    <div style={{
      marginTop: 48,
      padding: 32,
      background: "linear-gradient(135deg, #FEF3C7 0%, #fff 100%)",
      border: "1px solid #FDE68A",
      borderRadius: 16,
    }}>
      <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{
          fontFamily: '"Noto Serif JP", serif',
          fontWeight: 700, fontSize: 20, color: INK, margin: 0,
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
      <p style={{ fontSize: 13, color: INK_SOFT, lineHeight: 1.8, marginBottom: 24 }}>
        このメンターが特に得意とするテーマです。相談時の参考にしてください。
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {themes.map((theme) => (
          <div key={theme.title} style={{
            display: "grid", gridTemplateColumns: "32px 1fr", gap: 12,
            padding: 14, background: "#fff",
            border: `1px solid ${LINE}`, borderRadius: 10,
            alignItems: "flex-start",
          }}>
            <div style={{
              width: 32, height: 32, background: "#FEF3C7", color: "#B45309",
              borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0,
            }}>
              {theme.icon}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 4, lineHeight: 1.5 }}>
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

function MentorCTA({ subject }: { subject: ArticleSubject }) {
  return (
    <div style={{
      marginTop: 56,
      background: `linear-gradient(135deg, ${ROYAL} 0%, #3B5FD9 100%)`,
      color: "#fff",
      padding: "36px 32px",
      borderRadius: 20,
      textAlign: "center",
      boxShadow: "0 20px 48px rgba(0,35,102,0.25)",
    }}>
      <div style={{
        fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700,
        letterSpacing: "0.2em", opacity: 0.9, marginBottom: 10,
      }}>
        TALK TO MENTOR
      </div>
      <h3 style={{
        fontFamily: '"Noto Serif JP", serif',
        fontSize: 22, fontWeight: 500, marginBottom: 12, lineHeight: 1.5,
      }}>
        {subject.name}さんに、話を聞く
      </h3>
      <p style={{
        fontSize: 13, lineHeight: 1.8, opacity: 0.9, marginBottom: 24,
        maxWidth: 400, margin: "0 auto 24px",
      }}>
        記事の続きを、30分の対話で。
        <br />
        キャリアの悩みを、経験者に直接相談できます。
      </p>
      {subject.mentor_id && (
        <Link
          href={`/mentors/${subject.mentor_id}/reserve`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "13px 28px", background: "#fff", color: ROYAL,
            border: "none", borderRadius: 10,
            fontSize: 14, fontWeight: 700, textDecoration: "none",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          話を聞く（30分・無料）
        </Link>
      )}
    </div>
  );
}

function CompanyCTA({ article }: { article: Article }) {
  return (
    <div style={{
      marginTop: 48,
      background: `linear-gradient(135deg, ${ROYAL} 0%, #3B5FD9 100%)`,
      color: "#fff",
      padding: "32px 28px",
      borderRadius: 20,
      textAlign: "center",
      boxShadow: "0 20px 48px rgba(0,35,102,0.22)",
    }}>
      <div style={{ marginBottom: 8, opacity: 0.9, fontSize: 13 }}>
        この企業について、もっと知る
      </div>
      <h3 style={{
        fontFamily: '"Noto Serif JP", serif',
        fontSize: 20, fontWeight: 500, marginBottom: 20, lineHeight: 1.5,
      }}>
        {article.company_name}で、働く。
      </h3>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          href={`/jobs?company=${article.company_id}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px 22px", background: "#fff", color: ROYAL,
            borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: "none",
          }}
        >
          求人を見る
        </Link>
        <Link
          href={`/companies/${article.company_id}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px 22px", background: "transparent", color: "#fff",
            border: "2px solid rgba(255,255,255,0.5)",
            borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: "none",
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
            fontFamily: '"Noto Serif JP", serif',
            fontWeight: 700, fontSize: 22, lineHeight: 1.55,
            color: INK, marginBottom: 24,
            display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap",
          }}>
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 700,
              color: "#7C3AED", letterSpacing: "0.1em",
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
              fontSize: 16, lineHeight: 2, color: INK,
              marginBottom: i < ch.body.length - 1 ? 16 : 0,
            }}>
              {para}
            </p>
          ))}

          {ch.list && (
            <ul style={{
              listStyle: "none", padding: "16px 20px",
              background: "var(--bg-tint)", borderRadius: 10, margin: "20px 0",
            }}>
              {ch.list.map((item, i) => (
                <li key={i} style={{
                  padding: "8px 0",
                  borderBottom: i < ch.list!.length - 1 ? "1px dashed var(--line)" : "none",
                  fontSize: 14, lineHeight: 1.8,
                  display: "flex", gap: 12,
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
      padding: "28px 30px",
      background: "linear-gradient(135deg, #F3E8FF 0%, #fff 100%)",
      border: "1px solid #E9D5FF",
      borderRadius: 16,
    }}>
      <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{
          fontFamily: '"Noto Serif JP", serif',
          fontWeight: 700, fontSize: 18, color: INK, margin: 0,
        }}>
          取材協力
        </h3>
        <span style={{
          fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
          color: "#7C3AED", letterSpacing: "0.2em", textTransform: "uppercase",
        }}>
          CONTRIBUTORS
        </span>
      </div>
      <p style={{ fontSize: 13, color: INK_SOFT, lineHeight: 1.8, marginBottom: 20 }}>
        今回の取材にご協力いただいた方々です。
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {subjects.map((s) => (
          <div key={s.name} style={{
            display: "grid", gridTemplateColumns: "44px 1fr",
            gap: 12, alignItems: "center",
            padding: "12px 14px", background: "#fff",
            border: `1px solid ${LINE}`, borderRadius: 10,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: s.gradient, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 600, fontSize: 16, flexShrink: 0,
            }}>
              {s.initial}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 2 }}>
                {s.name}
                {s.is_mentor && (
                  <span style={{
                    marginLeft: 6, fontSize: 9, padding: "1px 6px",
                    background: "#FEF3C7", color: "#B45309",
                    borderRadius: 100, border: "1px solid #FDE68A",
                    fontWeight: 700,
                  }}>
                    メンター
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: INK_SOFT }}>{s.current_status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RelatedArticles({ slugs }: { slugs: string[] }) {
  const related = slugs
    .map((s) => getArticleBySlug(s))
    .filter((a): a is Article => a !== undefined)
    .slice(0, 4);

  if (related.length === 0) return null;

  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 20, paddingBottom: 10,
        borderBottom: `2px solid ${INK}`,
      }}>
        <h3 style={{
          fontFamily: '"Noto Serif JP", serif',
          fontWeight: 700, fontSize: 20, color: INK,
          display: "flex", alignItems: "baseline", gap: 12, margin: 0,
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {related.map((a) => {
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
                <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "2px 8px", borderRadius: 100,
                    background: badge.bg, color: badge.color,
                    fontSize: 9.5, fontWeight: 700, marginBottom: 6, alignSelf: "flex-start",
                  }}>
                    {badge.label}
                  </div>
                  <p style={{
                    fontFamily: '"Noto Serif JP", serif',
                    fontSize: 12, fontWeight: 600, lineHeight: 1.6,
                    color: INK, marginBottom: 8,
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

function RelatedJobs({ jobIds }: { jobIds: string[] }) {
  const jobs = jobIds
    .map((id) => getJobById(id))
    .filter(Boolean)
    .slice(0, 4) as ReturnType<typeof getJobById>[];

  if (!jobs.length) return null;

  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 20, paddingBottom: 10,
        borderBottom: `2px solid ${INK}`,
      }}>
        <h3 style={{
          fontFamily: '"Noto Serif JP", serif',
          fontWeight: 700, fontSize: 20, color: INK,
          display: "flex", alignItems: "baseline", gap: 12, margin: 0,
        }}>
          関連求人
          <span style={{
            fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
            color: INK_MUTE, letterSpacing: "0.2em", textTransform: "uppercase",
          }}>
            RELATED JOBS
          </span>
        </h3>
        <Link href="/jobs" style={{ color: ROYAL, fontSize: 12, fontWeight: 600 }}>
          すべての求人 →
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {jobs.map((job) => job && (
          <Link key={job.id} href={`/jobs/${job.id}`} style={{ textDecoration: "none" }}>
            <div style={{
              background: "#fff", border: `1px solid ${LINE}`,
              borderRadius: 12, padding: 18, transition: "all 0.2s",
            }}
              className="related-job-hover"
            >
                      {(() => {
                const company = MOCK_COMPANIES.find((c) => c.id === job!.company_id);
                return (
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: company?.gradient ?? "#002366",
                      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, flexShrink: 0,
                    }}>
                      {(company?.name ?? "").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 2, lineHeight: 1.4 }}>
                        {job!.role}
                      </div>
                      <div style={{ fontSize: 11, color: INK_SOFT }}>{company?.name}</div>
                    </div>
                  </div>
                );
              })()}
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700, color: ROYAL,
              }}>
                {job!.salary_min}〜{job!.salary_max}万円
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArticlePage({ params }: { params: { id: string } }) {
  const article = getArticleBySlug(params.id);
  if (!article) notFound();

  const badge = TYPE_BADGE[article.type];
  const icon  = TYPE_EYECATCH_ICON[article.type];
  const mainSubject = article.subject ?? article.subjects?.[0];

  return (
    <>
      <Header />

      {/* Breadcrumb */}
      <div style={{ background: "var(--bg-tint)", borderBottom: `1px solid ${LINE}`, padding: "10px 0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ fontSize: 12, color: INK_MUTE, display: "flex", alignItems: "center", gap: 5 }}>
            <Link href="/" style={{ color: INK_MUTE }}>Opinio</Link>
            <span>/</span>
            <Link href="/articles" style={{ color: INK_MUTE }}>取材記事</Link>
            <span>/</span>
            <span style={{ color: INK_SOFT }}>{badge.label}</span>
          </div>
        </div>
      </div>

      {/* Article body */}
      <article style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Hero */}
        <div style={{ marginBottom: 40 }}>
          {/* Eyecatch image */}
          <div style={{
            height: 260, background: article.eyecatch_gradient,
            borderRadius: 16, marginBottom: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <span style={{ fontSize: 80, opacity: 0.25 }}>{icon}</span>
            <div style={{
              position: "absolute", top: 16, left: 16,
              display: "inline-flex", alignItems: "center",
              padding: "4px 12px", borderRadius: 100,
              background: badge.bg, color: badge.color,
              fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
            }}>
              {badge.label}
            </div>
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: '"Noto Serif JP", serif',
            fontWeight: 700, fontSize: "clamp(24px, 3vw, 34px)",
            color: INK, lineHeight: 1.55, marginBottom: 16,
            letterSpacing: "0.02em",
          }}>
            {article.title}
          </h1>

          <p style={{
            fontFamily: '"Noto Serif JP", serif',
            fontSize: 16, color: INK_SOFT,
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
              <Link href={`/companies/${article.company_id}`} style={{
                color: INK_SOFT, fontWeight: 600, textDecoration: "none",
              }}>
                {article.company_name}
              </Link>
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
            {/* EDITOR&apos;S NOTE */}
            {article.editor_note && (
              <div style={{
                padding: "18px 22px", background: "var(--bg-tint)",
                borderLeft: `3px solid ${ROYAL}`, borderRadius: "0 10px 10px 0",
                marginBottom: 32,
              }}>
                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                  color: INK_MUTE, letterSpacing: "0.15em", marginBottom: 8,
                }}>
                  EDITOR&apos;S NOTE
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.9, color: INK_SOFT, margin: 0 }}>
                  {article.editor_note}
                </p>
              </div>
            )}

            {/* Body paragraphs */}
            {article.body?.map((para, i) => (
              <p key={i} style={{
                fontSize: 16, lineHeight: 2, color: INK,
                marginBottom: 16,
              }}>
                {para}
              </p>
            ))}

            {/* Pull quote */}
            {article.quote && (
              <blockquote style={{
                padding: "20px 0 20px 20px",
                margin: "24px 0",
                borderLeft: `3px solid ${ROYAL}`,
                fontFamily: '"Noto Serif JP", serif',
                fontSize: 17, color: INK,
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
                marginTop: 48, padding: "22px 24px",
                background: "var(--bg-tint)", borderRadius: 12,
              }}>
                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                  color: INK_MUTE, letterSpacing: "0.15em", marginBottom: 10,
                }}>
                  EDITOR&apos;S OUTRO
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.9, color: INK_SOFT, margin: 0 }}>
                  {article.editor_outro}
                </p>
              </div>
            )}

            {/* Mentor: themes + CTA */}
            {article.type === "mentor" && article.themes && (
              <ThemesSection themes={article.themes} />
            )}
            {article.type === "mentor" && mainSubject && (
              <MentorCTA subject={mainSubject} />
            )}

            {/* CEO: company CTA */}
            {article.type === "ceo" && (
              <CompanyCTA article={article} />
            )}

            {/* Employee + is_mentor: simple mentor CTA */}
            {article.type === "employee" && mainSubject?.is_mentor && (
              <MentorCTA subject={mainSubject} />
            )}
          </>
        )}

        {/* ── report body ── */}
        {article.type === "report" && (
          <>
            {article.editor_note && (
              <div style={{
                padding: "18px 22px", background: "var(--bg-tint)",
                borderLeft: `3px solid ${ROYAL}`, borderRadius: "0 10px 10px 0",
                marginBottom: 32,
              }}>
                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                  color: INK_MUTE, letterSpacing: "0.15em", marginBottom: 8,
                }}>
                  EDITOR&apos;S NOTE
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.9, color: INK_SOFT, margin: 0 }}>
                  {article.editor_note}
                </p>
              </div>
            )}

            {article.chapters && <ChaptersSection chapters={article.chapters} />}

            {article.subjects && <ContributorsSection subjects={article.subjects} />}

            {article.editor_outro && (
              <div style={{
                marginTop: 48, padding: "22px 24px",
                background: "var(--bg-tint)", borderRadius: 12,
              }}>
                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                  color: INK_MUTE, letterSpacing: "0.15em", marginBottom: 10,
                }}>
                  EDITOR&apos;S OUTRO
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.9, color: INK_SOFT, margin: 0 }}>
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
        padding: "56px 24px 72px",
        borderTop: `1px solid ${LINE}`,
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <RelatedArticles slugs={article.related_article_slugs} />
          <RelatedJobs jobIds={article.related_job_ids} />
        </div>
      </div>

      <Footer />

      <style>{`
        .related-article-hover:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 8px 20px rgba(15,23,42,0.06) !important;
          transform: translateY(-2px) !important;
        }
        .related-job-hover:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 8px 20px rgba(15,23,42,0.06) !important;
        }
      `}</style>
    </>
  );
}
