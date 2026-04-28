import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMentorById, type MentorData } from "@/lib/supabase/queries";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const mentor = await getMentorById(params.id);
  if (!mentor) return { title: "メンターが見つかりません — Opinio" };
  return {
    title: `${mentor.name}さんのプロフィール — Opinio`,
    description: mentor.catchphrase || mentor.bio.slice(0, 120),
  };
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ mentor, size = 72 }: { mentor: MentorData; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: mentor.gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.33, fontWeight: 700, flexShrink: 0,
      boxShadow: "0 0 0 3px var(--royal), 0 0 0 6px rgba(0,35,102,0.12)",
    }}>
      {mentor.initial}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: "#fff", border: "1px solid var(--line)",
      borderRadius: 16, padding: "24px 28px", marginBottom: 16,
    }}>
      <h2 style={{
        fontSize: 13, fontWeight: 700, color: "var(--ink-mute)",
        letterSpacing: "0.08em", textTransform: "uppercase",
        marginBottom: 16,
      }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MentorDetailPage({ params }: Props) {
  const mentor = await getMentorById(params.id);
  if (!mentor) notFound();

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5 }}>
            <Link href="/" style={{ color: "var(--ink-mute)" }}>Opinio</Link>
            <span>/</span>
            <Link href="/mentors" style={{ color: "var(--ink-mute)" }}>先輩に相談</Link>
            <span>/</span>
            <span style={{ color: "var(--ink-soft)" }}>{mentor.name}</span>
          </div>
        </div>
      </div>

      <main style={{ background: "var(--bg-tint)", minHeight: "calc(100vh - 120px)" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }} className="px-5 py-8 md:px-8 md:py-10">

          {/* Hero card */}
          <div style={{
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 20, padding: "32px 28px 28px",
            marginBottom: 16,
          }}>
            {/* Availability badge */}
            {mentor.is_available && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 100,
                background: "var(--success-soft)", color: "var(--success)",
                fontSize: 11.5, fontWeight: 700, marginBottom: 20,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
                相談受付中
              </div>
            )}

            {/* Avatar + name */}
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 20 }}>
              <Avatar mentor={mentor} size={72} />
              <div style={{ flex: 1 }}>
                <h1 style={{
                  fontSize: 22, fontWeight: 700, color: "var(--ink)",
                  marginBottom: 4,
                }}>
                  {mentor.name}さん
                </h1>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                  <strong style={{ color: "var(--ink)" }}>{mentor.current_company || "（非公開）"}</strong>
                  {mentor.current_role && ` · ${mentor.current_role}`}
                </div>
                {mentor.total_sessions > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-mute)" }}>
                    相談実績 <strong style={{ color: "var(--royal)" }}>{mentor.total_sessions}</strong> 件
                    {mentor.success_count > 0 && (
                      <> · 転職成功 <strong style={{ color: "var(--success)" }}>{mentor.success_count}</strong> 件</>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Career chain */}
            {mentor.career_chain.length > 0 && (
              <div style={{
                display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6,
                padding: "12px 16px",
                background: "var(--bg-tint)", borderRadius: 10,
                fontSize: 12.5, color: "var(--ink-mute)",
                marginBottom: 20,
              }}>
                {mentor.career_chain.map((step, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {i > 0 && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5}>
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    )}
                    <span style={{
                      color: step.is_current ? "var(--royal)" : "var(--ink-soft)",
                      fontWeight: step.is_current ? 700 : 400,
                    }}>
                      {step.label}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Catchphrase */}
            {mentor.catchphrase && (
              <p style={{
                fontSize: 15, fontWeight: 600, color: "var(--ink)",
                lineHeight: 1.65, marginBottom: 20,
                borderLeft: "3px solid var(--royal)",
                paddingLeft: 14,
              }}>
                {mentor.catchphrase}
              </p>
            )}

            {/* Theme tags */}
            {mentor.themes.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
                {mentor.themes.map((theme) => (
                  <span key={theme} style={{
                    fontSize: 11.5, padding: "5px 12px", borderRadius: 100,
                    background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                    color: "var(--royal)", fontWeight: 600,
                  }}>
                    {theme}
                  </span>
                ))}
              </div>
            )}

            {/* CTA */}
            <Link
              href={`/mentors/${mentor.id}/reserve`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "14px",
                background: "var(--royal)", color: "#fff",
                border: "none", borderRadius: 10, textDecoration: "none",
                fontSize: 15, fontWeight: 700,
                transition: "opacity 0.2s",
              }}
              className="mentor-detail-cta"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              相談を申し込む（無料）
            </Link>
            <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--ink-mute)", marginTop: 8 }}>
              編集部が内容を確認の上、メンターに転送します
            </p>
          </div>

          {/* Bio */}
          {mentor.bio && (
            <Section title="プロフィール">
              <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.85, whiteSpace: "pre-wrap" }}>
                {mentor.bio}
              </p>
            </Section>
          )}

          {/* Concerns FAQ */}
          {mentor.concerns.length > 0 && (
            <Section title="こんな悩みに答えられます">
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {mentor.concerns.map((concern, i) => (
                  <li key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "12px 14px",
                    background: "var(--bg-tint)", borderRadius: 8,
                    fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6,
                  }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                      color: "var(--royal)", fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, marginTop: 1,
                    }}>
                      Q
                    </span>
                    {concern}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Back link */}
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <Link href="/mentors" style={{
              fontSize: 13, color: "var(--ink-mute)",
              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M15 18l-6-6 6-6" />
              </svg>
              メンター一覧に戻る
            </Link>
          </div>
        </div>
      </main>

      <style>{`
        .mentor-detail-cta:hover { opacity: 0.88; }
      `}</style>
    </>
  );
}
