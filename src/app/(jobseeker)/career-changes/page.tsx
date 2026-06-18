import Link from "next/link";
import { STORIES } from "./mockData";

export const metadata = {
  title: "転職体験談 | OPINIO",
  description: "IT/SaaS業界への転職体験談。リクルート→Salesforce、コンサル→スタートアップなど、実際のキャリアチェンジストーリーをプロのアドバイザーが解説。",
};

const ROLE_FILTERS = ["すべて", "営業", "マーケティング", "CS", "PM・プロダクト", "テクニカル", "事業開発"];

export default function CareerChangesPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
        padding: "52px 24px 44px",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.12)", borderRadius: 100,
            padding: "4px 12px", marginBottom: 16,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)", letterSpacing: "0.08em" }}>
              CAREER CHANGE STORIES
            </span>
          </div>
          <h1 style={{
            fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800,
            color: "#fff", fontFamily: "var(--font-noto-serif)",
            lineHeight: 1.4, marginBottom: 12,
          }}>
            転職体験談
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.8, maxWidth: 560 }}>
            IT/SaaS業界への転職を経験した方々のリアルなストーリー。
            転職のきっかけ・選考プロセス・入社後のギャップまで、OPINIOのアドバイザーが詳しく解説します。
          </p>

          {/* Stats */}
          <div style={{ display: "flex", gap: 28, marginTop: 28, flexWrap: "wrap" }}>
            {[
              { num: `${STORIES.length}件`, label: "掲載体験談" },
              { num: "6社", label: "転職前企業カバー" },
              { num: "外資〜スタートアップ", label: "転職先ジャンル" },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif" }}>{s.num}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        background: "#fff", borderBottom: "1px solid var(--line)",
        padding: "0 24px", position: "sticky", top: 0, zIndex: 20,
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: 4, overflowX: "auto", padding: "12px 0" }}>
          {ROLE_FILTERS.map((f, i) => (
            <button key={f} style={{
              padding: "6px 14px", borderRadius: 100, border: "1.5px solid",
              borderColor: i === 0 ? "var(--royal)" : "var(--line)",
              background: i === 0 ? "var(--royal)" : "#fff",
              color: i === 0 ? "#fff" : "var(--ink-soft)",
              fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.12s",
            }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Stories list */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px" }}>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20 }}>
          {STORIES.length}件の体験談
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {STORIES.map((story) => (
            <Link
              key={story.slug}
              href={`/career-changes/${story.slug}`}
              style={{ textDecoration: "none" }}
            >
              <article style={{
                background: "#fff", borderRadius: 14,
                border: "1px solid var(--line)",
                padding: "20px 22px",
                transition: "box-shadow 0.15s, transform 0.15s",
                cursor: "pointer",
              }}
              className="career-story-card"
              >
                {/* From → To */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
                  flexWrap: "wrap",
                }}>
                  <CompanyBadge name={story.fromCompany} industry={story.fromIndustry} variant="from" />
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                  <CompanyBadge name={story.toCompany} industry={story.toIndustry} variant="to" />

                  {/* Salary change */}
                  <span style={{
                    marginLeft: "auto", fontSize: 12, fontWeight: 700, flexShrink: 0,
                    color: story.salaryChange.startsWith("+") ? "var(--success)" : "var(--ink-soft)",
                    background: story.salaryChange.startsWith("+") ? "var(--success-soft)" : "var(--bg-tint)",
                    borderRadius: 100, padding: "3px 10px",
                    fontFamily: "Inter, sans-serif",
                  }}>
                    {story.salaryChange}
                  </span>
                </div>

                {/* Headline */}
                <h2 style={{
                  fontSize: 15, fontWeight: 700, color: "var(--ink)",
                  lineHeight: 1.5, marginBottom: 8,
                  fontFamily: "var(--font-noto-serif)",
                }}>
                  {story.headline}
                </h2>

                {/* Excerpt */}
                <p style={{
                  fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7,
                  marginBottom: 14,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {story.excerpt}
                </p>

                {/* Footer: tags + author */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {story.tags.slice(0, 3).map((tag) => (
                      <span key={tag} style={{
                        fontSize: 10, fontWeight: 600, color: "var(--ink-mute)",
                        background: "var(--bg-tint)", border: "1px solid var(--line)",
                        borderRadius: 100, padding: "2px 8px",
                      }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--royal), var(--accent))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, color: "#fff",
                    }}>
                      {story.authorName.charAt(0)}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{story.authorName}</span>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div style={{
          marginTop: 48, padding: "32px 28px",
          background: "linear-gradient(135deg, var(--royal-50), #ece8ff)",
          borderRadius: 16, textAlign: "center",
          border: "1px solid var(--royal-100)",
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)", marginBottom: 8 }}>
            自分の転職体験談は？
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 20 }}>
            IT/SaaS業界への転職を経験した方、あなたのストーリーをOPINIOで共有しませんか。
            アドバイザーがインタビューしてまとめます。
          </p>
          <Link href="/career-consultation" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "10px 24px", background: "var(--royal)", color: "#fff",
            borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none",
          }}>
            アドバイザーに相談する
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </div>

      <style>{`
        .career-story-card:hover {
          box-shadow: 0 4px 20px rgba(0,35,102,0.1);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}

function CompanyBadge({
  name,
  industry,
  variant,
}: {
  name: string;
  industry: string;
  variant: "from" | "to";
}) {
  const short = name.replace(/^(株式会社|合同会社|有限会社)/, "").replace(/(株式会社|合同会社|合同会社)$/, "");
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      padding: "5px 10px", borderRadius: 8,
      background: variant === "to" ? "var(--royal-50)" : "var(--bg-tint)",
      border: `1px solid ${variant === "to" ? "var(--royal-100)" : "var(--line)"}`,
    }}>
      <span style={{
        fontSize: 12, fontWeight: 700,
        color: variant === "to" ? "var(--royal)" : "var(--ink)",
        whiteSpace: "nowrap",
      }}>
        {short}
      </span>
      <span style={{ fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
        {industry}
      </span>
    </div>
  );
}
