import { notFound, redirect } from "next/navigation";
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

  // 未ログインはプロフィールページ自体を閲覧不可 → /auth へリダイレクト
  if (!authUser) redirect(`/auth?next=/u/${params.id}`);

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
  const companyPhaseById = new Map<string, string | null>();
  if (expCompanyIds.length > 0) {
    const { data: expCompanies } = await supabase
      .from("ow_companies")
      .select("id, name, logo_url, logo_letter, logo_gradient, phase")
      .in("id", expCompanyIds);
    for (const c of expCompanies ?? []) {
      companyInfoById.set(c.id as string, {
        name: c.name as string,
        logoUrl: (c.logo_url as string | null) ?? null,
        logoLetter: (c.logo_letter as string | null) ?? null,
        logoGradient: (c.logo_gradient as string | null) ?? null,
      });
    }
    for (const c of expCompanies ?? []) {
      companyPhaseById.set(c.id as string, (c.phase as string | null) ?? null);
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

  // If user is a mentor, fetch mentor ID + question_tags for "話せること" section
  let mentorId: string | null = null;
  let mentorQuestionTags: string[] = [];
  if (owUser.is_mentor) {
    const { data: mentorRow } = await supabase
      .from("ow_mentors")
      .select("id, question_tags")
      .eq("user_id", owUser.id)
      .maybeSingle();
    mentorId = (mentorRow?.id as string) ?? null;
    mentorQuestionTags = (mentorRow?.question_tags as string[] | null) ?? [];
  }

  // キャリアサマリー自動計算
  const careerSummary = (() => {
    if (timelineCareers.length === 0) return null;
    let totalMonths = 0;
    const companySet = new Set<string>();
    const roleSet = new Set<string>();
    for (const c of timelineCareers) {
      const start = new Date(c.started_at);
      const end = c.ended_at ? new Date(c.ended_at) : new Date();
      totalMonths += Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
      if (c.company_name && c.company_name !== "非公開") companySet.add(c.company_name);
      if (c.role_label) roleSet.add(c.role_label);
    }
    const totalYears = Math.max(1, Math.round(totalMonths / 12));
    return { totalYears, companyCount: companySet.size };
  })();

  // 在籍期間計算（currentCareer）
  const currentCareerTenure = (() => {
    if (!currentCareer) return null;
    const start = new Date(currentCareer.started_at);
    const now = new Date();
    const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (years === 0) return `${rem}ヶ月`;
    if (rem === 0) return `${years}年`;
    return `${years}年${rem}ヶ月`;
  })();

  // 現職企業フェーズ
  const currentCompanyPhase = currentCareer?.company_id ? (companyPhaseById.get(currentCareer.company_id) ?? null) : null;

  // キャリアパスノード用 年表示
  const fmtYearRange = (startedAt: string, endedAt: string | null, isCurrent: boolean) => {
    const sy = new Date(startedAt).getFullYear();
    if (isCurrent) return `${sy}年〜`;
    const ey = new Date(endedAt!).getFullYear();
    return sy === ey ? `${sy}年` : `${sy}〜${ey}年`;
  };

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
          <div style={{ height: 200, position: "relative", background: owUser.cover_photo_url ? undefined : coverColor, overflow: "hidden" }}>
            {owUser.cover_photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={owUser.cover_photo_url}
                alt=""
                loading="eager"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
            {/* Subtle dot pattern overlay */}
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }} />
            {/* Bottom fade gradient */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
              background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.15))",
            }} />
          </div>

          <div style={{ padding: "0 32px 32px", marginTop: -56, position: "relative" }}>
            {/* Avatar: photo or gradient letter */}
            <div style={{
              width: 112, height: 112, borderRadius: "50%",
              background: owUser.avatar_url ? undefined : avatarColor,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 42, fontWeight: 600,
              border: "5px solid #fff",
              boxShadow: "0 4px 16px rgba(15,23,42,0.12)",
              marginBottom: 12, position: "relative",
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
                  width: 30, height: 30,
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
                  fontSize: 30, fontWeight: 700, color: "var(--ink)",
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
                {/* Career stats strip */}
                {careerSummary && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 0, marginTop: 14, flexWrap: "wrap", background: "var(--bg-tint)", borderRadius: 100, padding: "4px 8px", border: "1px solid var(--line)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--ink-soft)", padding: "4px 12px 4px 0" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                      <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{careerSummary.companyCount}</strong>社の経験
                    </span>
                    <span style={{ width: 1, height: 14, background: "var(--line)", margin: "0 4px", flexShrink: 0 }} />
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--ink-soft)", padding: "4px 12px" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{careerSummary.totalYears}</strong>年のキャリア
                    </span>
                    {skillTags.length > 0 && (
                      <>
                        <span style={{ width: 1, height: 14, background: "var(--line)", margin: "0 4px", flexShrink: 0 }} />
                        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--ink-soft)", padding: "4px 0 4px 12px" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                          <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{skillTags.length}</strong>スキル
                        </span>
                      </>
                    )}
                  </div>
                )}
                {skillTags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {skillTags.slice(0, 5).map((tag) => (
                      <span key={tag.id as string} style={{
                        display: "inline-flex", alignItems: "center",
                        padding: "3px 10px", borderRadius: 100,
                        background: "#fff", border: "1.5px solid var(--line)",
                        fontSize: 12, color: "var(--ink-soft)", fontWeight: 500,
                      }}>
                        {tag.label as string}
                      </span>
                    ))}
                    {skillTags.length > 5 && (
                      <span style={{
                        display: "inline-flex", alignItems: "center",
                        padding: "3px 10px", borderRadius: 100,
                        background: "var(--bg-tint)", border: "1.5px solid var(--line)",
                        fontSize: 12, color: "var(--ink-mute)", fontWeight: 500,
                      }}>
                        +{skillTags.length - 5}
                      </span>
                    )}
                  </div>
                )}
                {activeSocials.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {activeSocials.map((platform) => {
                      const url = socialLinks[platform]!;
                      const label = SOCIAL_META[platform].label;
                      return (
                        <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                          aria-label={label} title={label} className="sns-icon-link">
                          <SocialIcon platform={platform} variant="display" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right-side CTA: context-aware */}
              {viewerIsOwner ? (
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
              ) : owUser.is_mentor && mentorId ? (
                /* メンターのみ: 相談申込ボタン */
                <Link href={`/mentors/${mentorId}/reserve`} style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "11px 22px", borderRadius: 10,
                  background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
                  color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none",
                  boxShadow: "0 4px 20px rgba(0,35,102,0.25)", flexShrink: 0,
                  letterSpacing: "0.02em",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  メンター相談を申し込む
                </Link>
              ) : currentCareer?.company_id ? (
                /* 一般社員: 企業ページへの控えめなリンク */
                <Link href={`/companies/${currentCareer.company_id}`} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 18px", borderRadius: 8,
                  border: "1.5px solid var(--royal-100)", background: "var(--royal-50)",
                  color: "var(--royal)", fontSize: 13, fontWeight: 600, textDecoration: "none",
                  flexShrink: 0,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  {currentCareer.company_name} の企業ページを見る
                </Link>
              ) : null
              }
            </div>
          </div>
        </div>

        {/* Two-column grid: main content | sidebar */}
        <div className="profile-grid">

          {/* ── Main column ─────────────────────────────────────────── */}
          <div>

            {/* ── 目指していること (Wantedly-style aspirations card) ── */}
            {owUser.future_aspirations && (
              <section style={{
                background: "linear-gradient(135deg, #f8f4ff 0%, #eff6ff 100%)",
                border: "1px solid #e8e0ff",
                borderRadius: 14, padding: "22px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(124,58,237,0.08)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: "linear-gradient(135deg, var(--purple), #a855f7)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", fontFamily: "'Noto Serif JP', serif" }}>
                      目指していること
                    </div>
                    <div style={{ fontSize: 10, color: "var(--purple)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      ASPIRATION
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.9, whiteSpace: "pre-wrap", margin: 0, paddingLeft: 42 }}>
                  {owUser.future_aspirations}
                </p>
              </section>
            )}

            {/* About Me */}
            {owUser.about_me ? (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "24px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
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
                <div style={{ position: "relative", paddingLeft: 20 }}>
                  <div style={{
                    position: "absolute", left: 0, top: -4,
                    fontSize: 48, lineHeight: 1, color: "var(--royal-100)",
                    fontFamily: "Georgia, serif", fontWeight: 700, userSelect: "none",
                  }}>❝</div>
                  <p style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.9, whiteSpace: "pre-wrap", margin: 0, paddingLeft: 8 }}>
                    {owUser.about_me}
                  </p>
                </div>
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

            {/* ── スキル・専門性 (LinkedIn-style skills section in main column) ── */}
            {skillTags.length > 0 && (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "22px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    スキル・専門性
                  </span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    SKILLS
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>
                    {skillTags.length}件
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {skillTags.map((tag) => (
                    <span
                      key={tag.id as string}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "7px 14px", borderRadius: 8,
                        background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                        fontSize: 13, color: "var(--royal)", fontWeight: 600,
                        transition: "background 0.15s",
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {tag.label as string}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* 経歴 — キャリア + 学歴 + 未来を MergedTimeline で統合表示 */}
            {(timelineCareers.length > 0 || timelineEdus.length > 0 || futureData != null) && (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "24px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
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

                {/* ── 視覚的キャリアパス ── */}
                {timelineCareers.length >= 2 && (
                  <div style={{ marginBottom: 28, overflowX: "auto", paddingBottom: 8, padding: "0 2px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: "max-content" }}>
                      {[...timelineCareers].reverse().map((c, i) => (
                        <div key={c.id} style={{ display: "flex", alignItems: "center" }}>
                          {i > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 4px" }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            </div>
                          )}
                          <div style={{
                            display: "flex", flexDirection: "column", alignItems: "center",
                            padding: "10px 14px", borderRadius: 10,
                            background: c.is_current ? "var(--royal-50)" : "var(--bg-tint)",
                            border: `1.5px solid ${c.is_current ? "var(--royal-100)" : "var(--line)"}`,
                            minWidth: 100, maxWidth: 130,
                            position: "relative",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                            transition: "box-shadow 0.15s",
                          }}>
                            {c.is_current && (
                              <span style={{
                                position: "absolute", top: -9,
                                background: "var(--royal)", color: "#fff",
                                fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                                padding: "2px 8px", borderRadius: 100,
                              }}>現在</span>
                            )}
                            <div style={{ position: "relative", marginBottom: 6 }}>
                              {c.is_current && (
                                <div style={{
                                  position: "absolute", inset: -4, borderRadius: 10,
                                  border: "2px solid var(--royal)", opacity: 0.4,
                                  animation: "pulseDot 2s ease-in-out infinite",
                                }} />
                              )}
                              <div style={{
                                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                background: c.logo_gradient ?? (c.is_current ? "var(--royal)" : "var(--line)"),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#fff", fontSize: 13, fontWeight: 700,
                              }}>
                                {c.logo_letter ?? c.company_name.charAt(0)}
                              </div>
                            </div>
                            <div style={{
                              fontSize: 11, fontWeight: 600, color: c.is_current ? "var(--royal)" : "var(--ink)",
                              textAlign: "center", lineHeight: 1.3, wordBreak: "break-all",
                              overflow: "hidden", display: "-webkit-box",
                              WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                            }}>
                              {c.company_name}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--ink-mute)", textAlign: "center", marginTop: 3, lineHeight: 1.2 }}>
                              {c.role_label.length > 12 ? c.role_label.slice(0, 12) + "…" : c.role_label}
                            </div>
                            <div style={{ fontSize: 9, color: "var(--ink-mute)", textAlign: "center", marginTop: 2, fontFamily: "Inter, sans-serif", opacity: 0.7 }}>
                              {fmtYearRange(c.started_at, c.ended_at ?? null, c.is_current)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <MergedTimeline
                  careers={timelineCareers}
                  educations={timelineEdus}
                  future={futureData}
                  viewerIsOwner={viewerIsOwner}
                />
              </section>
            )}

          </div>{/* /main column */}

          {/* ── Sidebar ─────────────────────────────────────────────── */}
          <aside className="profile-sidebar">
            <div className="profile-sidebar-sticky" style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ── メンターのみ: この人と話す CTA ── */}
              {!viewerIsOwner && owUser.is_mentor && mentorId && (
                <div style={{
                  background: "linear-gradient(160deg, #001a5c 0%, var(--royal) 60%, #2d4ed8 100%)",
                  borderRadius: 16, padding: "22px 20px",
                  boxShadow: "0 8px 32px rgba(0,35,102,0.22)",
                  position: "relative",
                }}>
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: 16,
                    backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
                    backgroundSize: "20px 20px", pointerEvents: "none",
                  }} />
                  <div style={{ position: "relative" }}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: "rgba(255,255,255,0.15)", borderRadius: 100,
                      padding: "3px 10px", marginBottom: 10,
                    }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="#FCD34D"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#FCD34D", letterSpacing: "0.08em" }}>MENTOR</span>
                    </div>
                    <div style={{ fontSize: 14, color: "#fff", fontWeight: 700, marginBottom: 4, lineHeight: 1.45 }}>
                      {owUser.name.split(" ")[0]}さんに<br/>キャリア相談してみませんか？
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 18, lineHeight: 1.5 }}>
                      完全無料 · 30分から · 編集部が仲介
                    </div>
                    <Link href={`/mentors/${mentorId}/reserve`} style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      padding: "12px 16px", borderRadius: 8,
                      background: "#fff", color: "var(--royal)",
                      fontSize: 13, fontWeight: 700, textDecoration: "none",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      メンター相談を申し込む →
                    </Link>
                  </div>
                </div>
              )}

              {/* 話せること (for mentors) */}
              {owUser.is_mentor && mentorQuestionTags.length > 0 && (
                <div style={{
                  background: "#fff", border: "1px solid var(--line)",
                  borderRadius: 14, padding: "18px 20px",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--royal)", letterSpacing: "0.08em", marginBottom: 12, textTransform: "uppercase" }}>
                    話せること
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {mentorQuestionTags.map((tag, i) => (
                      <span key={i} style={{
                        display: "inline-flex", alignItems: "center",
                        padding: "5px 11px", borderRadius: 100,
                        background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                        fontSize: 12, color: "var(--royal)", fontWeight: 500,
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Current company card — 企業ページへ + カジュアル面談CTA */}
              {currentCareer && currentCareer.company_id && (
                <div style={{
                  background: "#fff", border: "1px solid var(--line)",
                  borderRadius: 14, padding: "18px 20px",
                  boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.08em", marginBottom: 12, textTransform: "uppercase" }}>
                    在籍企業
                  </div>
                  {/* Company link */}
                  <Link href={`/companies/${currentCareer.company_id}`} style={{
                    textDecoration: "none", display: "flex", alignItems: "center", gap: 12,
                    marginBottom: 12,
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                      background: currentCareer.logo_gradient ?? "linear-gradient(135deg, #002366, #3B5FD9)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 18, fontWeight: 700,
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}>
                      {currentCareer.logo_letter ?? currentCareer.company_name.charAt(0)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontFamily: "'Noto Serif JP', serif",
                        fontSize: 14, fontWeight: 700, color: "var(--ink)",
                        marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {currentCareer.company_name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {currentCareer.role_label}
                      </div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>

                  {/* 在籍期間 + フェーズ */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: !viewerIsOwner ? 10 : 0 }}>
                    {currentCareerTenure && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 11, color: "var(--ink-mute)",
                        background: "var(--bg-tint)", border: "1px solid var(--line)",
                        padding: "2px 8px", borderRadius: 100,
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        在籍 {currentCareerTenure}
                      </span>
                    )}
                    {currentCompanyPhase && (
                      <span style={{
                        display: "inline-flex", alignItems: "center",
                        fontSize: 11, color: "var(--royal)",
                        background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                        padding: "2px 8px", borderRadius: 100, fontWeight: 600,
                      }}>
                        {currentCompanyPhase}
                      </span>
                    )}
                  </div>

                  {/* カジュアル面談CTA — 企業へのアクション（非オーナーのみ） */}
                  {!viewerIsOwner && (
                    <>
                      <div style={{ height: 1, background: "var(--line)", margin: "0 0 14px" }} />
                      <Link href={`/companies/${currentCareer.company_id}/casual-meeting`} style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        padding: "10px 14px", borderRadius: 8,
                        background: "linear-gradient(135deg, var(--warm) 0%, #D97706 100%)",
                        color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none",
                        boxShadow: "0 2px 10px rgba(245,158,11,0.25)",
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        カジュアル面談を申し込む
                      </Link>
                      <p style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "center", margin: "8px 0 0", lineHeight: 1.5 }}>
                        {currentCareer.company_name}の担当者が返信します
                      </p>
                    </>
                  )}
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {certifications.map((cert) => (
                      <div key={cert.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px", borderRadius: 8,
                        background: "var(--bg-tint)", border: "1px solid var(--line)",
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                          background: "linear-gradient(135deg, var(--warm) 0%, #D97706 100%)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
                            <circle cx="12" cy="8" r="6" />
                            <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                          </svg>
                        </div>
                        <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500, lineHeight: 1.4 }}>{cert.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}


            </div>
          </aside>

        </div>{/* /profile-grid */}

        {/* Footer note */}
        <div style={{ textAlign: "center", padding: "40px 0 0", fontSize: 12, color: "var(--ink-mute)", opacity: 0.7 }}>
          <Link href="/companies" style={{ color: "var(--ink-mute)", textDecoration: "none" }}>
            OPINIO
          </Link>
          {" "}のプロフィールページ
        </div>

      </div>
    </div>
  );
}
