import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMentorById, type MentorData } from "@/lib/supabase/queries";
import { FloatingCTA } from "@/components/jobseeker/FloatingCTA";
import { ReadingProgress } from "@/components/jobseeker/ReadingProgress";
import { createClient } from "@/lib/supabase/server";
import MergedTimeline from "@/components/profile/MergedTimeline";
import {
  buildTimelineCareerEntriesFromRaw,
  type RawExperienceRow,
  type CompanyLogoInfo,
} from "@/lib/utils/timeline";
import { BookmarkButton } from "@/components/jobseeker/BookmarkButton";

// 5分間ページキャッシュ（ISR）
export const revalidate = 300;

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const mentor = await getMentorById(params.id);
  if (!mentor) return { title: "メンターが見つかりません — OPINIO" };
  const ogImageUrl = `/api/og?type=default&name=${encodeURIComponent(mentor.name + "さん")}&sub=${encodeURIComponent(mentor.current_company || "IT/SaaS業界")}&badge=${encodeURIComponent("先輩メンター")}`;
  return {
    title: `${mentor.name}さんに相談する — OPINIO`,
    description: mentor.catchphrase || mentor.bio.slice(0, 120),
    openGraph: {
      title: `${mentor.name}さんに相談する | OPINIO`,
      description: mentor.catchphrase || mentor.bio.slice(0, 120),
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: [ogImageUrl] },
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

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: "#fff",
      borderRadius: 16, padding: "24px 28px", marginBottom: 16,
      boxShadow: "0 1px 3px rgba(15,23,42,0.05), 0 4px 14px rgba(15,23,42,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--line-soft,#F1F5F9)" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{title}</h2>
        {sub && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{sub}</span>}
      </div>
      {children}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MentorDetailPage({ params }: Props) {
  const mentor = await getMentorById(params.id);
  if (!mentor) notFound();

  // ─── 経歴タイムライン取得（mentor.user_id で ow_experiences を引く） ────────
  const supabase = createClient();

  // Auth + bookmark state
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;
  let initialBookmarked = false;
  if (user) {
    const { data: owUser } = await supabase
      .from("ow_users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();
    if (owUser) {
      const { data: bmark } = await supabase
        .from("ow_bookmarks")
        .select("id")
        .eq("user_id", owUser.id)
        .eq("target_type", "mentor")
        .eq("target_id", mentor.id)
        .maybeSingle();
      initialBookmarked = !!bmark;
    }
  }
  const timelineCareers = await (async () => {
    if (!mentor.user_id) return [];

    const [
      { data: expRows },
      { data: allRoles },
    ] = await Promise.all([
      supabase
        .from("ow_experiences")
        .select("id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, description")
        .eq("user_id", mentor.user_id)
        .order("is_current", { ascending: false })
        .order("started_at", { ascending: false }),
      supabase.from("ow_roles").select("id, name"),
    ]);

    const roleNameById = new Map<string, string>();
    for (const role of allRoles ?? []) {
      roleNameById.set(role.id as string, role.name as string);
    }

    // master 企業のロゴ情報を一括解決
    const expCompanyIds = (expRows ?? [])
      .filter((r) => r.company_id)
      .map((r) => r.company_id as string);

    const companyInfoById = new Map<string, CompanyLogoInfo>();
    if (expCompanyIds.length > 0) {
      const { data: expCompanies } = await supabase
        .from("ow_companies")
        .select("id, name, logo_url, logo_letter, logo_gradient")
        .in("id", expCompanyIds);
      for (const c of expCompanies ?? []) {
        companyInfoById.set(c.id as string, {
          name: c.name as string,
          logoUrl: (c.logo_url as string | null) ?? null,
          logoLetter: (c.logo_letter as string | null) ?? null,
          logoGradient: (c.logo_gradient as string | null) ?? null,
        });
      }
    }

    return buildTimelineCareerEntriesFromRaw(
      (expRows ?? []) as RawExperienceRow[],
      roleNameById,
      companyInfoById,
    );
  })();

  return (
    <>
      <ReadingProgress />

      {/* Breadcrumb */}
      <nav aria-label="パンくずリスト" style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5 }}>
            <Link href="/" style={{ color: "var(--ink-mute)" }}>OPINIO</Link>
            <span>/</span>
            <Link href="/mentors" style={{ color: "var(--ink-mute)" }}>先輩に相談</Link>
            <span>/</span>
            <span aria-current="page" style={{ color: "var(--ink-soft)" }}>{mentor.name}</span>
          </div>
        </div>
      </nav>

      <main style={{ background: "#f0f4f8", minHeight: "calc(100vh - 120px)" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 20px 48px" }}>

          {/* ── 2カラムグリッド ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: 24,
            alignItems: "start",
          }} className="mentor-detail-grid">

            {/* ── メインカラム ── */}
            <div>
              {/* プロフィールヘッダーカード */}
              <section style={{
                background: "#fff", borderRadius: 18, padding: "28px 28px 24px",
                marginBottom: 16,
                boxShadow: "0 1px 3px rgba(15,23,42,0.05), 0 6px 20px rgba(15,23,42,0.07)",
              }}>
                {/* Avatar + name */}
                <div style={{ display: "flex", gap: 18, alignItems: "flex-start", marginBottom: 20 }}>
                  <Avatar mentor={mentor} size={72} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                        {mentor.name}さん
                      </h1>
                      {mentor.is_available && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "3px 10px", borderRadius: 100,
                          background: "var(--success-soft)", color: "var(--success)",
                          fontSize: 10.5, fontWeight: 700, border: "1px solid #A7F3D0",
                        }}>
                          <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
                          相談受付中
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                      <strong style={{ color: "var(--ink)" }}>{mentor.current_company || "（非公開）"}</strong>
                      {mentor.current_role && ` · ${mentor.current_role}`}
                    </div>
                    {(mentor.success_count ?? 0) > 0 && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, padding: "3px 8px", borderRadius: 6, background: "var(--success-soft)", border: "1px solid #A7F3D0" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--success)" }}>相談実績 <span style={{ fontFamily: "Inter" }}>{mentor.success_count}</span>件</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Career chain */}
                {mentor.career_chain.length > 0 && (
                  <div style={{
                    display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6,
                    padding: "10px 14px",
                    background: "var(--bg-tint)", borderRadius: 10,
                    fontSize: 12.5, color: "var(--ink-mute)",
                    marginBottom: 20,
                  }}>
                    {mentor.career_chain.map((step, i) => (
                      <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {i > 0 && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5}><path d="M9 18l6-6-6-6" /></svg>}
                        <span style={{ color: step.is_current ? "var(--royal)" : "var(--ink-soft)", fontWeight: step.is_current ? 700 : 400 }}>{step.label}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Catchphrase */}
                {mentor.catchphrase && (
                  <p style={{
                    fontSize: 16, fontWeight: 700, color: "var(--ink)",
                    lineHeight: 1.65, marginBottom: 18,
                    borderLeft: "3px solid var(--royal)",
                    paddingLeft: 14,
                  }}>
                    {mentor.catchphrase}
                  </p>
                )}

                {/* Theme tags */}
                {mentor.themes.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {mentor.themes.map((theme) => (
                      <span key={theme} style={{
                        fontSize: 12, padding: "5px 13px", borderRadius: 100,
                        background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                        color: "var(--royal)", fontWeight: 600,
                      }}>
                        {theme}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* Bio */}
              {mentor.bio && (
                <Section title="プロフィール">
                  <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, whiteSpace: "pre-wrap", margin: 0 }}>
                    {mentor.bio}
                  </p>
                </Section>
              )}

              {/* 経歴タイムライン */}
              {timelineCareers.length > 0 && (
                <section style={{
                  background: "#fff", borderRadius: 16, padding: "24px 28px", marginBottom: 16,
                  boxShadow: "0 1px 3px rgba(15,23,42,0.05), 0 4px 14px rgba(15,23,42,0.06)",
                }}>
                  <div style={{
                    display: "flex", alignItems: "baseline", gap: 8, marginBottom: 20,
                    paddingBottom: 12, borderBottom: "1px solid var(--line-soft,#F1F5F9)",
                  }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>経歴</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>TIMELINE</span>
                  </div>
                  <MergedTimeline careers={timelineCareers} educations={[]} future={null} viewerIsOwner={false} />
                </section>
              )}

              {/* Concerns FAQ */}
              {mentor.concerns.length > 0 && (
                <Section title="こんな悩みに答えられます">
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
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
                        }}>Q</span>
                        {concern}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Back link */}
              <div style={{ marginTop: 8, paddingLeft: 4 }}>
                <Link href="/mentors" style={{ fontSize: 13, color: "var(--ink-mute)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M15 18l-6-6 6-6" /></svg>
                  メンター一覧に戻る
                </Link>
              </div>
            </div>

            {/* ── サイドバー ── */}
            <div style={{ position: "sticky", top: 80 }}>

              {/* CTA カード */}
              <div style={{
                background: "#fff", borderRadius: 18, padding: "24px 22px",
                marginBottom: 16,
                boxShadow: "0 1px 3px rgba(15,23,42,0.05), 0 6px 20px rgba(15,23,42,0.07)",
              }}>
                {/* 無料バッジ */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 18, justifyContent: "center" }}>
                  {([
                    { icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>, label: "完全無料" },
                    { icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, label: "30分" },
                    { icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, label: "オンライン" },
                    { icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, label: "営業なし" },
                  ] as { icon: React.ReactNode; label: string }[]).map(({ icon, label }) => (
                    <span key={label} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "4px 9px", borderRadius: 100,
                      background: "#F0FDF4", border: "1px solid #BBF7D0",
                      fontSize: 10.5, fontWeight: 700, color: "#15803D", whiteSpace: "nowrap",
                    }}>{icon} {label}</span>
                  ))}
                </div>

                {/* CTA ボタン */}
                <Link
                  href={`/mentors/${mentor.id}/reserve`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    width: "100%", padding: "16px 14px",
                    background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                    color: "#fff", border: "none", borderRadius: 12, textDecoration: "none",
                    fontSize: 16, fontWeight: 800,
                    boxShadow: "0 6px 20px rgba(245,158,11,0.4)",
                    transition: "opacity 0.2s, transform 0.15s",
                    letterSpacing: "-0.01em", marginBottom: 8,
                  }}
                  className="mentor-detail-cta"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  無料で30分 話してみる
                </Link>
                <p style={{ textAlign: "center", fontSize: 11, color: "var(--ink-mute)", marginBottom: 14, lineHeight: 1.5 }}>
                  編集部が確認後、{mentor.name}さんに転送します
                </p>

                {/* Bookmark + Profile */}
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <BookmarkButton
                      targetType="mentor"
                      targetId={mentor.id}
                      label="気になるに追加"
                      initialBookmarked={initialBookmarked}
                      isAuthenticated={isAuthenticated}
                      variant="with-text"
                    />
                  </div>
                  {mentor.user_id && (
                    <Link
                      href={`/u/${mentor.user_id}`}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "10px 12px", borderRadius: 8, textDecoration: "none",
                        background: "var(--royal-50)", color: "var(--royal)",
                        border: "1px solid var(--royal-100)",
                        fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                      公開ページ
                    </Link>
                  )}
                </div>
              </div>

              {/* 相談の進め方カード */}
              <div style={{
                background: "#fff", borderRadius: 18, padding: "22px 20px",
                boxShadow: "0 1px 3px rgba(15,23,42,0.05), 0 4px 14px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 18, paddingBottom: 12, borderBottom: "1px solid var(--line-soft,#F1F5F9)" }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: 0 }}>相談の進め方</h2>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>HOW IT WORKS</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[
                    { step: "01", label: "相談内容を送る", desc: "フォームに相談したいことを入力（3分で完了）" },
                    { step: "02", label: "編集部が確認", desc: "OPINIOがメンターに適切か確認します" },
                    { step: "03", label: "メンターが承認", desc: "承認されると通知が届きます" },
                    { step: "04", label: "日程を調整", desc: "チャットで日時を確定します" },
                    { step: "05", label: "30分のオンライン対話", desc: "Zoom/Teamsでフランクに話します" },
                  ].map(({ step, label, desc }, i, arr) => (
                    <div key={step} style={{ display: "flex", gap: 12, paddingBottom: i < arr.length - 1 ? 14 : 0 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                          background: i === arr.length - 1 ? "var(--success)" : "var(--royal)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 9, fontWeight: 800, fontFamily: "Inter, sans-serif",
                        }}>{step}</div>
                        {i < arr.length - 1 && <div style={{ width: 2, flex: 1, background: "var(--line)", marginTop: 3 }} />}
                      </div>
                      <div style={{ paddingTop: 2, paddingBottom: i < arr.length - 1 ? 4 : 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.55 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .mentor-detail-cta:hover { opacity: 0.88; }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
        .pulse-dot { animation: pulseDot 1.8s ease-in-out infinite; }
        @media (max-width: 768px) {
          .mentor-detail-grid {
            grid-template-columns: 1fr !important;
          }
          .mentor-detail-grid > div:last-child {
            position: static !important;
            order: -1;
          }
        }
      `}</style>
      <FloatingCTA href={`/mentors/${mentor.id}/reserve`} label={`${mentor.name}さんに相談する`} subLabel="完全無料 · 編集部が事前確認" />
    </>
  );
}
