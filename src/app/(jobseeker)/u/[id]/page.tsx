import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import MergedTimeline from "@/components/profile/MergedTimeline";
import {
  buildTimelineCareerEntriesFromRaw,
  toTimelineEducationEntries,
  buildFutureData,
  type RawExperienceRow,
  type RawEducation,
  type CompanyLogoInfo,
} from "@/lib/utils/timeline";
import { getUserAge } from "@/lib/age";
import {
  SocialIcon,
  type SocialPlatform,
  SOCIAL_META,
  SNS_PLATFORMS,
} from "@/components/SocialIcon";

// ─── Types ────────────────────────────────────────────────────────────────────

/** JSONB キー名と一致（"x" = X、ν-8 段階6-1 E で twitter → x 移行済み） */
type SocialLinks = Partial<Record<SocialPlatform, string>>;

type OwUser = {
  id: string;
  name: string;
  avatar_color: string | null;
  avatar_url: string | null;
  cover_color: string | null;
  cover_photo_url: string | null;
  about_me: string | null;
  birth_date: string | null;
  location: string | null;
  social_links: SocialLinks | null;
  is_mentor: boolean;
  future_aspirations: string | null;
  auth_id: string;
};

type Education = {
  id: string;
  school: string;
  faculty: string | null;
  degree: string | null;
  enrolled_at: string | null;
  graduated_at: string | null;
  is_current: boolean;
  sort_order: number;
};

type Certification = {
  id: string;
  name: string;
  sort_order: number;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_users")
    .select("name")
    .eq("id", params.id)
    .maybeSingle();
  return { title: data ? `${data.name} — OPINIO` : "プロフィール — OPINIO" };
}

export default async function UserProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  // RLS handles visibility: anon sees public only, authenticated sees public+login_only+own.
  // maybeSingle() returns null for private/nonexistent → notFound()
  // auth.getUser() と ow_users fetch を並列実行
  const [
    { data: { user: authUser } },
    { data: user },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("ow_users")
      .select("id, name, avatar_color, avatar_url, cover_color, cover_photo_url, about_me, birth_date, location, social_links, is_mentor, future_aspirations, auth_id")
      .eq("id", params.id)
      .maybeSingle(),
  ]);

  if (!user) notFound();

  const owUser = user as OwUser;

  const avatarColor = owUser.avatar_color ?? "linear-gradient(135deg, #002366, #3B5FD9)";
  const coverColor = owUser.cover_color ?? "linear-gradient(135deg, #002366, #3B5FD9, #818CF8)";
  const initial = owUser.name.charAt(0);
  const viewerIsOwner = !!authUser && owUser.auth_id === authUser.id;

  // 年齢表示: birth_date をサーバ側で計算（NULL = 非公開）
  const age = getUserAge(owUser.birth_date);
  const ageDisplay = age !== null ? `${age}歳` : null;

  const socialLinks = owUser.social_links ?? {};
  // SNS_PLATFORMS の順序を維持しつつ、値が空文字列でないキーのみ抽出
  const activeSocials = SNS_PLATFORMS.filter(
    (k) => socialLinks[k] && socialLinks[k]!.trim() !== ""
  );

  // Fetch experiences + skill tags + educations + certifications in parallel（RLS select_all=true のため認証不問で読める）
  const [
    { data: expRows }, { data: allRoles }, { data: skillTagsRaw },
    { data: educationsRaw }, { data: certificationsRaw },
  ] = await Promise.all([
    supabase
      .from("ow_experiences")
      .select("id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, description")
      .eq("user_id", owUser.id)
      .order("is_current", { ascending: false })
      .order("started_at", { ascending: false }),
    supabase.from("ow_roles").select("id, name"),
    supabase
      .from("ow_user_skill_tags")
      .select("id, label, sort_order")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("ow_user_educations")
      .select(`id, school, school_id, faculty, degree, enrolled_at, graduated_at, is_current, sort_order, school_master:ow_schools!school_id(id, name, logo_letter, logo_gradient, logo_url)`)
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("ow_user_certifications")
      .select("id, name, sort_order")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
  ]);

  const skillTags      = skillTagsRaw      ?? [];
  const educations     = (educationsRaw     ?? []) as Education[];
  const certifications = (certificationsRaw ?? []) as Certification[];

  // ロール表示名を直接参照（ow_roles.name が日本語表示ラベルそのもの、slug 変換不要）
  const roleNameById = new Map<string, string>();
  for (const role of allRoles ?? []) {
    roleNameById.set(role.id as string, role.name as string);
  }

  // Resolve company info (name + logo 3 フィールド) for master entries in experiences
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

  // MergedTimeline 用データ整形
  const timelineCareers = buildTimelineCareerEntriesFromRaw(
    (expRows ?? []) as RawExperienceRow[],
    roleNameById,
    companyInfoById,
  );
  const timelineEdus    = toTimelineEducationEntries(educations as RawEducation[]);
  const futureData      = buildFutureData(owUser, viewerIsOwner);

  // Current company for sidebar card
  const currentCareer = timelineCareers.find((c) => c.is_current && c.company_id) ?? null;

  // If user is a mentor, fetch their mentor ID for direct CTA link
  let mentorId: string | null = null;
  if (owUser.is_mentor) {
    const { data: mentorRow } = await supabase
      .from("ow_mentors")
      .select("id")
      .eq("user_id", owUser.id)
      .maybeSingle();
    mentorId = (mentorRow?.id as string) ?? null;
  }

  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <style>{`
        .profile-grid {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .profile-grid {
            grid-template-columns: 1fr;
          }
          .profile-sidebar {
            display: contents;
          }
          .profile-sidebar-sticky {
            position: static !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 80px" }}>

        {/* Cover + Avatar header — full width above grid */}
        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 16, overflow: "hidden", marginBottom: 24,
        }}>
          {/* Cover area: photo or gradient */}
          <div style={{ height: 180, position: "relative", background: owUser.cover_photo_url ? undefined : coverColor, overflow: "hidden" }}>
            {owUser.cover_photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={owUser.cover_photo_url}
                alt=""
                loading="eager"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
          </div>

          <div style={{ padding: "0 32px 28px", marginTop: -56, position: "relative" }}>
            {/* Avatar: photo or gradient letter */}
            <div style={{
              width: 112, height: 112, borderRadius: "50%",
              background: owUser.avatar_url ? undefined : avatarColor,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 42, fontWeight: 600,
              border: "5px solid #fff",
              boxShadow: "0 4px 16px rgba(15,23,42,0.12)",
              marginBottom: 16, position: "relative",
              overflow: owUser.avatar_url ? "hidden" : "visible",
            }}>
              {owUser.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={owUser.avatar_url}
                  alt={owUser.name}
                  loading="eager"
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                />
              ) : initial}
              {owUser.is_mentor && (
                <div style={{
                  position: "absolute", bottom: 4, right: 4,
                  width: 28, height: 28,
                  background: "linear-gradient(135deg, var(--royal), var(--accent))",
                  borderRadius: "50%", border: "3px solid #fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff",
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
                  </svg>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-noto-serif)',
                  fontSize: 26, fontWeight: 700, color: "var(--ink)",
                  marginBottom: 6, display: "flex", alignItems: "center", gap: 10,
                }}>
                  {owUser.name}
                  {owUser.is_mentor && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                      color: "var(--royal)", background: "var(--royal-50)",
                      border: "1px solid var(--royal-100)",
                      padding: "3px 10px", borderRadius: 100,
                    }}>
                      MENTOR
                    </span>
                  )}
                </div>
                {/* Current role subtitle */}
                {currentCareer && (
                  <div style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 8, lineHeight: 1.4 }}>
                    {currentCareer.role_label}
                    {currentCareer.company_name && (
                      <> @ {currentCareer.company_id
                        ? <Link href={`/companies/${currentCareer.company_id}`} style={{ color: "var(--ink-soft)", textDecoration: "none", borderBottom: "1px solid var(--line)" }}>{currentCareer.company_name}</Link>
                        : currentCareer.company_name
                      }</>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {ageDisplay && (
                    <span style={{ fontSize: 13, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                      </svg>
                      {ageDisplay}
                    </span>
                  )}
                  {owUser.location && (
                    <span style={{ fontSize: 13, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {owUser.location}
                    </span>
                  )}
                </div>
                {/* Social proof strip */}
                <div style={{ display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" }}>
                  {expRows && expRows.length > 0 && (
                    <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                      <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{expRows.length}</strong> 件の職歴
                    </span>
                  )}
                  {skillTags.length > 0 && (
                    <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                      <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{skillTags.length}</strong> スキル
                    </span>
                  )}
                </div>
              </div>
              {viewerIsOwner && (
                <Link href="/profile/edit" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 18px", borderRadius: 8,
                  border: "1.5px solid var(--line)", background: "#fff",
                  color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, textDecoration: "none",
                  flexShrink: 0,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  プロフィールを編集
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Two-column grid: main content | sidebar */}
        <div className="profile-grid">

          {/* ── Main column ─────────────────────────────────────────── */}
          <div>

            {/* About Me */}
            {owUser.about_me ? (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "24px 28px", marginBottom: 20,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    About Me
                  </span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    SELF INTRO
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                </div>
                <p style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.85, whiteSpace: "pre-wrap", margin: 0 }}>
                  {owUser.about_me}
                </p>
              </section>
            ) : viewerIsOwner ? (
              <section style={{
                background: "var(--bg-tint)", border: "1.5px dashed var(--line)",
                borderRadius: 14, padding: "28px", marginBottom: 20,
                textAlign: "center",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 10 }}>
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: "0 0 12px" }}>
                  自己紹介を書いて、あなたのことを伝えましょう
                </p>
                <Link href="/profile/edit" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 18px", borderRadius: 8,
                  background: "var(--royal)", color: "#fff",
                  fontSize: 13, fontWeight: 600, textDecoration: "none",
                }}>
                  プロフィールを編集する →
                </Link>
              </section>
            ) : null}

            {/* 経歴 — キャリア + 学歴 + 未来を MergedTimeline で統合表示 */}
            {(timelineCareers.length > 0 || timelineEdus.length > 0 || futureData != null) && (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "24px 28px", marginBottom: 20,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <span style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    経歴
                  </span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    TIMELINE
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                </div>
                <MergedTimeline
                  careers={timelineCareers}
                  educations={timelineEdus}
                  future={futureData}
                  viewerIsOwner={viewerIsOwner}
                />
              </section>
            )}

            {/* Non-auth CTA in main column (below timeline on mobile, sticky sidebar on desktop) */}
            {!authUser && !viewerIsOwner && (
              <section style={{
                background: "linear-gradient(135deg, var(--royal) 0%, #3B5FD9 100%)",
                borderRadius: 16, padding: "32px 28px", marginBottom: 20,
                textAlign: "center", position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", inset: 0, opacity: 0.06,
                  backgroundImage: "radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }} />
                <div style={{ position: "relative" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 12px", borderRadius: 100,
                    background: "rgba(255,255,255,0.15)",
                    fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.9)",
                    letterSpacing: "0.06em", marginBottom: 16,
                  }}>
                    完全無料 · メール登録のみ
                  </div>
                  <h3 style={{
                    fontFamily: 'var(--font-noto-serif)',
                    fontSize: "clamp(17px,2vw,21px)", fontWeight: 700,
                    color: "#fff", marginBottom: 10, lineHeight: 1.5,
                  }}>
                    {owUser.name}さんが働く職場の<br />リアルを知ろう
                  </h3>
                  <p style={{
                    fontSize: 13, color: "rgba(255,255,255,0.75)",
                    marginBottom: 24, lineHeight: 1.7,
                  }}>
                    企業の特徴・評判・社員インタビューを<br />
                    無料で読める。先輩に相談することもできます。
                  </p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    <Link href="/auth" style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "12px 24px", borderRadius: 8,
                      background: "#fff", color: "var(--royal)",
                      fontSize: 14, fontWeight: 700, textDecoration: "none",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                    }}>
                      無料で登録する →
                    </Link>
                    {currentCareer && (
                      <Link href={`/companies/${currentCareer.company_id}`} style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "12px 24px", borderRadius: 8,
                        background: "rgba(255,255,255,0.15)",
                        border: "1.5px solid rgba(255,255,255,0.35)",
                        color: "#fff",
                        fontSize: 14, fontWeight: 600, textDecoration: "none",
                      }}>
                        在籍企業を見る
                      </Link>
                    )}
                  </div>
                </div>
              </section>
            )}

          </div>{/* /main column */}

          {/* ── Sidebar ─────────────────────────────────────────────── */}
          <aside className="profile-sidebar">
            <div className="profile-sidebar-sticky" style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Current company card */}
              {currentCareer && (
                <div style={{
                  background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                  borderRadius: 14, padding: "18px 20px",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--royal)", letterSpacing: "0.08em", marginBottom: 12, textTransform: "uppercase" }}>
                    現在の在籍企業
                  </div>
                  <Link href={`/companies/${currentCareer.company_id}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Logo */}
                    <div style={{
                      width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                      background: currentCareer.logo_gradient ?? "linear-gradient(135deg, #002366, #3B5FD9)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 20, fontWeight: 700,
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}>
                      {currentCareer.logo_letter ?? currentCareer.company_name.charAt(0)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Noto Serif JP', serif",
                        fontSize: 15, fontWeight: 700, color: "var(--ink)",
                        marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {currentCareer.company_name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {currentCareer.role_label}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginLeft: "auto" }}>
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              )}

              {/* Mentor CTA */}
              {owUser.is_mentor && (
                <div style={{
                  background: "linear-gradient(135deg, var(--royal-50), #EFF3FC)",
                  border: "1px solid var(--royal-100)", borderRadius: 14, padding: "18px 20px",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--royal)", letterSpacing: "0.06em", marginBottom: 8 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                    MENTOR
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                    キャリア相談を受け付け中
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 14, lineHeight: 1.6 }}>
                    30分から無料でキャリア相談できます
                  </div>
                  <Link href={mentorId ? `/mentors/${mentorId}` : "/mentors"} style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 6, padding: "9px 16px",
                    background: "linear-gradient(135deg, var(--royal), var(--accent))", color: "#fff",
                    borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
                    boxShadow: "0 2px 8px rgba(0,35,102,0.2)",
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    相談を申し込む →
                  </Link>
                </div>
              )}

              {/* Skills */}
              {skillTags.length > 0 && (
                <div style={{
                  background: "#fff", border: "1px solid var(--line)",
                  borderRadius: 14, padding: "18px 20px",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--royal)", letterSpacing: "0.08em", marginBottom: 12, textTransform: "uppercase" }}>
                    スキル
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {skillTags.map((tag) => (
                      <span
                        key={tag.id as string}
                        style={{
                          display: "inline-flex", alignItems: "center",
                          padding: "4px 10px", borderRadius: 100,
                          background: "#EFF6FF", border: "1px solid #BFDBFE",
                          fontSize: 12, color: "#1D4ED8", fontWeight: 500,
                        }}
                      >
                        {tag.label as string}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications */}
              {certifications.length > 0 && (
                <div style={{
                  background: "#fff", border: "1px solid var(--line)",
                  borderRadius: 14, padding: "18px 20px",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--royal)", letterSpacing: "0.08em", marginBottom: 12, textTransform: "uppercase" }}>
                    資格・認定
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {certifications.map((cert) => (
                      <div key={cert.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <circle cx="12" cy="8" r="6" />
                          <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                        </svg>
                        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{cert.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Social links */}
              {activeSocials.length > 0 && (
                <div style={{
                  background: "#fff", border: "1px solid var(--line)",
                  borderRadius: 14, padding: "18px 20px",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--royal)", letterSpacing: "0.08em", marginBottom: 12, textTransform: "uppercase" }}>
                    リンク
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {activeSocials.map((platform) => {
                      const url = socialLinks[platform]!;
                      const label = SOCIAL_META[platform].label;
                      return (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={label}
                          title={label}
                          className="sns-icon-link"
                        >
                          <SocialIcon platform={platform} variant="display" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Non-auth compact CTA */}
              {!authUser && !viewerIsOwner && (
                <div style={{
                  background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                  borderRadius: 14, padding: "18px 20px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 12, lineHeight: 1.6 }}>
                    OPINIOに登録して<br />企業情報を無料でチェック
                  </div>
                  <Link href="/auth" style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "9px 16px", background: "var(--royal)", color: "#fff",
                    borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
                  }}>
                    無料で登録する →
                  </Link>
                </div>
              )}

            </div>
          </aside>

        </div>{/* /profile-grid */}

        {/* Footer note */}
        <div style={{ textAlign: "center", padding: "32px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>
          <Link href="/companies" style={{ color: "var(--ink-mute)", textDecoration: "none" }}>
            OPINIO
          </Link>
          {" "}のプロフィールページ
          {!authUser && (
            <>
              {" "}·{" "}
              <Link href="/auth" style={{ color: "var(--royal)", textDecoration: "none" }}>
                登録して情報収集を始める
              </Link>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
