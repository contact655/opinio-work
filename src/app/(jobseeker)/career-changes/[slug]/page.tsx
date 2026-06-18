import Link from "next/link";
import { notFound } from "next/navigation";
import { STORIES, getStoryBySlug } from "../mockData";

export function generateStaticParams() {
  return STORIES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const story = getStoryBySlug(params.slug);
  if (!story) return {};
  return {
    title: `${story.headline} | OPINIO転職体験談`,
    description: story.excerpt,
  };
}

const SECTIONS = [
  { key: "motivation" as const, label: "転職のきっかけ・理由", icon: "💡", color: "var(--warm)" },
  { key: "process" as const, label: "転職活動の進め方・選考対策", icon: "📋", color: "var(--royal)" },
  { key: "reality" as const, label: "入社後のリアル・ギャップ", icon: "🔍", color: "var(--purple)" },
  { key: "advice" as const, label: "同じ転職を目指す方へのアドバイス", icon: "✉️", color: "var(--success)" },
];

export default function CareerChangeDetailPage({ params }: { params: { slug: string } }) {
  const story = getStoryBySlug(params.slug);
  if (!story) notFound();

  const related = STORIES.filter((s) => s.slug !== story.slug).slice(0, 3);

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>

      {/* Breadcrumb */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "12px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-mute)" }}>
          <Link href="/" style={{ color: "var(--ink-mute)", textDecoration: "none" }}>TOP</Link>
          <span>›</span>
          <Link href="/career-changes" style={{ color: "var(--ink-mute)", textDecoration: "none" }}>転職体験談</Link>
          <span>›</span>
          <span style={{ color: "var(--ink-soft)" }}>{story.fromCompany.replace(/^(株式会社|合同会社)/, "")} → {story.toCompany.replace(/^(株式会社|合同会社)/, "")}</span>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 32, alignItems: "start" }}>

          {/* Main content */}
          <div>
            {/* Header */}
            <div style={{
              background: "#fff", borderRadius: 14, border: "1px solid var(--line)",
              padding: "28px 28px 24px", marginBottom: 24,
            }}>
              {/* From → To */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                <CompanyBlock
                  name={story.fromCompany}
                  industry={story.fromIndustry}
                  label="転職前"
                  variant="from"
                />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: story.salaryChange.startsWith("+") ? "var(--success)" : "var(--ink-soft)",
                    background: story.salaryChange.startsWith("+") ? "var(--success-soft)" : "var(--bg-tint)",
                    borderRadius: 100, padding: "2px 10px",
                    fontFamily: "Inter, sans-serif",
                  }}>
                    {story.salaryChange}
                  </span>
                </div>
                <CompanyBlock
                  name={story.toCompany}
                  industry={story.toIndustry}
                  label={`転職後（${story.role}）`}
                  variant="to"
                />
              </div>

              {/* Meta chips */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                <MetaChip label={`社会人${story.yearsAtFrom}年目で転職`} />
                <MetaChip label={`${story.ageAtChange}歳`} />
                <MetaChip label={story.roleCategory} highlight />
              </div>

              {/* Headline */}
              <h1 style={{
                fontSize: "clamp(17px, 3vw, 22px)", fontWeight: 800,
                color: "var(--ink)", lineHeight: 1.5,
                fontFamily: "var(--font-noto-serif)", marginBottom: 14,
              }}>
                {story.headline}
              </h1>

              {/* Excerpt */}
              <p style={{
                fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.85,
                padding: "14px 16px",
                background: "var(--royal-50)", borderRadius: 8,
                borderLeft: "3px solid var(--royal)",
              }}>
                {story.excerpt}
              </p>

              {/* Tags */}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 16 }}>
                {story.tags.map((tag) => (
                  <span key={tag} style={{
                    fontSize: 11, fontWeight: 600, color: "var(--ink-mute)",
                    background: "var(--bg-tint)", border: "1px solid var(--line)",
                    borderRadius: 100, padding: "3px 10px",
                  }}>
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Sections */}
            {SECTIONS.map((section) => (
              <div key={section.key} style={{
                background: "#fff", borderRadius: 14,
                border: "1px solid var(--line)",
                padding: "24px 28px", marginBottom: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: `${section.color}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {section.icon}
                  </div>
                  <h2 style={{
                    fontSize: 15, fontWeight: 800, color: "var(--ink)",
                    borderLeft: `3px solid ${section.color}`,
                    paddingLeft: 10,
                  }}>
                    {section.label}
                  </h2>
                </div>
                <div style={{
                  fontSize: 14, color: "var(--ink)", lineHeight: 2,
                  whiteSpace: "pre-wrap",
                }}>
                  {story[section.key]}
                </div>
              </div>
            ))}

            {/* Author note */}
            <div style={{
              background: "var(--bg-tint)", borderRadius: 12,
              border: "1px solid var(--line)", padding: "18px 20px",
              display: "flex", gap: 14, alignItems: "flex-start",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "linear-gradient(135deg, var(--royal), var(--accent))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 700, color: "#fff",
                flexShrink: 0,
              }}>
                {story.authorName.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
                  {story.authorName}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 6 }}>
                  {story.authorTitle}
                </div>
                <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                  この体験談はOPINIOキャリアアドバイザーによるインタビューをもとに作成されました。
                  転職に関するご相談は、下記からお気軽にどうぞ。
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ position: "sticky", top: 80 }}>
            {/* CTA */}
            <div style={{
              background: "linear-gradient(155deg, #001233 0%, #002366 100%)",
              borderRadius: 14, padding: "24px 20px", marginBottom: 16,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 8, letterSpacing: "0.06em" }}>
                この転職パスに興味がある方へ
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.6, marginBottom: 6 }}>
                {story.fromCompany.replace(/^(株式会社|合同会社)/, "")} →{" "}
                {story.toCompany.replace(/^(株式会社|合同会社|合同会社)/, "")} の転職について相談する
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 20, lineHeight: 1.6 }}>
                アドバイザーが個別に詳しくお話しします。完全無料・30分〜。
              </p>
              <Link
                href={`/career-consultation/apply?consultant=${story.authorSlug}`}
                style={{
                  display: "block", padding: "12px 16px",
                  background: "var(--warm)", color: "#fff",
                  borderRadius: 8, fontSize: 13, fontWeight: 700,
                  textDecoration: "none", textAlign: "center",
                  marginBottom: 10,
                }}
              >
                無料で相談する →
              </Link>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                ✓ 登録不要 &nbsp;✓ 無料 &nbsp;✓ 3営業日以内に返信
              </p>
            </div>

            {/* Story summary */}
            <div style={{
              background: "#fff", borderRadius: 12,
              border: "1px solid var(--line)", padding: "16px 16px",
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.08em", marginBottom: 12 }}>
                この体験談のポイント
              </div>
              {[
                { label: "転職前", value: story.fromCompany.replace(/^(株式会社|合同会社)/, "") },
                { label: "転職後", value: story.toCompany.replace(/^(株式会社|合同会社)/, "") },
                { label: "ポジション", value: story.role },
                { label: "転職時の年齢", value: `${story.ageAtChange}歳` },
                { label: "在籍年数", value: `${story.yearsAtFrom}年` },
                { label: "年収変化", value: story.salaryChange },
              ].map((item) => (
                <div key={item.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                  padding: "7px 0", borderBottom: "1px solid var(--line-soft)",
                  gap: 8,
                }}>
                  <span style={{ fontSize: 11, color: "var(--ink-mute)", flexShrink: 0 }}>{item.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", textAlign: "right" }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Related */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--line)", padding: "16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.08em", marginBottom: 12 }}>
                他の体験談
              </div>
              {related.map((s) => (
                <Link key={s.slug} href={`/career-changes/${s.slug}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    padding: "9px 0", borderBottom: "1px solid var(--line-soft)",
                    cursor: "pointer",
                  }}>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 3 }}>
                      {s.fromCompany.replace(/^(株式会社|合同会社)/, "")} → {s.toCompany.replace(/^(株式会社|合同会社)/, "")}
                    </div>
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: "var(--ink)", lineHeight: 1.4,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {s.headline}
                    </div>
                  </div>
                </Link>
              ))}
              <Link href="/career-changes" style={{
                display: "block", textAlign: "center", marginTop: 12,
                fontSize: 11, fontWeight: 700, color: "var(--royal)", textDecoration: "none",
              }}>
                すべての体験談を見る →
              </Link>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .career-detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function CompanyBlock({
  name,
  industry,
  label,
  variant,
}: {
  name: string;
  industry: string;
  label: string;
  variant: "from" | "to";
}) {
  const short = name.replace(/^(株式会社|合同会社|有限会社)/, "");
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 4,
      padding: "10px 14px", borderRadius: 10, minWidth: 120,
      background: variant === "to" ? "var(--royal-50)" : "var(--bg-tint)",
      border: `1.5px solid ${variant === "to" ? "var(--royal-100)" : "var(--line)"}`,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: variant === "to" ? "var(--royal)" : "var(--ink-mute)", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 800, color: variant === "to" ? "var(--royal)" : "var(--ink)", lineHeight: 1.3 }}>
        {short}
      </span>
      <span style={{ fontSize: 10, color: "var(--ink-mute)" }}>{industry}</span>
    </div>
  );
}

function MetaChip({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      color: highlight ? "var(--royal)" : "var(--ink-soft)",
      background: highlight ? "var(--royal-50)" : "var(--bg-tint)",
      border: `1px solid ${highlight ? "var(--royal-100)" : "var(--line)"}`,
      borderRadius: 100, padding: "3px 10px",
    }}>
      {label}
    </span>
  );
}
