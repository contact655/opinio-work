import { notFound } from "next/navigation";
import { permanentRedirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { type SocialPlatform } from "@/components/SocialIcon";
import MergedTimeline from "@/components/profile/MergedTimeline";
import { PostComposer } from "@/components/profile/PostComposer";
import { canUserPost } from "@/lib/feed/canPost";
import { PostCard } from "@/components/profile/PostCard";
import {
  buildTimelineCareerEntriesFromRaw,
  toTimelineEducationEntries,
  type RawExperienceRow,
  type RawEducation,
  type CompanyLogoInfo,
} from "@/lib/utils/timeline";
import { getUserAge } from "@/lib/age";
import { filterOpenCasualMeetingCompanies } from "@/lib/company/casualMeeting";
import { ProfileShareButton } from "@/components/profile/ProfileShareButton";
import { FollowUserButton } from "./FollowUserButton";
import { FollowCounts } from "@/components/profile/FollowCounts";
import { getFollowCounts } from "@/lib/people/followCounts";
import { ProfileNavClient } from "@/components/profile/ProfileNavClient";
import { DMButton } from "@/components/profile/DMButton";
/* ⚠️ 各セクションの見た目は `components/profile/view/` に移した（2026-08-16）。
      `/mypage` のプロフィールが同じものを使う。**ここに書き戻さないこと。** */
import {
  ProfileAboutSection,
  ProfileAchievementsSection,
  ProfileAwardsSection,
  ProfileMediaSection,
  ProfileTimelineSection,
  ProfileArticlesSection,
  ProfileContentLinksSection,
  ProfileSocialLinks,
} from "@/components/profile/view/ProfileSections";
import { PLATFORM_META } from "@/lib/profile/platformMeta";

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
  location: string | null;
  social_links: SocialLinks | null;
  headline: string | null;
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


// ─── Page ─────────────────────────────────────────────────────────────────────

const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveUserId(slugOrId: string): Promise<{ resolvedId: string; username: string | null } | null> {
  const admin = createAdminClient();
  const isUUID = IS_UUID.test(slugOrId);
  const q = admin.from("ow_users").select("id, username").limit(1);
  const { data } = await (isUUID ? q.eq("id", slugOrId) : q.eq("username", slugOrId));
  const row = data?.[0];
  if (!row) return null;
  return { resolvedId: row.id as string, username: (row.username as string | null) ?? null };
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const resolved = await resolveUserId(params.id);
  if (!resolved) return { title: { absolute: "プロフィール | OPINIO" } };
  const supabase = createClient();
  const { data } = await supabase.from("ow_users").select("name").eq("id", resolved.resolvedId).maybeSingle();
  const title = data ? `${data.name} | OPINIO` : "プロフィール | OPINIO";
  const canonicalId = resolved.username ?? resolved.resolvedId;
  return {
    title: { absolute: title },
    alternates: { canonical: `/u/${canonicalId}` },
    openGraph: { title },
    robots: { index: false, follow: false },
  };
}

export default async function UserProfilePage({ params }: { params: { id: string } }) {
  // Phase 1: username or UUID → resolvedId
  const resolved = await resolveUserId(params.id);
  if (!resolved) notFound();

  const { resolvedId, username: profileUsername } = resolved;

  // UUID → username redirect (308)
  if (IS_UUID.test(params.id) && profileUsername) {
    permanentRedirect(`/u/${profileUsername}`);
  }

  const supabase = createClient();
  const adminSupabase = createAdminClient();

  // Phase 2: RLS チェック付きで全フィールド取得（visibility フィルタ適用）
  const [
    { data: { user: authUser } },
    { data: user },
  ] = await Promise.all([
    supabase.auth.getUser(),
    /*
      ⚠️ ここは **session クライアントのまま**にする。
         visibility='login_only' / 'private' を RLS で弾いて 404 にする判定が
         この1本に乗っており、admin に変えると非公開プロフィールが誰でも開ける。
      ⚠️ ただし birth_date は authenticated から読めなくなったので、
         この select からは外し、年齢だけ下で admin から取り直す。
    */
    supabase
      .from("ow_users")
      .select("id, name, headline, avatar_color, avatar_url, cover_color, cover_photo_url, about_me, location, social_links, future_aspirations, is_open_to_work, can_casual_meeting, auth_id")
      .eq("id", resolvedId)
      .maybeSingle(),
  ]);

  // visibility = 'login_only' → anon は null が返る → 404
  // visibility = 'private'   → 本人以外 null が返る → 404
  if (!user) notFound();

  const owUser = user as OwUser;

  const avatarColor = owUser.avatar_color ?? "linear-gradient(135deg, var(--royal), #3B5FD9)";
  // cover_color が未設定の場合はアバターカラーをカバーに流用（色統一・個性化）
  const coverColor = owUser.cover_color ?? owUser.avatar_color ?? "linear-gradient(135deg, var(--royal), #3B5FD9, #818CF8)";
  const initial = owUser.name.charAt(0);
  const viewerIsOwner = !!authUser && owUser.auth_id === authUser.id;
  /* ⚠️ ここは互いに依存しないので**1往復にまとめる**（2026-08-09）。
        以前は4本を順番に await していて、そのぶん TTFB が伸びていた。
        ぶら下がるのは「フォロー状態」だけで、これは閲覧者の ow_users.id が
        決まらないと引けないため下に残す。

     ⚠️ 閲覧者の ow_users.id はこの1回だけ引く。以前は :167 と :287 の
        **2箇所で同じ行を別々に引いていた**（admin と session でクライアントが
        違うだけで、取っている行は同一）。 */
  const [viewerCanPost, followCounts, viewerRowRes, birthRes] = await Promise.all([
    // 投稿できる人か。オーナー本人のときだけ問い合わせる（他人には出さないので不要）
    viewerIsOwner ? canUserPost(adminSupabase, owUser.id) : Promise.resolve(false),
    // フォロー数。0 のときは FollowCounts 側で行ごと落とすのでここでは素通し。
    getFollowCounts(owUser.id),
    // 閲覧者自身の ow_users.id（本人の行なので admin で引いても見える範囲は広がらない）
    authUser
      ? adminSupabase.from("ow_users").select("id").eq("auth_id", authUser.id).maybeSingle()
      : Promise.resolve({ data: null as { id: string } | null }),
    /* 年齢表示: birth_date をサーバ側で計算（NULL = 非公開）
       ⚠️ birth_date は admin で取り直す。authenticated から SELECT 権限を剥がしたため。
          上の RLS 判定（404 になるかどうか）は既に通過しているので、
          ここで admin を使っても見せる範囲は広がらない。 */
    adminSupabase.from("ow_users").select("birth_date").eq("id", resolvedId).maybeSingle(),
  ]);

  /** 閲覧者自身の ow_users.id。未ログインなら null。以降で使い回す */
  const viewerOwUserId = (viewerRowRes.data?.id as string | undefined) ?? null;

  // フォロー状態。本人・未ログインには問い合わせない（どちらもボタンを出さないか、
  // 出しても押した時点で /auth に飛ばすため）。
  let isFollowingUser = false;
  if (viewerOwUserId && !viewerIsOwner) {
    const { data: fol } = await adminSupabase
      .from("ow_user_follows")
      .select("id")
      .eq("follower_user_id", viewerOwUserId)
      .eq("target_user_id", owUser.id)
      .maybeSingle();
    isFollowingUser = !!fol;
  }

  const { data: birthRow, error: birthErr } = birthRes;
  if (birthErr) console.error("[u/[id]] birth_date", birthErr.message);
  const birthDate = (birthRow?.birth_date as string | null) ?? null;
  const age = getUserAge(birthDate);
  const ageDisplay = age !== null ? `${age}歳` : null;

  /* ⚠️ 抽出と並び順は `ProfileSocialLinks` が持つ（2026-08-16 に切り出し）。
        ここで `activeSocials` を作り直さないこと。 */
  const socialLinks = owUser.social_links ?? {};

  // Fetch experiences + educations + content links + achievements + awards + media in parallel
  const [
    { data: expRows }, { data: allRoles },
    { data: educationsRaw }, { data: contentLinksRaw },
    { data: achievementsRaw }, { data: awardsRaw }, { data: mediaAppearancesRaw },
    { data: recentPostsRaw },
  ] = await Promise.all([
    /*
      ⚠️ 職歴は adminSupabase で引く。join_reason は 2026-08-06 に
         authenticated から SELECT 権限を剥がしたため、session では読めない。
      ⚠️ visibility_reason の判定は下（:292 付近）にそのまま残してある。
         「公開したい人の入社理由は出す」を成立させるには、
         列を読める権限と、公開/非公開の判定の両方が要る。
         RLS は行しか見られないので、判定はアプリ側に置くしかない。
    */
    adminSupabase
      .from("ow_experiences")
      /*
        ⚠️ department / rank / employment_type は 2026-08-15 に足した。
           3列とも `RawExperienceRow` にも `CareerEntry` にも元から定義があり、
           MergedTimeline 側に描画コードまで書かれていたが、
           **この SELECT に無かったので一度も表示されたことがなかった**
           （employment_type は同社グループのヘッダーバッジ）。
           admin クライアントで引いているので列単位 GRANT の制約は受けない。
      */
      .select("id, company_id, company_text, company_anonymized, role_category_id, role_title, department, rank, employment_type, started_at, ended_at, is_current, description, join_reason, visibility_company, visibility_salary, visibility_reason, visibility_company_profile")
      .eq("user_id", owUser.id)
      .order("is_current", { ascending: false })
      .order("started_at", { ascending: false }),
    supabase.from("ow_roles").select("id, name, parent_id"),
    /*
      ⚠️ 学歴は adminSupabase で引く。2026-08-06 に anon から
         ow_user_educations の SELECT 権限を剥がしたため、
         session クライアントのままだと**未ログイン閲覧で学歴が丸ごと消える**。
         このページに到達している時点で ow_users の RLS を通過しており
         （login_only / private は上で notFound）、対象は owUser.id に固定なので
         admin で引いても見せる範囲は変わらない。
      ⚠️ 現時点で visibility='public' のユーザーは0名なので未ログイン閲覧は起きないが、
         1人でも public にした瞬間に露見する類の壊れ方なので先に寄せておく。
    */
    adminSupabase
      .from("ow_user_educations")
      .select(`id, school, school_id, faculty, degree, enrolled_at, graduated_at, is_current, sort_order, school_master:ow_schools!school_id(id, name, logo_letter, logo_gradient, logo_url)`)
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    /* ⚠️ 実績・受賞・メディア掲載・発信コンテンツは **admin クライアントで引く**（2026-08-15）。
          RLS の SELECT を own + admin に絞ったので、session クライアントでは
          **他人のページで0件になる**（HTTP は 200 のまま中身だけ消える）。
          学歴（250行目）が先に同じ形になっており、この4つが取り残されていた。 */
    adminSupabase
      .from("ow_user_content_links")
      .select("id, url, platform, title, description, thumbnail_url, sort_order")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    adminSupabase
      .from("ow_user_achievements")
      .select("id, title, value, unit, description, period_start, period_end, sort_order")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    adminSupabase
      .from("ow_user_awards")
      .select("id, title, issuer, awarded_at, description, sort_order")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    adminSupabase
      .from("ow_user_media_appearances")
      .select("id, title, media_name, url, thumbnail_url, appeared_at, description, sort_order")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("ow_posts_visible")
      .select("id, content, image_url, created_at, likes:ow_post_likes(count)")
      .eq("user_id", owUser.id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const educations     = (educationsRaw     ?? []) as Education[];
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
  /* ログインユーザーがいいねしている投稿ID一覧。
     ⚠️ 閲覧者の ow_users.id は上で1回引いたものを使い回す。
        ここで auth_id から引き直さないこと（2026-08-09 まで同じ行を2回引いていた）。 */
  const likedPostIds = new Set<string>();
  if (viewerOwUserId && recentPostsTyped.length > 0) {
    const { data: likedRows } = await supabase
      .from("ow_post_likes")
      .select("post_id")
      .eq("user_id", viewerOwUserId)
      .in("post_id", recentPostsTyped.map((p) => p.id));
    for (const r of likedRows ?? []) likedPostIds.add(r.post_id as string);
  }

  // ロール情報 Map（職種名 + 親カテゴリ名）
  const roleByIdRaw = new Map<string, { name: string; parent_id: string | null }>();
  for (const role of (allRoles ?? []) as { id: string; name: string; parent_id: string | null }[]) {
    roleByIdRaw.set(role.id, { name: role.name, parent_id: role.parent_id });
  }
  const roleInfoById = new Map(
    Array.from(roleByIdRaw.entries()).map(([id, r]) => [
      id,
      {
        name: r.name,
        parent_name: r.parent_id ? (roleByIdRaw.get(r.parent_id)?.name ?? null) : null,
      },
    ])
  );

  // visibility_reason=false の場合のみ join_reason を除外（プロフィール・軌跡共通設定）
  // visibility_company_profile は buildTimelineCareerEntriesFromRaw が isOwner で制御する
  const processedExpRows = (expRows ?? []).map((r) => {
    const vr = (r as { visibility_reason?: boolean }).visibility_reason ?? true;
    return vr ? r : { ...r, join_reason: null };
  });

  // Resolve company info for ALL master entries（masked 時も業種・フェーズを使って代替テキスト生成する）
  const allCompanyIds = Array.from(
    new Set(processedExpRows.filter((r) => r.company_id).map((r) => r.company_id as string))
  );

  const companyInfoById = new Map<string, CompanyLogoInfo>();
  /** company_id → slug（null 可）。`/jobs?company=` を組むためだけに持つ */
  const companySlugById = new Map<string, string | null>();
  if (allCompanyIds.length > 0) {
    // adminSupabase を使い is_published=false の企業名も取得（プロフィール表示用）
    const { data: expCompanies } = await adminSupabase
      .from("ow_companies")
      /* ⚠️ slug は `/jobs?company=` を組むために足した（2026-08-15）。
            CompanyLogoInfo には載せない（タイムライン側では使わないため）。 */
      .select("id, slug, name, logo_url, logo_letter, logo_gradient, industry, phase, employee_count, is_published")
      .in("id", allCompanyIds);
    for (const c of expCompanies ?? []) {
      companySlugById.set(c.id as string, (c.slug as string | null) ?? null);
      companyInfoById.set(c.id as string, {
        name: c.name as string,
        logoUrl: (c.logo_url as string | null) ?? null,
        logoLetter: (c.logo_letter as string | null) ?? null,
        logoGradient: (c.logo_gradient as string | null) ?? null,
        industry: (c.industry as string | null) ?? null,
        phase: (c.phase as string | null) ?? null,
        employee_count: (c.employee_count as number | null) ?? null,
        isPublished: (c.is_published as boolean) ?? false,
      });
    }
  }

  // MergedTimeline 用データ整形（isOwner=true なら visibility_company_profile を無視して実名表示）
  const timelineCareers = buildTimelineCareerEntriesFromRaw(
    processedExpRows as unknown as RawExperienceRow[],
    roleInfoById,
    companyInfoById,
    viewerIsOwner,
  );
  const timelineEdus    = toTimelineEducationEntries(educations as RawEducation[]);

  // Current company for sidebar card（company_id の有無は問わない — 在籍中なら表示）
  const currentCareer = timelineCareers.find((c) => c.is_current) ?? null;
  // timeline.ts が company_id を null にするのは「ow_companies に未登録」の場合のみ
  // → company_id が非 null = 企業ページへのリンクが有効
  const isCurrentCompanyKnown = !!currentCareer?.company_id;

  /* ⚠️ 面談CTAは「企業が判明している」だけでは出さない（2026-08-11）。
        在籍企業が面談を受け付けていない（＝宛先が無い）と、押した先が
        「受け付けていません」になる。
        ⚠️ 2026-08-11 時点では実害が出ていなかった。在籍企業が受付停止の3人は
           たまたま全員 can_casual_meeting = false で、既存の条件に救われていた。
           **その偶然に頼らない。** 片方が true になった瞬間に死にリンクになる。
        判定は lib/company/casualMeeting.ts に一本化してある。 */
  const currentCompanyMeetingOpen =
    currentCareer?.company_id
      ? (await filterOpenCasualMeetingCompanies([currentCareer.company_id])).has(currentCareer.company_id)
      : false;

  /* ⚠️ この2本も互いに独立なので並列にする（2026-08-09）。
        求人は在籍企業に、記事は本人にぶら下がっており、参照し合わない。 */
  const [jobsRes, articlesRes] = await Promise.all([
    /* 在籍企業の募集中求人（本文カラム最下部の求人セクション用）
       ⚠️ `count: "exact"` を付けるのは、見出しの「N件」を**総数**にするため。
          2026-08-15 まで `limit(3)` で取った行数をそのまま「N件」と出していたので、
          10件募集していても「3件」と表示されていた（実データでは
          Salesforce が公開5件なので「3件」と出ていた）。
       ⚠️ 表示条件は status='published' かつ is_test=false の2つだけ。
          ここを増やすと企業ページ側の求人一覧と件数が食い違う。 */
    currentCareer?.company_id
      ? supabase
          .from("ow_jobs")
          .select("id, title", { count: "exact" })
          .eq("company_id", currentCareer.company_id)
          .eq("status", "published").eq("is_test", false)
          .limit(3)
      : Promise.resolve({ data: null as Array<{ id: string; title: string }> | null, count: null as number | null }),
    // OPINIO掲載記事（ow_articles.user_id でリンクされたもの）
    supabase
      .from("ow_articles")
      .select("id, slug, title, subtitle, type, eyecatch_gradient, read_min, published_at")
      .eq("user_id", owUser.id)
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(6),
  ]);

  const currentCompanyJobs = (jobsRes.data ?? []) as Array<{ id: string; title: string }>;
  /** 在籍企業の公開求人の**総数**。取れなければ表示済みの件数に倒す（0件を捏造しない） */
  const currentCompanyJobCount =
    (jobsRes as { count?: number | null }).count ?? currentCompanyJobs.length;
  const featuredArticlesRaw = articlesRes.data;
  const featuredArticles = (featuredArticlesRaw ?? []) as Array<{
    id: string; slug: string; title: string; subtitle: string | null;
    type: string; eyecatch_gradient: string | null; read_min: number | null;
    published_at: string | null;
  }>;

  /* ⚠️ 2026-08-06: キャリアサマリーの自動計算（在籍社数・通算年数）を削除した。
     計算はしていたが、どこにも表示していなかった。復活させるなら git 履歴から取る。 */

  /* ⚠️ 2026-08-15: 右サイドバー「在籍企業」を削除したのに伴い、
        そこだけで使っていた3つを消した。復活させるなら git 履歴から取る。

        - currentCareerTenure … 「在籍 N年Mヶ月」バッジ。
          ⚠️ 独自の月数計算を持っていた（`lib/profile/tenure.ts` の
             `formatDuration` と別実装で、終了日の +1ヶ月補正が無い）。
             期間表記を出す必要が再び出たら **tenure.ts を使うこと。**
        - currentCompanyPhase … `ow_companies.phase` の**生値**をそのまま
          バッジに出していた（"listed" / "non_listed" / "unicorn" /
          "series_b" / "series_d"）。日本語ラベルが無いまま公開側に出ていたので、
          移設先で復活させていない。
        - hasSidebarContent … 2カラム切替用。1カラム化で不要。 */

  // セクションナビ用リスト（ProfileNavClient に渡す）
  const navSections = [
    owUser.about_me ? { id: "about", label: "自己紹介" } : null,
    timelineCareers.length > 0 ? { id: "career", label: "職歴" } : null,
    timelineEdus.length > 0 ? { id: "education", label: "学歴" } : null,
    (achievements.length > 0 || awards.length > 0) ? { id: "achievements", label: "実績" } : null,
    contentLinks.length > 0 ? { id: "content", label: "発信" } : null,
    ((viewerIsOwner && viewerCanPost) || recentPostsTyped.length > 0) ? { id: "activity", label: "投稿" } : null,
  ].filter(Boolean) as { id: string; label: string }[];

  // キャリアパスノード用 年表示
  // プラットフォームメタ（アイコン色・表示名）


  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      <style>{`
        /* 2026-08-15: 右サイドバー（在籍企業）を削除して1カラムにした。
           has-sidebar / profile-sidebar / profile-sidebar-sticky の3クラスは
           もう誰も付けないので定義ごと消してある。

           ここに max-width を足していない。理由を残す。
           行長の上限は外枠の maxWidth 1060（下）が既に担っている。
           自己紹介は 15px の和文なので、実際の行長は

             (1060 − 左右padding 40 − セクションpadding 56 − border 2) ÷ 15px
             = 962 ÷ 15 ≒ 全角64字

           で、読みやすさの目安（1行80〜100字以内）を満たす。
           満たしているのに新しい上限値を足すと、根拠の無い数字が1つ増える。
           足すとしたら 15px という前提が変わったときで、そのときは
           上の式で計算し直すこと。

           ⚠️ この style タグの中でバッククォートを使わないこと
              （テンプレートリテラルが途中で閉じてビルドが落ちる。
              2026-08-15 に実際に踏んだ）。子孫セレクタの記号と
              引用符も使わない（ui-conventions: hydration mismatch になる）。 */
        .profile-grid {
          display: block;
        }
        @media (max-width: 960px) {
          .profile-cover { height: 140px !important; }
          .profile-avatar { width: 88px !important; height: 88px !important; font-size: 32px !important; }
          .profile-avatar-wrap { margin-top: -44px !important; }
          .profile-name { font-size: 22px !important; }
          .profile-header-body { padding: 0 20px 24px !important; }
          .profile-header-cta { font-size: 12px !important; padding: 8px 14px !important; }
        }
        .u-sidebar-link:hover { box-shadow: 0 4px 12px rgba(15,23,42,0.10) !important; }
        .u-content-card:hover { box-shadow: 0 4px 16px rgba(15,23,42,0.12) !important; transform: translateY(-2px) !important; }
        /* ⑧ 役職名モバイル折り返し防止 */
        .u-role-title { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        @media (min-width: 640px) { .u-role-title { -webkit-line-clamp: unset; display: block; } }
      `}</style>

      {/* Breadcrumb */}
      <div style={{ borderBottom: "1px solid var(--line-soft)", background: "var(--bg-tint)" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto", padding: "8px 20px", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5 }}>
          <Link href="/" style={{ color: "var(--ink-mute)", textDecoration: "none" }}>OPINIO</Link>
          <span>/</span>
          <Link href="/people" style={{ color: "var(--ink-mute)", textDecoration: "none" }}>ユーザー</Link>
          <span>/</span>
          <span style={{ color: "var(--ink-soft)" }}>{owUser.name}</span>
        </div>
      </div>

      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "32px 20px 80px" }}>

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
              background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.25))",
            }} />
          </div>

          <div className="profile-header-body" style={{ padding: "0 32px 32px", marginTop: -60, position: "relative" }}>
            {/* Share button — absolute top-right */}
            <div style={{ position: "absolute", top: 16, right: 24, zIndex: 10 }}>
              <ProfileShareButton userId={owUser.id} name={owUser.name} userSlug={profileUsername} />
            </div>
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
                </div>
                {/* 肩書き1行。⚠️ 空なら何も出さない（空欄も既定文言も出さない）。 */}
                {owUser.headline && (
                  <div style={{
                    fontSize: 15, fontWeight: 600, color: "var(--ink-soft)",
                    marginBottom: 8, lineHeight: 1.6,
                  }}>
                    {owUser.headline}
                  </div>
                )}
                {/* Current role subtitle */}
                {currentCareer && (
                  <div style={{ marginBottom: "var(--space-2)", lineHeight: 1.5 }}>
                    <span className="u-role-title" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
                      {currentCareer.role_title || currentCareer.role_label}
                    </span>
                    {currentCareer.role_title && currentCareer.role_title !== currentCareer.role_label && (
                      <span style={{ fontSize: 13, color: "var(--ink-mute)", marginLeft: 6 }}>({currentCareer.role_label})</span>
                    )}
                    {currentCareer.company_name && isCurrentCompanyKnown && (
                      <> <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>@</span>{" "}
                      <Link href={`/companies/${currentCareer.company_id!}`} style={{ fontSize: 14, color: "var(--royal)", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid var(--royal-100)" }}>{shortCompanyName(currentCareer.company_name)}</Link></>
                    )}
                    {currentCareer.company_name && !isCurrentCompanyKnown &&
                      currentCareer.company_name !== "不明な企業" &&
                      currentCareer.company_name !== "非公開企業" &&
                      currentCareer.company_name !== "非公開" && (
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
                  {/* フォロー数。年齢・所在地と同じ控えめなメタ行に置く。
                      名前・職種・所属より下であることが条件（主役は経歴なので、
                      数字が価値の代理指標に見えないようにする）。0 は出ない。 */}
                  <FollowCounts counts={followCounts} />
                </div>
                <ProfileSocialLinks socialLinks={socialLinks} />
              </div>

              {/* Main action CTA (right-side) */}
              {/* ⚠️ minWidth: 0 が要る（2026-08-08）。この行は親（flex row）の item で、
                     既定の min-width: auto だと中身（社名入りの「〇〇 の企業ページ」）の
                     min-content まで広がり、375px で親を 14px はみ出していた。 */}
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", paddingTop: 4, minWidth: 0 }}>
                {/* カジュアル面談ボタン（can_casual_meeting = true かつ非オーナー かつ在籍企業が受付中） */}
                {!viewerIsOwner && owUser.can_casual_meeting && isCurrentCompanyKnown && currentCompanyMeetingOpen && (
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

                {/* フォローボタン。オーナー本人には出さない。
                    未ログインでも押せるが、押すと /auth に飛ばす（企業フォローと同じ挙動） */}
                {!viewerIsOwner && (
                  <FollowUserButton
                    targetUserId={owUser.id}
                    initialFollowed={isFollowingUser}
                    isAuthenticated={!!authUser}
                  />
                )}

                {/* DMボタン */}
                {!viewerIsOwner && authUser ? (
                  <DMButton targetUserId={owUser.id} targetName={owUser.name} />
                ) : !viewerIsOwner && !authUser ? (
                  <Link href={`/auth?next=/u/${owUser.id}`} style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "9px 18px", borderRadius: 8,
                    background: "linear-gradient(135deg, var(--royal) 0%, #3B5FD9 100%)",
                    color: "#fff", fontSize: "var(--text-sm)", fontWeight: 700,
                    textDecoration: "none", flexShrink: 0,
                    boxShadow: "0 4px 14px rgba(0,35,102,0.3)",
                    whiteSpace: "nowrap",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    DMを送る（無料登録）
                  </Link>
                ) : null}

                {viewerIsOwner ? (
                  <Link href="/mypage" className="profile-header-cta" style={{
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
                ) : isCurrentCompanyKnown ? (
                  <Link href={`/companies/${currentCareer!.company_id!}`} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 18px", borderRadius: 8,
                    border: "1.5px solid var(--royal-100)", background: "var(--royal-50)",
                    color: "var(--royal)", fontSize: "var(--text-sm)", fontWeight: 600, textDecoration: "none",
                    /* ⚠️ flexShrink: 0 を外した（2026-08-08）。社名が入る可変長ボタンで、
                          375px で親（293px）を 307px ではみ出していた。
                          社名側を minWidth: 0 で縮め、省略記号で収める。 */
                    minWidth: 0, maxWidth: "100%",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    <span
                      title={`${currentCareer!.company_name} の企業ページ`}
                      style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {shortCompanyName(currentCareer!.company_name)} の企業ページ
                    </span>
                  </Link>
                ) : (
                  <Link href="/jobs" style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 18px", borderRadius: 8,
                    border: "1.5px solid var(--line)", background: "#fff",
                    color: "var(--ink-soft)", fontSize: "var(--text-sm)", fontWeight: 600, textDecoration: "none",
                    flexShrink: 0,
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    IT 求人を見る
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Two-column grid: main content | sidebar */}
        <div className="profile-grid">

          {/* ── Main column ─────────────────────────────────────────── */}
          <div>

            {/* ── Section navigation (スクロールスパイ付き) ── */}
            {navSections.length > 0 && (
              <ProfileNavClient sections={navSections} />
            )}

            {/* ── ハイライト (LinkedIn-style 2-3 cards) ── */}
            {(() => {
              const highlights: { icon: React.ReactNode; label: string; body: React.ReactNode; href?: string; color: string }[] = [];

              // Card 1: カジュアル面談CTA（非オーナー、can_casual_meeting=true かつ在籍企業が受付中）
              if (!viewerIsOwner && owUser.can_casual_meeting && currentCompanyMeetingOpen) {
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
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.5 }}>
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
                      fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.5,
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

            {/* ⚠️ ここにあった「プロフィール完成度」バナー（本人にだけ出る
                   黄色のプログレスバー＋未完了項目のチップ）は 2026-08-07 に削除した。
                   /u/[id] は**他人に見せるためのページ**で、本人が来るのは
                   見え方を確認するときなので、編集の督促を出す場所ではない。
                   完成度は /profile/edit（右カラム）と /mypage に出ている。
                ⚠️ 各セクションの「まだ書かれていません」の空状態は残す。
                   そこは「この欄が空である」という事実の表示であって督促ではない。 */}

            {/* About Me */}
            <ProfileAboutSection aboutMe={owUser.about_me} viewerIsOwner={viewerIsOwner} />
            {/* ── 数値実績 ── */}
            <ProfileAchievementsSection achievements={achievements} />

            {/* ── 受賞・表彰 ── */}
            <ProfileAwardsSection awards={awards} />

            {/* ── 職歴セクション ──
                   ⚠️ 枠・見出しは `ProfileTimelineSection` に切り出した（2026-08-16 / 2-6）。
                      `/mypage` が同じものを使う。DOM は切り出す前と同一（実測済み）。 */}
            {timelineCareers.length > 0 && (
              <ProfileTimelineSection id="career" title="職歴">
                <MergedTimeline
                  careers={timelineCareers}
                  educations={[]}
                  future={null}
                  viewerIsOwner={viewerIsOwner}
                  collapseAfter={4}
                  birthDate={birthDate}
                />
              </ProfileTimelineSection>
            )}

            {/* ── 学歴セクション ── */}
            {timelineEdus.length > 0 && (
              <ProfileTimelineSection id="education" title="学歴">
                <MergedTimeline
                  careers={[]}
                  educations={timelineEdus}
                  future={null}
                  viewerIsOwner={viewerIsOwner}
                  birthDate={birthDate}
                />
              </ProfileTimelineSection>
            )}


            {/* ── アクティビティ（投稿フォーム + 最近の投稿） ── */}
            {(viewerIsOwner || recentPostsTyped.length > 0) && (
              <section id="activity" style={{
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 14, padding: "22px 28px", marginBottom: 20,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    アクティビティ
                  </span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    ACTIVITY
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                  {recentPostsTyped.length > 0 && (
                    <span style={{ fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: 600, color: "var(--ink-mute)" }}>
                      {recentPostsTyped.length}件
                    </span>
                  )}
                </div>

                {/* 投稿フォーム（オーナーかつ投稿権限がある人のみ）。
                    ⚠️ 権限が無い人には「投稿できません」を出さず、静かに出さないだけにする */}
                {viewerIsOwner && viewerCanPost && (
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
            <ProfileMediaSection mediaAppearances={mediaAppearances} />
            {/* ── OPINIO掲載記事 ── */}
            <ProfileArticlesSection featuredArticles={featuredArticles} />
            {/* ── 発信コンテンツ (外部リンク) ── */}
            <ProfileContentLinksSection contentLinks={contentLinks} viewerIsOwner={viewerIsOwner} />
          {/* ── 在籍企業の募集中求人 ──────────────────────────────────
              2026-08-15 に右サイドバーから本文カラム最下部へ移設した。

              ⚠️ 遷移先は **`/jobs?company=<slug>`**（2026-08-15 に企業ページから変更）。
                 `/companies/[id]/jobs` は 2026-07-01 にルートごと削除されて 404 のままなので、
                 そちらには**戻さないこと**。
                 値は slug 優先・UUID も可（JobsClient 側が両方受ける）。
              ⚠️ 見出しの件数は取得行数ではなく総数（currentCompanyJobCount）。
                 ここに currentCompanyJobs.length を書かないこと（最大3にしかならない）。 */}
          {isCurrentCompanyKnown && currentCompanyJobs.length > 0 && (
            <section style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "24px 28px", marginBottom: 20,
              boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", minWidth: 0 }}>
                  {shortCompanyName(currentCareer!.company_name)}の募集中の求人
                </span>
                <span style={{
                  fontSize: "var(--text-xs)", color: "#D97706", fontWeight: 700,
                  fontFamily: "Inter, sans-serif", flexShrink: 0,
                }}>
                  {currentCompanyJobCount}件
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--line)", minWidth: 0 }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {currentCompanyJobs.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} style={{
                    display: "flex", alignItems: "center", gap: "var(--space-3)",
                    padding: "12px 14px", borderRadius: 9,
                    background: "var(--bg-tint)", border: "1px solid var(--line)",
                    textDecoration: "none",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                    {/* ⚠️ minWidth:0 が無いと ellipsis が効かず親を押し広げる */}
                    <span style={{
                      fontSize: 14, color: "var(--ink)", fontWeight: 500, minWidth: 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }} title={job.title}>
                      {job.title}
                    </span>
                  </Link>
                ))}
              </div>

              {/* UI規約: 濃紺塗り・白文字・中央配置・コンパクト幅 */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                <Link href={`/jobs?company=${encodeURIComponent(companySlugById.get(currentCareer!.company_id!) ?? currentCareer!.company_id!)}`} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "10px 22px", borderRadius: 8,
                  background: "var(--royal)", color: "#fff",
                  fontSize: 13, fontWeight: 700, textDecoration: "none",
                  boxShadow: "0 4px 14px rgba(0,35,102,0.22)",
                }}>
                  すべての求人を見る →
                </Link>
              </div>
            </section>
          )}

          {/* Footer CTA — パーソナライズ
              ⚠️ 2026-08-08 まで .profile-grid の**外**にあり、常に 1020px
                 （コンテナ全幅）だった。サイドバーが出るページでは職歴・学歴カードが
                 728px なのに CTA だけ 1020px で、同じページの中で幅が食い違っていた。
              ⚠️ 本文カラムの中に入れたので、サイドバーの有無に自動で追従する。
                 グリッドの外に戻さないこと。
              ⚠️ 中の分岐は2つ（在籍企業が分かっていて求人がある版 / 汎用版）。
                 どちらもこの1つの div の中にある。 */}
          <div style={{
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 14, padding: "28px 32px", marginTop: 20,
            textAlign: "center",
            boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
          }}>
            {isCurrentCompanyKnown && currentCompanyJobs.length > 0 ? (
              <>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px", lineHeight: 1.5 }}>
                  {shortCompanyName(currentCareer!.company_name)}への転職に興味はありますか？
                </p>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.6 }}>
                  {owUser.name}さんのように活躍できる求人を見てみましょう
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <Link href={`/companies/${currentCareer!.company_id!}`} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "10px 22px", borderRadius: 8,
                    background: "var(--royal)", color: "#fff",
                    fontSize: 13, fontWeight: 700, textDecoration: "none",
                    boxShadow: "0 4px 14px rgba(0,35,102,0.22)",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                    企業ページを見る
                  </Link>
                  {owUser.can_casual_meeting && currentCompanyMeetingOpen ? (
                    <Link href={`/companies/${currentCareer!.company_id!}/casual-meeting`} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "10px 22px", borderRadius: 8,
                      border: "1.5px solid #FCD34D", background: "#FFFBEB",
                      color: "#92400E", fontSize: 13, fontWeight: 700, textDecoration: "none",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      カジュアル面談する
                    </Link>
                  ) : (
                    <Link href="/companies" style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "10px 22px", borderRadius: 8,
                      border: "1.5px solid var(--royal-100)", background: "var(--royal-50)",
                      color: "var(--royal)", fontSize: 13, fontWeight: 700, textDecoration: "none",
                    }}>
                      企業を探す
                    </Link>
                  )}
                </div>
              </>
            ) : isCurrentCompanyKnown ? (
              <>
                <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.6 }}>
                  {shortCompanyName(currentCareer!.company_name)}についてもっと詳しく知りたい方はこちら
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <Link href={`/companies/${currentCareer!.company_id!}`} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 20px", borderRadius: 8,
                    background: "var(--royal)", color: "#fff",
                    fontSize: 13, fontWeight: 700, textDecoration: "none",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                    企業ページを見る
                  </Link>
                  <Link href="/feed" style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 20px", borderRadius: 8,
                    border: "1.5px solid var(--royal-100)", background: "var(--royal-50)",
                    color: "var(--royal)", fontSize: 13, fontWeight: 700, textDecoration: "none",
                  }}>
                    フィードを見る
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.6 }}>
                  IT業界で働く人のリアルなキャリアが集まっています
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <Link href="/jobs" style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 20px", borderRadius: 8,
                    background: "var(--royal)", color: "#fff",
                    fontSize: 13, fontWeight: 700, textDecoration: "none",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                    IT 求人を見る
                  </Link>
                  <Link href="/companies" style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 20px", borderRadius: 8,
                    border: "1.5px solid var(--royal-100)", background: "var(--royal-50)",
                    color: "var(--royal)", fontSize: 13, fontWeight: 700, textDecoration: "none",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                    企業を見る
                  </Link>
                </div>
              </>
            )}
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", margin: "16px 0 0" }}>
              <Link href="/companies" style={{ color: "var(--ink-mute)", textDecoration: "none" }}>OPINIO</Link>
              {" "}のプロフィールページ
            </p>
          </div>

          </div>{/* /main column */}

          {/* ⚠️ 2026-08-15: 右サイドバーをここから削除した（在籍企業カード + 死にコード）。

                削除したのは2ブロック。
                  ① 在籍企業カード … 企業リンク / 在籍N年 / phase生値バッジ /
                     カジュアル面談CTA / 募集中の求人3件 / すべての求人を見る
                  ② StrengthsFinder … 条件が `(null as string[] | null)?.length` で
                     常に undefined。**一度も描画されたことのない約100行**
                     （`ow_users.strengths_finder` 列は DB に存在しない）。

                「募集中の求人」は本文カラム最下部の求人セクションへ移設済み。
                カジュアル面談CTAはヘッダーと Footer CTA に元から同じ導線があるため
                移設していない（3箇所目を作らない）。
             ⚠️ phase の生値バッジは復活させないこと。詳細は上の
                currentCompanyPhase の削除コメントを参照。 */}

        </div>{/* /profile-grid */}

      </div>
    </div>
  );
}
