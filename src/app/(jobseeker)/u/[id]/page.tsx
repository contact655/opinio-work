import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import MergedTimeline from "@/components/profile/MergedTimeline";
import { PostComposer } from "@/components/profile/PostComposer";
import { PostCard } from "@/components/profile/PostCard";
import { RecommendationCard } from "@/components/profile/RecommendationCard";
import { RecommendationForm } from "@/components/profile/RecommendationForm";
import {
  buildTimelineCareerEntriesFromRaw,
  toTimelineEducationEntries,
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
import { ProfileShareButton } from "@/components/profile/ProfileShareButton";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 会社名から法人格プレフィックス・サフィックスを除去して短縮名を返す */
function shortCompanyName(name: string): string {
  return name
    .replace(/^株式会社\s*/, "")
    .replace(/\s*株式会社$/, "")
    .replace(/^有限会社\s*/, "")
    .replace(/\s*有限会社$/, "")
    .replace(/\s+Japan\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s*,\s*Inc\.?$/i, "")
    .replace(/\s+Inc\.?$/i, "")
    .replace(/\s+Japan$/i, "")
    .trim() || name;
}

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
  future_aspirations: string | null;
  is_open_to_work: boolean | null;
  can_casual_meeting: boolean | null;
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
      .select("id, name, avatar_color, avatar_url, cover_color, cover_photo_url, about_me, birth_date, location, social_links, future_aspirations, is_open_to_work, can_casual_meeting, auth_id")
      .eq("id", params.id)
      .maybeSingle(),
  ]);

  // 未ログインでも public プロフィールは閲覧可能（RLS が visibility を制御）
  // visibility = 'login_only' → anon は null が返る → 404
  // visibility = 'private'   → 本人以外 null が返る → 404
  if (!user) notFound();

  const owUser = user as OwUser;

  const avatarColor = owUser.avatar_color ?? "linear-gradient(135deg, var(--royal), #3B5FD9)";
  const coverColor = owUser.cover_color ?? "linear-gradient(135deg, var(--royal), #3B5FD9, #818CF8)";
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

  // Fetch experiences + skill tags + educations + certifications + content links + achievements + awards + media + recommendations in parallel
  const [
    { data: expRows }, { data: allRoles }, { data: skillTagsRaw },
    { data: educationsRaw }, { data: certificationsRaw }, { data: contentLinksRaw },
    { data: achievementsRaw }, { data: awardsRaw }, { data: mediaAppearancesRaw },
    { data: recentPostsRaw }, { data: recommendationsRaw },
  ] = await Promise.all([
    supabase
      .from("ow_experiences")
      .select("id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, description, join_reason")
      .eq("user_id", owUser.id)
      .order("is_current", { ascending: false })
      .order("started_at", { ascending: false }),
    supabase.from("ow_roles").select("id, name"),
    supabase
      .from("ow_user_skill_tags")
      .select("id, label, category, sort_order")
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
    supabase
      .from("ow_user_content_links")
      .select("id, url, platform, title, description, thumbnail_url, sort_order")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("ow_user_achievements")
      .select("id, title, value, unit, description, period_start, period_end, sort_order")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("ow_user_awards")
      .select("id, title, issuer, awarded_at, description, sort_order")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("ow_user_media_appearances")
      .select("id, title, media_name, url, thumbnail_url, appeared_at, description, sort_order")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("ow_posts")
      .select("id, content, image_url, created_at, likes:ow_post_likes(count)")
      .eq("user_id", owUser.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("ow_user_recommendations")
      .select("id, recommender_user_id, recommender_name, recommender_title, recommender_company, relationship, content, is_visible, created_at")
      .eq("target_user_id", owUser.id)
      .order("created_at", { ascending: false }),
  ]);

  const skillTags      = skillTagsRaw      ?? [];
  const educations     = (educationsRaw     ?? []) as Education[];
  const certifications = (certificationsRaw ?? []) as Certification[];
  const contentLinks   = (contentLinksRaw  ?? []) as Array<{
    id: string; url: string; platform: string | null;
    title: string | null; description: string | null;
    thumbnail_url: string | null; sort_order: number;
  }>;
  const achievements   = (achievementsRaw  ?? []) as Array<{
    id: string; title: string; value: string | null; unit: string | null;
    description: string | null; period_start: string | null; period_end: string | null; sort_order: number;
  }>;
  const awards         = (awardsRaw        ?? []) as Array<{
    id: string; title: string; issuer: string | null; awarded_at: string | null;
    description: string | null; sort_order: number;
  }>;
  const mediaAppearances = (mediaAppearancesRaw ?? []) as Array<{
    id: string; title: string; media_name: string | null; url: string | null;
    thumbnail_url: string | null; appeared_at: string | null; description: string | null; sort_order: number;
  }>;
  const recentPostsTyped = (recentPostsRaw ?? []) as Array<{
    id: string; content: string; image_url: string | null; created_at: string;
    likes: Array<{ count: number }>;
  }>;
  type RecRow = {
    id: string; recommender_user_id: string | null;
    recommender_name: string; recommender_title: string | null;
    recommender_company: string | null; relationship: string | null;
    content: string; is_visible: boolean; created_at: string;
  };
  // オーナーは全件（非表示含む）、他者は表示中のみ
  const allRecommendations = (recommendationsRaw ?? []) as RecRow[];
  const recommendations = viewerIsOwner
    ? allRecommendations
    : allRecommendations.filter((r) => r.is_visible);

  // ログインユーザーがいいねしている投稿ID一覧
  const likedPostIds = new Set<string>();
  if (authUser && recentPostsTyped.length > 0) {
    const { data: owViewer } = await supabase
      .from("ow_users").select("id").eq("auth_id", authUser.id).maybeSingle();
    if (owViewer) {
      const { data: likedRows } = await supabase
        .from("ow_post_likes")
        .select("post_id")
        .eq("user_id", owViewer.id)
        .in("post_id", recentPostsTyped.map((p) => p.id));
      for (const r of likedRows ?? []) likedPostIds.add(r.post_id as string);
    }
  }

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

  // Current company for sidebar card（company_id の有無は問わない — 在籍中なら表示）
  const currentCareer = timelineCareers.find((c) => c.is_current) ?? null;
  // timeline.ts が company_id を null にするのは「ow_companies に未登録」の場合のみ
  // → company_id が非 null = 企業ページへのリンクが有効
  const isCurrentCompanyKnown = !!currentCareer?.company_id;

  // 在籍企業の募集中求人（サイドバー表示用）
  let currentCompanyJobs: Array<{ id: string; title: string }> = [];
  if (currentCareer?.company_id) {
    const { data: jobsData } = await supabase
      .from("ow_jobs")
      .select("id, title")
      .eq("company_id", currentCareer.company_id)
      .in("status", ["published", "active"])
      .limit(3);
    currentCompanyJobs = (jobsData ?? []) as Array<{ id: string; title: string }>;
  }

  // OPINIO掲載記事（ow_articles.user_id でリンクされたもの）
  const { data: featuredArticlesRaw } = await supabase
    .from("ow_articles")
    .select("id, slug, title, subtitle, type, eyecatch_gradient, read_min, published_at")
    .eq("user_id", owUser.id)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(6);
  const featuredArticles = (featuredArticlesRaw ?? []) as Array<{
    id: string; slug: string; title: string; subtitle: string | null;
    type: string; eyecatch_gradient: string | null; read_min: number | null;
    published_at: string | null;
  }>;

  // キャリアサマリー自動計算
  const careerSummary = (() => {
    if (timelineCareers.length === 0) return null;
    let totalMonths = 0;
    // 会社カウント: company_id で重複排除 → 名前テキスト → 非公開は各エントリーを1社としてカウント
    const companySet = new Set<string>();
    for (const c of timelineCareers) {
      const start = new Date(c.started_at);
      const end = c.ended_at ? new Date(c.ended_at) : new Date();
      totalMonths += Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
      if (c.company_id) {
        companySet.add(`id:${c.company_id}`);
      } else if (c.company_name && c.company_name !== "非公開" && c.company_name !== "不明な企業") {
        companySet.add(`name:${c.company_name}`);
      } else {
        // 非公開企業: experience ID で1社としてカウント
        companySet.add(`anon:${c.id}`);
      }
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
  // プラットフォームメタ（アイコン色・表示名）
  const PLATFORM_META: Record<string, { label: string; color: string; bg: string }> = {
    youtube:      { label: "YouTube",      color: "#FF0000", bg: "#FFF0F0" },
    note:         { label: "note",         color: "#41C9B4", bg: "#F0FDFB" },
    zenn:         { label: "Zenn",         color: "#3EA8FF", bg: "#EFF8FF" },
    speakerdeck:  { label: "Speaker Deck", color: "#009287", bg: "#EEFAF8" },
    podcast:      { label: "Podcast",      color: "#8B5CF6", bg: "#F5F0FF" },
    github:       { label: "GitHub",       color: "#24292F", bg: "#F6F8FA" },
    other:        { label: "Web",          color: "var(--ink-soft)", bg: "var(--bg-tint)" },
  };

  // 記事タイプ日本語ラベル
  const ARTICLE_TYPE_LABEL: Record<string, string> = {
    employee: "社員インタビュー",
    mentor:   "メンターインタビュー",
    ceo:      "創業者インタビュー",
    report:   "取材レポート",
  };

  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <style>{`
        .profile-grid {
          display: grid;
          grid-template-columns: 1fr 272px;
          gap: 20px;
          align-items: start;
        }
        .profile-sidebar {
          display: block;
        }
        @media (max-width: 960px) {
          .profile-grid {
            display: block;
          }
          .profile-sidebar {
            display: none;
          }
          .profile-sidebar-sticky {
            position: static !important;
          }
          .profile-cover { height: 140px !important; }
          .profile-avatar { width: 88px !important; height: 88px !important; font-size: 32px !important; }
          .profile-avatar-wrap { margin-top: -44px !important; }
          .profile-name { font-size: 22px !important; }
          .profile-header-body { padding: 0 20px 24px !important; }
          .profile-header-cta { font-size: 12px !important; padding: 8px 14px !important; }
          .tl-node-label { font-size: 10px !important; }
          .tl-node-year { font-size: 8px !important; }
        }
        .u-sidebar-link:hover { box-shadow: 0 4px 12px rgba(15,23,42,0.10) !important; }
        .u-content-card:hover { box-shadow: 0 4px 16px rgba(15,23,42,0.12) !important; transform: translateY(-2px) !important; }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 80px" }}>

        {/* Cover + Avatar header — full width above grid */}
        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 16, overflow: "hidden", marginBottom: "var(--space-6)",
        }}>
          {/* Cover area: photo or gradient */}
          <div className="profile-cover" style={{ height: 200, position: "relative", background: owUser.cover_photo_url ? undefined : coverColor, overflow: "hidden" }}>
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

          <div className="profile-header-body" style={{ padding: "0 32px 32px", marginTop: -60, position: "relative" }}>
            {/* Avatar: photo or gradient letter */}
            <div className="profile-avatar profile-avatar-wrap" style={{
              width: 120, height: 120, borderRadius: "50%",
              background: owUser.avatar_url ? undefined : avatarColor,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 42, fontWeight: 600,
              border: "5px solid #fff",
              boxShadow: "0 4px 16px rgba(15,23,42,0.12)",
              marginBottom: "var(--space-3)", position: "relative",
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
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
              <div>
                <div className="profile-name" style={{
                  fontFamily: 'var(--font-noto-serif)',
                  fontSize: 30, fontWeight: 700, color: "var(--ink)",
                  marginBottom: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                }}>
                  {owUser.name}
                  {owUser.is_open_to_work && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "3px 10px", borderRadius: 100,
                      fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.04em",
                      background: "linear-gradient(135deg, var(--success), #10B981)",
                      color: "#fff",
                      boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
                      verticalAlign: "middle",
                      fontFamily: "'Inter', sans-serif",
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                      転職検討中
                    </span>
                  )}
                </div>
                {/* Current role subtitle */}
                {currentCareer && (
                  <div style={{ marginBottom: "var(--space-2)", lineHeight: 1.5 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
                      {currentCareer.role_title || currentCareer.role_label}
                    </span>
                    {currentCareer.role_title && currentCareer.role_title !== currentCareer.role_label && (
                      <span style={{ fontSize: 13, color: "var(--ink-mute)", marginLeft: 6 }}>({currentCareer.role_label})</span>
                    )}
                    {currentCareer.company_name && isCurrentCompanyKnown && (
                      <> <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>@</span>{" "}
                      <Link href={`/companies/${currentCareer.company_id!}`} style={{ fontSize: 14, color: "var(--royal)", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid var(--royal-100)" }}>{shortCompanyName(currentCareer.company_name)}</Link></>
                    )}
                    {currentCareer.company_name && !isCurrentCompanyKnown && currentCareer.company_name !== "不明な企業" && (
                      <span style={{ fontSize: 14, color: "var(--ink-soft)" }}> @ {shortCompanyName(currentCareer.company_name)}</span>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
                  {ageDisplay && (
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                      </svg>
                      {ageDisplay}
                    </span>
                  )}
                  {owUser.location && (
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 5 }}>
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
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "var(--text-sm)", color: "var(--ink-soft)", padding: "4px 12px 4px 0" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                      <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{careerSummary.companyCount}</strong>社の経験
                    </span>
                    <span style={{ width: 1, height: 14, background: "var(--line)", margin: "0 4px", flexShrink: 0 }} />
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "var(--text-sm)", color: "var(--ink-soft)", padding: "4px 12px" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{careerSummary.totalYears}</strong>年のキャリア
                    </span>
                    {skillTags.length > 0 && (
                      <>
                        <span style={{ width: 1, height: 14, background: "var(--line)", margin: "0 4px", flexShrink: 0 }} />
                        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "var(--text-sm)", color: "var(--ink-soft)", padding: "4px 0 4px 12px" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                          <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{skillTags.length}</strong>スキル
                        </span>
                      </>
                    )}
                  </div>
                )}
                {skillTags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {skillTags.slice(0, 6).map((tag) => {
                      const HEADER_SKILL_COLORS: Record<string, { color: string; bg: string }> = {
                        "技術・開発":    { color: "#2563EB", bg: "#EFF6FF" },
                        "プロダクト・UX": { color: "#7C3AED", bg: "#F3E8FF" },
                        "ビジネス・営業": { color: "var(--success)", bg: "#ECFDF5" },
                        "マーケティング": { color: "#D97706", bg: "#FEF3C7" },
                        "データ・分析":  { color: "#0891B2", bg: "#ECFEFF" },
                        "マネジメント":  { color: "#DC2626", bg: "#FEE2E2" },
                      };
                      const cat = (tag.category as string | null) ?? null;
                      const cs = cat ? (HEADER_SKILL_COLORS[cat] ?? null) : null;
                      return (
                        <span key={tag.id as string} style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "4px 11px", borderRadius: 100,
                          background: cs ? cs.bg : "#fff",
                          border: `1.5px solid ${cs ? cs.color + "44" : "var(--line)"}`,
                          fontSize: 12, color: cs ? cs.color : "var(--ink-soft)", fontWeight: 600,
                          transition: "box-shadow 0.15s",
                        }}>
                          {tag.label as string}
                        </span>
                      );
                    })}
                    {skillTags.length > 6 && (
                      <span style={{
                        display: "inline-flex", alignItems: "center",
                        padding: "4px 11px", borderRadius: 100,
                        background: "var(--bg-tint)", border: "1.5px solid var(--line)",
                        fontSize: 12, color: "var(--ink-mute)", fontWeight: 600,
                      }}>
                        +{skillTags.length - 6}
                      </span>
                    )}
                  </div>
                )}
                {activeSocials.length > 0 && (
                  <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                {/* シェアボタン（オーナー以外のみ表示） */}
                {!viewerIsOwner && (
                  <ProfileShareButton userId={owUser.id} name={owUser.name} />
                )}

                {/* カジュアル面談ボタン（can_casual_meeting = true かつ非オーナー かつ企業が判明） */}
                {!viewerIsOwner && owUser.can_casual_meeting && isCurrentCompanyKnown && (
                  <Link href={`/companies/${currentCareer.company_id}/casual-meeting?person=${owUser.id}`} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 18px", borderRadius: 8,
                    background: "linear-gradient(135deg, #F59E0B 0%, #FB923C 100%)",
                    color: "#fff", fontSize: "var(--text-sm)", fontWeight: 700,
                    textDecoration: "none", flexShrink: 0,
                    boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
                    whiteSpace: "nowrap",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    カジュアル面談する
                  </Link>
                )}

                {viewerIsOwner ? (
                <>
                  <ProfileShareButton userId={owUser.id} name={owUser.name} />
                  <Link href="/profile/edit" style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 18px", borderRadius: 8,
                    border: "1.5px solid var(--line)", background: "#fff",
                    color: "var(--ink-soft)", fontSize: "var(--text-sm)", fontWeight: 600, textDecoration: "none",
                    flexShrink: 0,
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    プロフィールを編集
                  </Link>
                </>
                ) : isCurrentCompanyKnown ? (
                /* 一般社員: 企業ページへの控えめなリンク（会社が判明している場合のみ） */
                <Link href={`/companies/${currentCareer!.company_id!}`} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 18px", borderRadius: 8,
                  border: "1.5px solid var(--royal-100)", background: "var(--royal-50)",
                  color: "var(--royal)", fontSize: "var(--text-sm)", fontWeight: 600, textDecoration: "none",
                  flexShrink: 0,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  {currentCareer!.company_name} の企業ページを見る
                </Link>
              ) : null
              }
              </div>
            </div>
          </div>
        </div>

        {/* Two-column grid: main content | sidebar */}
        <div className="profile-grid">

          {/* ── Main column ─────────────────────────────────────────── */}
          <div>

            {/* ── ハイライト (LinkedIn-style 2-3 cards) ── */}
            {(() => {
              const highlights: { icon: React.ReactNode; label: string; body: React.ReactNode; href?: string; color: string }[] = [];

              // Card 1: カジュアル面談CTA（非オーナー、can_casual_meeting=true かつ企業判明時のみ）
              if (!viewerIsOwner && owUser.can_casual_meeting && isCurrentCompanyKnown) {
                highlights.push({
                  color: "var(--warm)",
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  ),
                  label: "カジュアル面談",
                  body: (
                    <span style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                      {currentCareer!.company_name}のメンバーと<br/>気軽に話してみませんか
                    </span>
                  ),
                  href: `/companies/${currentCareer!.company_id}/casual-meeting?person=${owUser.id}`,
                });
              }

              // Card 2: 最新の発信コンテンツ
              if (contentLinks.length > 0) {
                const latest = contentLinks[0];
                const meta = PLATFORM_META[latest.platform ?? "other"] ?? PLATFORM_META.other;
                highlights.push({
                  color: meta.color,
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                  ),
                  label: meta.label,
                  body: (
                    <span style={{
                      fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {latest.title || latest.url}
                    </span>
                  ),
                  href: latest.url,
                });
              }

              if (highlights.length === 0) return null;

              return (
                <section style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                    ハイライト
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${highlights.length}, 1fr)`, gap: 10 }}>
                    {highlights.map((h, i) => (
                      <a
                        key={i}
                        href={h.href ?? "#"}
                        target={h.href?.startsWith("http") ? "_blank" : undefined}
                        rel={h.href?.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="u-sidebar-link"
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 10,
                          padding: "14px 16px", borderRadius: 12,
                          background: "#fff", border: "1px solid var(--line)",
                          textDecoration: "none", boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
                          transition: "box-shadow 0.15s",
                        }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: h.color,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {h.icon}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink)", marginBottom: 3, letterSpacing: "0.02em" }}>
                            {h.label}
                          </div>
                          {h.body}
                        </div>
                      </a>
                    ))}
                  </div>
                </section>
              );
            })()}

            {/* ── プロフィール完成度ガイド (owners only) ── */}
            {viewerIsOwner && (() => {
              const items = [
                { label: "自己紹介", done: !!owUser.about_me, tab: "basic", icon: "✍️" },
                { label: "職歴", done: timelineCareers.length > 0, tab: "career", icon: "🏢" },
                { label: "スキル", done: skillTags.length > 0, tab: "skills", icon: "⚡" },
                { label: "目指していること", done: !!owUser.future_aspirations, tab: "basic", icon: "🎯" },
                { label: "数値実績", done: achievements.length > 0, tab: "career", icon: "📊" },
                { label: "受賞・表彰", done: awards.length > 0, tab: "career", icon: "🏆" },
                { label: "発信コンテンツ", done: contentLinks.length > 0, tab: "content", icon: "📝" },
                { label: "資格・認定", done: certifications.length > 0, tab: "certs", icon: "🏅" },
              ];
              const completedCount = items.filter((i) => i.done).length;
              const percentage = Math.round((completedCount / items.length) * 100);
              if (percentage === 100) return null;
              return (
                <section style={{
                  background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                  border: "1px solid #fde68a", borderRadius: 14,
                  padding: "18px 22px", marginBottom: 20,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: "var(--space-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                      </svg>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "#92400E" }}>
                        プロフィール完成度 {percentage}%
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ flex: 1, minWidth: 120, height: 6, background: "#FDE68A", borderRadius: 100, overflow: "hidden" }}>
                      <div style={{ width: `${percentage}%`, height: "100%", background: "#D97706", borderRadius: 100, transition: "width 0.4s ease" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {items.filter((i) => !i.done).map((item) => (
                      <Link key={item.tab + item.label} href={`/profile/edit?tab=${item.tab}`} style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "5px 12px", borderRadius: 100,
                        background: "#fff", border: "1px solid #FDE68A",
                        fontSize: 12, color: "#92400E", fontWeight: 600, textDecoration: "none",
                      }}>
                        <span>{item.icon}</span> {item.label}を追加
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })()}

            {/* About Me */}
            {owUser.about_me ? (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "24px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-4)" }}>
                  <span style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    自己紹介
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                </div>
                <div style={{ position: "relative", paddingLeft: 28 }}>
                  {/* Decorative open-quote: Unicode U+201C at large scale — universally rendered */}
                  <span aria-hidden="true" style={{
                    position: "absolute", left: -4, top: -10,
                    fontSize: 56, lineHeight: 1,
                    fontFamily: "Georgia, 'Noto Serif JP', serif",
                    color: "var(--royal-100)",
                    userSelect: "none",
                    fontWeight: 700,
                  }}>
                    {"“"}
                  </span>
                  <p style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.9, whiteSpace: "pre-wrap", margin: 0 }}>
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
                <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-mute)", margin: "0 0 12px" }}>
                  自己紹介を書いて、あなたのことを伝えましょう
                </p>
                <Link href="/profile/edit" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 18px", borderRadius: 8,
                  background: "var(--royal)", color: "#fff",
                  fontSize: "var(--text-sm)", fontWeight: 600, textDecoration: "none",
                }}>
                  プロフィールを編集する →
                </Link>
              </section>
            ) : null}

            {/* ── 数値実績 ── */}
            {achievements.length > 0 && (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "22px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    数値実績
                  </span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    ACHIEVEMENTS
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "var(--space-3)" }}>
                  {achievements.map((a) => (
                    <div key={a.id} style={{
                      textAlign: "center", padding: "18px 12px 14px",
                      border: "1.5px solid var(--royal-100)", borderRadius: 12,
                      background: "linear-gradient(160deg, var(--royal-50) 0%, #fff 100%)",
                      position: "relative", overflow: "hidden",
                    }}>
                      {/* subtle arc decoration */}
                      <div style={{
                        position: "absolute", top: -20, right: -20,
                        width: 60, height: 60, borderRadius: "50%",
                        background: "var(--royal-100)", opacity: 0.4,
                      }} />
                      <div style={{
                        fontFamily: "Inter, sans-serif", fontWeight: 800, color: "var(--royal)",
                        lineHeight: 1, marginBottom: 6,
                        fontSize: a.value && a.value.length > 4 ? 22 : 30,
                      }}>
                        {a.value ?? "—"}
                        {a.unit && (
                          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginLeft: 2, opacity: 0.8 }}>
                            {a.unit}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.4, fontWeight: 600, position: "relative" }}>
                        {a.title}
                      </div>
                      {(a.period_start || a.period_end) && (
                        <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 5, fontFamily: "Inter, sans-serif", position: "relative" }}>
                          {a.period_start ? a.period_start.slice(0, 7) : ""}
                          {a.period_end ? ` 〜 ${a.period_end.slice(0, 7)}` : a.period_start ? " 〜" : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {achievements.filter((a) => a.description).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: 14 }}>
                    {achievements.filter((a) => a.description).map((a) => (
                      <div key={a.id + "_d"} style={{
                        padding: "10px 14px", borderRadius: 8,
                        background: "var(--bg-tint)", border: "1px solid var(--line)",
                        fontSize: "var(--text-sm)", color: "var(--ink-soft)", lineHeight: 1.7,
                      }}>
                        <span style={{ fontWeight: 700, color: "var(--ink)", marginRight: 6 }}>{a.title}:</span>
                        {a.description}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── 受賞・表彰 ── */}
            {awards.length > 0 && (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "22px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    受賞・表彰
                  </span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    AWARDS
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>
                    {awards.length}件
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {awards.map((award, i) => (
                    <div key={award.id} style={{
                      display: "flex", gap: 14, padding: "14px 0",
                      borderTop: i > 0 ? "1px solid var(--line)" : "none",
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                        background: "linear-gradient(135deg, #FBBF24 0%, #D97706 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 2px 8px rgba(217,119,6,0.25)",
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, marginBottom: 4 }}>
                          {award.title}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                          {award.issuer && (
                            <span style={{
                              fontSize: 12, color: "var(--ink-soft)",
                              display: "flex", alignItems: "center", gap: 4,
                            }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                              </svg>
                              {award.issuer}
                            </span>
                          )}
                          {award.awarded_at && (
                            <span style={{
                              fontSize: "var(--text-xs)", color: "var(--ink-mute)",
                              fontFamily: "Inter, sans-serif",
                              background: "var(--bg-tint)", border: "1px solid var(--line)",
                              padding: "1px 7px", borderRadius: 100,
                            }}>
                              {award.awarded_at.slice(0, 7)}
                            </span>
                          )}
                        </div>
                        {award.description && (
                          <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)", margin: "6px 0 0", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                            {award.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── 資格・認定（メインカラム） ── */}
            {certifications.length > 0 && (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "22px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    資格・認定
                  </span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    LICENSES &amp; CERTIFICATIONS
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>
                    {certifications.length}件
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {certifications.map((cert) => (
                    <div key={cert.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: 10,
                      background: "var(--bg-tint)", border: "1px solid var(--line)",
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        background: "linear-gradient(135deg, var(--warm) 0%, #D97706 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 2px 6px rgba(217,119,6,0.2)",
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                          <circle cx="12" cy="8" r="6" />
                          <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                        </svg>
                      </div>
                      <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 600, lineHeight: 1.4 }}>
                        {cert.name}
                      </span>
                    </div>
                  ))}
                </div>
                {viewerIsOwner && (
                  <Link href="/profile/edit?tab=certs" style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    marginTop: 14, fontSize: 12, color: "var(--royal)", fontWeight: 600, textDecoration: "none",
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    資格を追加
                  </Link>
                )}
              </section>
            )}

            {/* ── 職歴セクション ── */}
            {timelineCareers.length > 0 && (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "24px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    職歴
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                </div>

                <MergedTimeline
                  careers={timelineCareers}
                  educations={[]}
                  future={null}
                  viewerIsOwner={viewerIsOwner}
                  collapseAfter={4}
                />
              </section>
            )}

            {/* ── 学歴セクション ── */}
            {timelineEdus.length > 0 && (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "24px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    学歴
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                </div>
                <MergedTimeline
                  careers={[]}
                  educations={timelineEdus}
                  future={null}
                  viewerIsOwner={viewerIsOwner}
                />
              </section>
            )}

            {/* ── スキル・専門性 (LinkedIn順: 学歴の直後) ── */}
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
                {(() => {
                  const CATEGORY_ORDER = ["技術・開発", "プロダクト・UX", "ビジネス・営業", "マーケティング", "データ・分析", "マネジメント", "その他"];
                  const CATEGORY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
                    "技術・開発":    { color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
                    "プロダクト・UX": { color: "#7C3AED", bg: "#F3E8FF", border: "#DDD6FE" },
                    "ビジネス・営業": { color: "var(--success)", bg: "#ECFDF5", border: "#A7F3D0" },
                    "マーケティング": { color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
                    "データ・分析":  { color: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC" },
                    "マネジメント":  { color: "#DC2626", bg: "#FEE2E2", border: "#FECACA" },
                    "その他":        { color: "var(--ink-soft)", bg: "var(--bg-tint)", border: "var(--line)" },
                  };
                  const grouped = new Map<string, typeof skillTags>();
                  const uncategorized: typeof skillTags = [];
                  for (const tag of skillTags) {
                    const cat = (tag.category as string | null) ?? null;
                    if (!cat) { uncategorized.push(tag); continue; }
                    if (!grouped.has(cat)) grouped.set(cat, []);
                    grouped.get(cat)!.push(tag);
                  }
                  if (uncategorized.length > 0) grouped.set("その他", [...(grouped.get("その他") ?? []), ...uncategorized]);
                  const hasGroups = grouped.size > 1 || (grouped.size === 1 && !grouped.has("その他"));
                  if (!hasGroups) {
                    return (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                        {skillTags.map((tag) => (
                          <span key={tag.id as string} style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "7px 14px", borderRadius: 8,
                            background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                            fontSize: "var(--text-sm)", color: "var(--royal)", fontWeight: 600,
                          }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {tag.label as string}
                          </span>
                        ))}
                      </div>
                    );
                  }
                  const groupedKeys = Array.from(grouped.keys());
                  const orderedKeys = [...CATEGORY_ORDER.filter((k) => grouped.has(k)), ...groupedKeys.filter((k) => !CATEGORY_ORDER.includes(k))];
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                      {orderedKeys.map((cat) => {
                        const tags = grouped.get(cat)!;
                        const style = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS["その他"];
                        return (
                          <div key={cat}>
                            <div style={{
                              fontSize: "var(--text-xs)", fontWeight: 700, color: style.color,
                              letterSpacing: "0.06em", marginBottom: "var(--space-2)",
                              display: "flex", alignItems: "center", gap: 6,
                            }}>
                              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: style.color, flexShrink: 0 }} />
                              {cat}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                              {tags.map((tag) => (
                                <span key={tag.id as string} style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "6px 12px", borderRadius: 8,
                                  background: style.bg, border: `1px solid ${style.border}`,
                                  fontSize: 12, color: style.color, fontWeight: 600,
                                }}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  {tag.label as string}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </section>
            )}

            {/* ── アクティビティ（投稿フォーム + 最近の投稿） ── */}
            {(viewerIsOwner || recentPostsTyped.length > 0) && (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "22px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    アクティビティ
                  </span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    ACTIVITY
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                  {recentPostsTyped.length > 0 && (
                    <span style={{ fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: 600, color: "var(--ink-mute)" }}>
                      {recentPostsTyped.length}件
                    </span>
                  )}
                </div>

                {/* 投稿フォーム（オーナーのみ） */}
                {viewerIsOwner && (
                  <PostComposer
                    avatarColor={avatarColor}
                    initial={initial}
                    avatarUrl={owUser.avatar_url}
                  />
                )}

                {/* 投稿リスト */}
                {recentPostsTyped.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {recentPostsTyped.map((post) => (
                      <PostCard
                        key={post.id}
                        post={{
                          id: post.id,
                          content: post.content,
                          image_url: post.image_url,
                          created_at: post.created_at,
                          likeCount: post.likes[0]?.count ?? 0,
                          isLiked: likedPostIds.has(post.id),
                          isOwner: viewerIsOwner,
                        }}
                      />
                    ))}
                  </div>
                ) : viewerIsOwner ? (
                  <div style={{ textAlign: "center", padding: "16px 0 4px", color: "var(--ink-mute)", fontSize: 13 }}>
                    まだ投稿がありません。近況や知見を発信してみましょう！
                  </div>
                ) : null}
              </section>
            )}

            {/* ── メディア掲載 ── */}
            {mediaAppearances.length > 0 && (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "22px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    メディア掲載
                  </span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    MEDIA
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {mediaAppearances.map((m) => {
                    const inner = (
                      <>
                        {/* Thumbnail or placeholder */}
                        <div style={{
                          width: 52, height: 52, borderRadius: 8, flexShrink: 0,
                          background: m.thumbnail_url ? undefined : "linear-gradient(135deg, #334155, #6b7280)",
                          overflow: "hidden",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {m.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round">
                              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                            </svg>
                          )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                            {m.media_name && (
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                                background: "var(--bg-tint)", color: "var(--ink-soft)", border: "1px solid var(--line)",
                              }}>
                                {m.media_name}
                              </span>
                            )}
                            {m.appeared_at && (
                              <span style={{ fontSize: 10, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                                {m.appeared_at.slice(0, 7)}
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: "var(--text-sm)", fontWeight: 600, color: m.url ? "var(--royal)" : "var(--ink)", lineHeight: 1.5,
                            overflow: "hidden", display: "-webkit-box",
                            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                          }}>
                            {m.title}
                          </div>
                          {m.description && (
                            <div style={{
                              fontSize: "var(--text-xs)", color: "var(--ink-mute)", marginTop: 3, lineHeight: 1.5,
                              overflow: "hidden", display: "-webkit-box",
                              WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
                            }}>
                              {m.description}
                            </div>
                          )}
                        </div>
                        {m.url && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        )}
                      </>
                    );
                    return m.url ? (
                      <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" style={{
                        display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                        padding: "12px", borderRadius: 10,
                        border: "1px solid var(--line)", background: "var(--bg-tint)",
                        textDecoration: "none", transition: "border-color 0.15s",
                      }}>
                        {inner}
                      </a>
                    ) : (
                      <div key={m.id} style={{
                        display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                        padding: "12px", borderRadius: 10,
                        border: "1px solid var(--line)", background: "var(--bg-tint)",
                      }}>
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── OPINIO掲載記事 ── */}
            {featuredArticles.length > 0 && (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "22px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    OPINIO掲載記事
                  </span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    FEATURED
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {featuredArticles.map((article) => (
                    <Link
                      key={article.id}
                      href={`/articles/${article.slug}`}
                      style={{ textDecoration: "none", display: "flex", gap: 14, alignItems: "flex-start",
                        padding: "12px", borderRadius: 10, border: "1px solid var(--line)",
                        background: "var(--bg-tint)", transition: "border-color 0.15s",
                      }}
                    >
                      {/* Eyecatch gradient strip */}
                      <div style={{
                        width: 56, height: 56, borderRadius: 8, flexShrink: 0,
                        background: article.eyecatch_gradient ?? "linear-gradient(135deg, var(--royal), var(--accent))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          {article.type && ARTICLE_TYPE_LABEL[article.type] && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                              background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)",
                            }}>
                              {ARTICLE_TYPE_LABEL[article.type]}
                            </span>
                          )}
                          {article.read_min && (
                            <span style={{ fontSize: 10, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                              {article.read_min}分で読める
                            </span>
                          )}
                        </div>
                        <div style={{
                          fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)", lineHeight: 1.5,
                          overflow: "hidden", display: "-webkit-box",
                          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        }}>
                          {article.title}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* ── 推薦文 (LinkedIn Recommendations) ── */}
            {(recommendations.length > 0 || (!viewerIsOwner && !!authUser)) && (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "22px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    推薦文
                  </span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    RECOMMENDATIONS
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                  {recommendations.length > 0 && (
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>
                      {recommendations.filter((r) => r.is_visible).length}件
                    </span>
                  )}
                </div>

                {/* 推薦文カード一覧 */}
                {recommendations.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: !viewerIsOwner && !!authUser ? 16 : 0 }}>
                    {recommendations.map((rec) => (
                      <RecommendationCard
                        key={rec.id}
                        rec={rec}
                        isOwner={viewerIsOwner}
                      />
                    ))}
                  </div>
                )}

                {/* 推薦文を書くフォーム（ログイン済み非オーナーのみ） */}
                {!viewerIsOwner && !!authUser && (
                  <RecommendationForm
                    targetUserId={owUser.id}
                    targetName={owUser.name}
                    defaultName=""
                    defaultTitle=""
                    defaultCompany=""
                  />
                )}

                {/* 非ログイン向け案内 */}
                {!viewerIsOwner && !authUser && recommendations.length === 0 && (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "var(--ink-mute)", fontSize: 13 }}>
                    まだ推薦文がありません
                  </div>
                )}
              </section>
            )}

            {/* ── 発信コンテンツ (外部リンク) ── */}
            {(contentLinks.length > 0 || viewerIsOwner) && (
              <section style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "22px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-4)" }}>
                  <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    発信コンテンツ
                  </span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    CONTENT
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                  {viewerIsOwner && (
                    <Link href="/profile/edit" style={{
                      fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--royal)",
                      textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      追加
                    </Link>
                  )}
                </div>

                {contentLinks.length === 0 && viewerIsOwner && (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: "var(--space-2)" }}>
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "0 0 10px" }}>
                      note・Zenn・YouTube等の発信URLを登録しましょう
                    </p>
                    <Link href="/profile/edit" style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "7px 16px", borderRadius: 8,
                      background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                      color: "var(--royal)", fontSize: 12, fontWeight: 600, textDecoration: "none",
                    }}>
                      コンテンツを追加する →
                    </Link>
                  </div>
                )}

                {/* 横並びリスト（LinkedIn Featured 風） */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {contentLinks.map((link) => {
                    const meta = PLATFORM_META[link.platform ?? "other"] ?? PLATFORM_META.other;
                    return (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="u-content-card"
                        style={{
                          display: "flex", alignItems: "center", gap: 14,
                          borderRadius: 12,
                          border: "1px solid var(--line)",
                          background: "#fff",
                          textDecoration: "none",
                          padding: "12px 14px",
                          transition: "box-shadow 0.15s, transform 0.15s",
                          boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
                          minWidth: 0,
                        }}
                      >
                        {/* サムネイル or プラットフォームカラーアイコン */}
                        <div style={{
                          width: 64, height: 64, borderRadius: 10, flexShrink: 0, overflow: "hidden",
                          background: link.thumbnail_url
                            ? undefined
                            : `linear-gradient(135deg, ${meta.color}18 0%, ${meta.color}38 100%)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {link.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={link.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="1.8" strokeLinecap="round">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                          )}
                        </div>

                        {/* テキスト情報 */}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          {/* プラットフォームバッジ */}
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                            background: meta.bg, color: meta.color,
                            marginBottom: 5,
                          }}>
                            {meta.label}
                          </span>
                          {/* タイトル */}
                          <div style={{
                            fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5,
                            overflow: "hidden", display: "-webkit-box",
                            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                          }}>
                            {link.title || link.url}
                          </div>
                          {/* 説明 */}
                          {link.description && (
                            <div style={{
                              fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.5, marginTop: 3,
                              overflow: "hidden", display: "-webkit-box",
                              WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
                            }}>
                              {link.description}
                            </div>
                          )}
                        </div>

                        {/* 外部リンクアイコン */}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    );
                  })}
                </div>
              </section>
            )}

          </div>{/* /main column */}

          {/* ── Sidebar ─────────────────────────────────────────────── */}
          <aside className="profile-sidebar">
            <div className="profile-sidebar-sticky" style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

              {/* Current company card — 企業ページへ + カジュアル面談CTA */}
              {currentCareer && currentCareer.company_id && (
                <div style={{
                  background: "#fff", border: "1px solid var(--line)",
                  borderRadius: 14, padding: "18px 20px",
                  boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
                }}>
                  <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.08em", marginBottom: "var(--space-3)", textTransform: "uppercase" }}>
                    在籍企業
                  </div>
                  {/* Company link — 企業が判明している場合のみリンク化 */}
                  {isCurrentCompanyKnown ? (
                  <Link href={`/companies/${currentCareer.company_id}`} style={{
                    textDecoration: "none", display: "flex", alignItems: "center", gap: "var(--space-3)",
                    marginBottom: "var(--space-3)",
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                      background: currentCareer.logo_gradient ?? "linear-gradient(135deg, var(--royal), #3B5FD9)",
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
                        {shortCompanyName(currentCareer.company_name)}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {currentCareer.role_label}
                      </div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                  ) : (
                  /* 企業不明: 非リンク表示 */
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                      background: "linear-gradient(135deg, #64748b, #94a3b8)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 2 }}>
                        非公開企業
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                        {currentCareer.role_label}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* 在籍期間 + フェーズ */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: !viewerIsOwner ? 10 : 0 }}>
                    {currentCareerTenure && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: "var(--text-xs)", color: "var(--ink-mute)",
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
                        fontSize: "var(--text-xs)", color: "var(--royal)",
                        background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                        padding: "2px 8px", borderRadius: 100, fontWeight: 600,
                      }}>
                        {currentCompanyPhase}
                      </span>
                    )}
                  </div>

                  {/* カジュアル面談CTA — can_casual_meeting=true の人のみ表示（非オーナー） */}
                  {!viewerIsOwner && owUser.can_casual_meeting && isCurrentCompanyKnown && (
                    <>
                      <div style={{ height: 1, background: "var(--line)", margin: "0 0 14px" }} />
                      <Link href={`/companies/${currentCareer.company_id}/casual-meeting?person=${owUser.id}`} style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        padding: "10px 14px", borderRadius: 8,
                        background: "linear-gradient(135deg, var(--warm) 0%, #D97706 100%)",
                        color: "#fff", fontSize: "var(--text-sm)", fontWeight: 700, textDecoration: "none",
                        boxShadow: "0 2px 10px rgba(245,158,11,0.25)",
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        カジュアル面談を申し込む
                      </Link>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-mute)", textAlign: "center", margin: "8px 0 0", lineHeight: 1.5 }}>
                        担当者が返信します
                      </p>
                    </>
                  )}

                  {/* 募集中求人リスト */}
                  {currentCompanyJobs.length > 0 && (
                    <>
                      <div style={{ height: 1, background: "var(--line)", margin: "14px 0 12px" }} />
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.06em", marginBottom: "var(--space-2)" }}>
                        募集中の求人 {currentCompanyJobs.length}件
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {currentCompanyJobs.map((job) => (
                          <Link key={job.id} href={`/jobs/${job.id}`} style={{
                            display: "flex", alignItems: "center", gap: "var(--space-2)",
                            padding: "7px 10px", borderRadius: 7,
                            background: "var(--bg-tint)", border: "1px solid var(--line)",
                            textDecoration: "none",
                          }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                            </svg>
                            <span style={{
                              fontSize: 12, color: "var(--ink)", fontWeight: 500,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {job.title}
                            </span>
                          </Link>
                        ))}
                      </div>
                      <Link href={`/companies/${currentCareer.company_id}`} style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                        marginTop: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--royal)", fontWeight: 600, textDecoration: "none",
                      }}>
                        すべての求人を見る →
                      </Link>
                    </>
                  )}
                </div>
              )}

              {/* StrengthsFinder — column not yet in DB, hidden until data exists */}
              {(null as string[] | null)?.length && (() => {
                const DOMAIN_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
                  // 実行力
                  "達成欲": { label: "実行力", color: "#7C3AED", bg: "#F3E8FF", border: "#DDD6FE" },
                  "アレンジ": { label: "実行力", color: "#7C3AED", bg: "#F3E8FF", border: "#DDD6FE" },
                  "信念": { label: "実行力", color: "#7C3AED", bg: "#F3E8FF", border: "#DDD6FE" },
                  "公平性": { label: "実行力", color: "#7C3AED", bg: "#F3E8FF", border: "#DDD6FE" },
                  "慎重さ": { label: "実行力", color: "#7C3AED", bg: "#F3E8FF", border: "#DDD6FE" },
                  "規律性": { label: "実行力", color: "#7C3AED", bg: "#F3E8FF", border: "#DDD6FE" },
                  "集中力": { label: "実行力", color: "#7C3AED", bg: "#F3E8FF", border: "#DDD6FE" },
                  "責任感": { label: "実行力", color: "#7C3AED", bg: "#F3E8FF", border: "#DDD6FE" },
                  "回復志向": { label: "実行力", color: "#7C3AED", bg: "#F3E8FF", border: "#DDD6FE" },
                  // 影響力
                  "活発性": { label: "影響力", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
                  "指揮": { label: "影響力", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
                  "コミュニケーション": { label: "影響力", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
                  "競争性": { label: "影響力", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
                  "最上志向": { label: "影響力", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
                  "自己確信": { label: "影響力", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
                  "自我": { label: "影響力", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
                  "社交性": { label: "影響力", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
                  // 人間関係構築
                  "適応性": { label: "関係構築", color: "var(--success)", bg: "#ECFDF5", border: "#A7F3D0" },
                  "つながり": { label: "関係構築", color: "var(--success)", bg: "#ECFDF5", border: "#A7F3D0" },
                  "成長促進": { label: "関係構築", color: "var(--success)", bg: "#ECFDF5", border: "#A7F3D0" },
                  "共感": { label: "関係構築", color: "var(--success)", bg: "#ECFDF5", border: "#A7F3D0" },
                  "調和性": { label: "関係構築", color: "var(--success)", bg: "#ECFDF5", border: "#A7F3D0" },
                  "包含": { label: "関係構築", color: "var(--success)", bg: "#ECFDF5", border: "#A7F3D0" },
                  "個別化": { label: "関係構築", color: "var(--success)", bg: "#ECFDF5", border: "#A7F3D0" },
                  "ポジティブ": { label: "関係構築", color: "var(--success)", bg: "#ECFDF5", border: "#A7F3D0" },
                  "親密性": { label: "関係構築", color: "var(--success)", bg: "#ECFDF5", border: "#A7F3D0" },
                  // 戦略的思考
                  "分析思考": { label: "戦略思考", color: "var(--royal)", bg: "#EFF3FC", border: "#DCE5F7" },
                  "文脈": { label: "戦略思考", color: "var(--royal)", bg: "#EFF3FC", border: "#DCE5F7" },
                  "未来志向": { label: "戦略思考", color: "var(--royal)", bg: "#EFF3FC", border: "#DCE5F7" },
                  "着想": { label: "戦略思考", color: "var(--royal)", bg: "#EFF3FC", border: "#DCE5F7" },
                  "収集心": { label: "戦略思考", color: "var(--royal)", bg: "#EFF3FC", border: "#DCE5F7" },
                  "内省": { label: "戦略思考", color: "var(--royal)", bg: "#EFF3FC", border: "#DCE5F7" },
                  "学習欲": { label: "戦略思考", color: "var(--royal)", bg: "#EFF3FC", border: "#DCE5F7" },
                  "戦略性": { label: "戦略思考", color: "var(--royal)", bg: "#EFF3FC", border: "#DCE5F7" },
                };
                const strengths: string[] = [];
                return (
                  <div style={{
                    background: "#fff", border: "1px solid var(--line)",
                    borderRadius: 14, padding: "18px 20px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        StrengthsFinder
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {strengths.map((sName: string, idx: number) => {
                        const name = sName;
                        const domain = DOMAIN_MAP[name];
                        return (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {/* 順位バッジ */}
                            <div style={{
                              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                              background: domain ? domain.color : "var(--ink-mute)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 700, color: "#fff",
                              fontFamily: "Inter, sans-serif",
                            }}>
                              {idx + 1}
                            </div>
                            {/* 資質名 */}
                            <span style={{
                              fontSize: "var(--text-sm)", fontWeight: 600,
                              color: domain ? domain.color : "var(--ink)",
                              flex: 1,
                            }}>
                              {name}
                            </span>
                            {/* ドメインバッジ */}
                            {domain && (
                              <span style={{
                                fontSize: 10, fontWeight: 600,
                                color: domain.color,
                                background: domain.bg,
                                border: `1px solid ${domain.border}`,
                                padding: "1px 6px", borderRadius: 100,
                                whiteSpace: "nowrap",
                              }}>
                                {domain.label}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Certifications */}
              {certifications.length > 0 && (
                <div style={{
                  background: "#fff", border: "1px solid var(--line)",
                  borderRadius: 14, padding: "18px 20px",
                }}>
                  <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--royal)", letterSpacing: "0.08em", marginBottom: "var(--space-3)", textTransform: "uppercase" }}>
                    資格・認定
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
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
