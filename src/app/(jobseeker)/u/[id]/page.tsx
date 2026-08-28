import { notFound } from "next/navigation";
import { permanentRedirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTalkable } from "@/lib/companyMembers/talkable";
import { TalkableBadge } from "@/components/profile/view/TalkableBadge";
import Link from "next/link";
import { type SocialPlatform } from "@/components/SocialIcon";
import MergedTimeline from "@/components/profile/MergedTimeline";
import SchoolLogoImg from "@/components/profile/SchoolLogoImg";
import {
  buildTimelineCareerEntriesFromRaw,
  toTimelineEducationEntries,
  type RawExperienceRow,
  type RawEducation,
  type CompanyLogoInfo,
} from "@/lib/utils/timeline";
import { getAllRoleRowsCached } from "@/lib/supabase/queries";
import { filterOpenCasualMeetingCompanies } from "@/lib/company/casualMeeting";
import { ProfileShareButton } from "@/components/profile/ProfileShareButton";
import { FollowUserButton } from "./FollowUserButton";
import { getFollowCounts } from "@/lib/people/followCounts";
import { DMButton } from "@/components/profile/DMButton";
import { buildAutoSkills } from "@/lib/profile/autoSkillsServer";
/* ⚠️ 各セクションの見た目は `components/profile/view/` に移した（2026-08-16）。
      `/mypage` のプロフィールが同じものを使う。**ここに書き戻さないこと。** */
import {
  ProfileAboutSection,
  ProfileAchievementsSection,
  ProfileAwardsSection,
  ProfileCertificationsSection,
  ProfileLanguagesSection,
  ProfileSkillsSection,
  ProfileMediaSection,
  ProfileTimelineSection,
  ProfileArticlesSection,
  ActivitySection,
  ProfileContentLinksSection,
} from "@/components/profile/view/ProfileSections";
import { ProfileHeader, shortCompanyName } from "@/components/profile/view/ProfileHeader";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  /* ★下2つは select では前から取っていたが、型に無かったので使えなかった（2026-08-28 に追加）。
        入学年月の無い学歴を年表の外に出すときにロゴを揃えるため。 */
  school_id: string | null;
  school_master: { logo_url: string | null; logo_letter: string | null; logo_gradient: string | null } | null;
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
      /* ⚠️ `is_open_to_work` は 2026-08-26 に select から外した（フェーズ2）。
              **取っていたが描画側で1度も参照していなかった**（この画面に「転職検討中」は出ない）。
              「転職について」の正は `ow_profiles.career_stance` に移っている。 */
      .select("id, name, headline, avatar_color, avatar_url, cover_color, cover_photo_url, about_me, location, social_links, auth_id")
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
  /* ⚠️ `canUserPost` はここでは引かない（2026-08-17）。投稿フォームを
        `/mypage` だけにしたので、このページに投稿できるかの判定は要らなくなった。 */
  const [followCounts, viewerRowRes] = await Promise.all([
    // フォロー数。0 のときは FollowCounts 側で行ごと落とすのでここでは素通し。
    getFollowCounts(owUser.id),
    // 閲覧者自身の ow_users.id（本人の行なので admin で引いても見える範囲は広がらない）
    authUser
      ? adminSupabase.from("ow_users").select("id").eq("auth_id", authUser.id).maybeSingle()
      : Promise.resolve({ data: null as { id: string } | null }),
    /* ★`birth_date` の取得は 2026-08-29 に外した（年齢を画面から消したため）。
          ⚠️ 年齢を戻すなら、ここも戻すこと。`birth_date` は authenticated から
             SELECT 権限を剥がしてあるので、**admin クライアントで取り直す必要がある。** */
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


  /* ⚠️ 抽出と並び順は `ProfileSocialLinks` が持つ（2026-08-16 に切り出し）。
        ここで `activeSocials` を作り直さないこと。 */
  const socialLinks = owUser.social_links ?? {};

  // Fetch experiences + educations + content links + achievements + awards + media in parallel
  const [
    { data: expRows }, allRoles,
    { data: educationsRaw }, { data: contentLinksRaw },
    { data: achievementsRaw }, { data: awardsRaw }, { data: mediaAppearancesRaw },
    { data: certificationsRaw },
    { data: languagesRaw },
    { data: skillsRaw },
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
    /* ⚠️ 職種マスタは閲覧者にも対象ユーザーにも依存しないので、ページごとに引かない
          （2026-08-23）。中身は共通キャッシュ。`getAllRoleRows` の注意書きを参照。
          ⚠️ 非アクティブな職種も返るので、以前と同じ行が引ける（絞ると職種名が消える）。 */
    getAllRoleRowsCached(),
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
    /* ★資格（2026-08-24）。⚠️ **admin クライアントで引く。**
          `ow_user_certifications` は anon に GRANT していない（awards / educations と同じ）。
          session クライアントのままだと未ログイン閲覧で丸ごと消える。 */
    adminSupabase
      .from("ow_user_certifications")
      .select("id, name, issuer, issued_at, credential_id, credential_url, sort_order")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    /* ★言語（2026-08-24）。⚠️ **admin クライアントで引く。**
          `ow_user_languages` は anon に GRANT していない（資格と同じ）。
          session クライアントのままだと未ログイン閲覧で丸ごと消える。
       ⚠️ 順番は上の分割代入と揃えること。ずれても型が同じなのでエラーにならない。 */
    adminSupabase
      .from("ow_user_languages")
      /* ⚠️ `name`（複製）は読まない。**表示名はマスタから取る**（2026-08-28）。 */
      .select("id, language_id, proficiency, sort_order, language:ow_languages(label)")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    /* ★スキル（2026-08-27）。⚠️ **admin クライアントで引く。**
          `ow_user_skills` は anon に GRANT していない（資格・言語と同じ）。
          session クライアントのままだと**未ログイン閲覧で丸ごと消える**。
       ⚠️ 順番は上の分割代入と揃えること。 */
    adminSupabase
      .from("ow_user_skills")
      .select("id, skill_id, skill:ow_skills(id, label, category)")
      .eq("user_id", owUser.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("ow_posts_visible")
      .select("id, content, image_url, created_at, likes:ow_post_likes(count)")
      .eq("user_id", owUser.id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  /* ⚠️★埋め込み（`school_master:ow_schools!school_id(...)`）は**配列で返る**。
        畳まずに渡すと受け手は `undefined` になり、**型が optional なので tsc も lint も
        通ったままロゴだけ黙って消える**（CLAUDE.md「埋め込みで取ったら畳んでから渡す」）。 */
  const educations     = ((educationsRaw ?? []) as Array<Record<string, unknown>>).map((e) => ({
    ...e,
    school_master: Array.isArray(e.school_master) ? (e.school_master[0] ?? null) : (e.school_master ?? null),
  })) as unknown as Education[];
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
  /* ⚠️ 形は `CertificationRow`（ProfileSections.tsx）と同じにすること。
        片方だけ列を足すと、渡した先で読まれない列が生まれる。 */
  const certifications = (certificationsRaw ?? []) as Array<{
    id: string; name: string; issuer: string | null; issued_at: string | null;
    credential_id: string | null; credential_url: string | null; sort_order: number;
  }>;
  /* ⚠️ 形は `LanguageRow`（ProfileSections.tsx）と同じにすること。
        ★表示名は `ow_languages.label` から作る（2026-08-28 に `name` の複製をやめた）。
        ⚠️ マスタが引けなかった行は**出さない**。空文字で出すと名前の無い行が並ぶ。 */
  const languages = ((languagesRaw ?? []) as unknown as Array<{
    id: string; proficiency: string | null; sort_order: number;
    language: { label: string } | null;
  }>)
    .filter((l) => !!l.language?.label)
    .map((l) => ({ id: l.id, name: l.language!.label, proficiency: l.proficiency, sort_order: l.sort_order }));
  /* ⚠️ 形は `UserSkillRow`（ProfileSections.tsx）と同じにすること。 */
  const skills = (skillsRaw ?? []) as unknown as Array<{
    id: string; skill_id: string;
    skill: { id: string; label: string; category: string } | null;
  }>;
  const recentPostsTyped = (recentPostsRaw ?? []) as Array<{
    id: string; content: string; image_url: string | null; created_at: string;
    likes: Array<{ count: number }>;
  }>;
  /* ログインユーザーがいいねしている投稿ID一覧。
     ⚠️ 閲覧者の ow_users.id は上で1回引いたものを使い回す。
        ここで auth_id から引き直さないこと（2026-08-09 まで同じ行を2回引いていた）。 */
  /* ⚠️ 配列で持つ。`ActivitySection` は `"use client"` なので `Set` を渡さない */
  const likedPostIds: string[] = [];
  if (viewerOwUserId && recentPostsTyped.length > 0) {
    const { data: likedRows } = await supabase
      .from("ow_post_likes")
      .select("post_id")
      .eq("user_id", viewerOwUserId)
      .in("post_id", recentPostsTyped.map((p) => p.id));
    for (const r of likedRows ?? []) likedPostIds.push(r.post_id as string);
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

  /* ★職歴から自動で出すスキル（2026-08-29）。⚠️ **保存していない。都度計算する。**
        ⚠️ `expRows`（生の行）から作る。`timelineCareers` は匿名化や
           `visibility_company_profile` の処理を経ており、**会社が伏せられた行でも
           在籍した事実は変わらない**ので、集計は生の行で行う。
        ⚠️ 組み立ては `buildAutoSkills` に集約してある。**ここに書き写さないこと**
           （`/mypage` と食い違うと、同じ人が画面によって違うスキルを出す）。 */
  const autoSkills = await buildAutoSkills(
    adminSupabase,
    /* ⚠️ `?? []` を落とさない。取得に失敗すると `expRows` は undefined で、
          そのまま渡すと `.map` で落ちる（ページ全体が 500 になる）。 */
    (expRows ?? []) as unknown as { company_id?: string | null; role_category_id?: string | null;
                            started_at?: string | null; ended_at?: string | null }[],
    roleInfoById,
    "u/[id]",
  );

  // MergedTimeline 用データ整形（isOwner=true なら visibility_company_profile を無視して実名表示）
  const timelineCareers = buildTimelineCareerEntriesFromRaw(
    processedExpRows as unknown as RawExperienceRow[],
    roleInfoById,
    companyInfoById,
    viewerIsOwner,
  );
  const timelineEdus    = toTimelineEducationEntries(educations as RawEducation[]);
  /* ★年表に置けない学歴（入学年月が無い）。⚠️ ここで拾わないと公開側から消える */
  const unplacedEdus    = educations.filter((e) => !e.enrolled_at);
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
  /* ★「この会社の話を聞ける人」か（2026-08-23 / B-1）。
        判定は `lib/companyMembers/talkable.ts`：`ow_company_members` で公開中 ＋
        その企業に在籍中の経歴があること。**企業の受付状態は見ない**（方針D）。
        ⚠️ 以前は `ow_users.can_casual_meeting`（運営が個別に立てるフラグ）だった。
        ⚠️ 掲載可否の判定なので admin クライアントで引く。`ow_company_members` は
           anon/authenticated に列単位でしか開いておらず、閲覧者によって欠ける。 */
  const { data: memberRows, error: memberErr } = await adminSupabase
    .from("ow_company_members")
    .select("company_id")
    .eq("user_id", owUser.id)
    .eq("display_consent", true)
    .eq("is_public", true);
  /* ⚠️ 握り潰さない。空になると「話を聞けません」と誤って出る。 */
  if (memberErr) console.error("[u/[id]] ow_company_members:", memberErr.message);

  const isTalkableHere = isTalkable(
    ((memberRows ?? []) as { company_id: string }[]).map((m) => m.company_id),
    [currentCareer?.company_id ?? null],
  );

  const currentCompanyMeetingOpen =
    currentCareer?.company_id
      ? (await filterOpenCasualMeetingCompanies([currentCareer.company_id])).has(currentCareer.company_id)
      : false;

  /**
   * ★在籍企業の宣伝（求人一覧・企業ページへの誘導）を、このページに出してよいか（2026-08-23）。
   *
   * **バッジが「面談可」になる条件と同じ**（本人が話を聞かれてもよいと登録していて、
   * かつ企業が面談を受け付けている）。
   *
   * ⚠️ **本人の同意が無いのに、個人のプロフィールを企業の求人広告にしない。**
   *    「話を聞ける人」の掲載は本人の申請＋企業の承認で成り立っており
   *    （`lib/companyMembers/talkable.ts` 方針D）、同意していない人のページに
   *    在籍企業の募集を並べると、本人が企業の窓口であるかのように読まれる。
   *
   * ⚠️ 満たさないときは**汎用のフッター**（IT求人を見る / 企業を見る）に落ちる。
   *    フッターごと消さないのは、ページの終わりが唐突になるため。
   *
   * ⚠️ **ヘッダーの「〇〇 の企業ページ」リンクはこの判定の対象外。**
   *    あれは「この人はここに在籍している」という肩書きの一部で、宣伝ではない。
   */
  const canPromoteCurrentCompany = isTalkableHere;

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
        /* ⚠️ ヘッダー本体（cover / avatar / name / header-body）のモバイル調整は
              ProfileHeader へ移した（2026-08-16）。ここに書き戻さないこと。
              マークアップは 2-7 で共通化したのに CSS だけこちらに残っていて、
              /mypage のヘッダーだけカバー200px・アバター120px・名前30px になっていた。
           ⚠️ 下の profile-header-cta は、このページが actions に渡すボタンの分。
              ProfileHeader のマークアップには無いのでここに残す。 */
        @media (max-width: 960px) {
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

        {/* Cover + Avatar header
               ⚠️ 中身は `ProfileHeader` に切り出した（2026-08-16 / 2-7）。`/mypage` が同じものを使う。
                  DOM は切り出す前と同一（script を除いた実HTMLで実測済み）。 */}
        <ProfileHeader
          name={owUser.name}
          headline={owUser.headline}
          initial={initial}
          avatarUrl={owUser.avatar_url}
          avatarColor={avatarColor}
          coverPhotoUrl={owUser.cover_photo_url}
          coverColor={coverColor}
          location={owUser.location}
          followCounts={followCounts}
          socialLinks={socialLinks}
          currentCareer={currentCareer}
          isCurrentCompanyKnown={isCurrentCompanyKnown}
          /* ★「この会社の話を聞けます」（2026-08-23 / B-1）。
                ⚠️ **申込CTAとは独立**。企業が受付を止めていても出す。
                   人が出るかは本人の同意で決まり、申込導線は企業の受付で決まる（方針D）。
                ⚠️ 本人が自分のページを見たときも出す。自分の登録状態が確認できるほうがよい
                   （申込CTAは本人には出さない ＝ `!viewerIsOwner`）。
                ⚠️ 様式は /people のバッジに合わせてある（訪問者はそこから来る）。 */
          talkableBadge={isTalkableHere ? <TalkableBadge /> : null}
          topRight={<ProfileShareButton userId={owUser.id} name={owUser.name} userSlug={profileUsername} />}
          /* ★CTA 群。**メタ行（36歳・埼玉県・フォロー数）のすぐ下**に出す（2026-08-23）。
                ⚠️ **右側へ戻さないこと。** 右は在籍企業のブロックだけにする（LinkedIn と同じ形）。
                ⚠️ 同時に3つ落とした（柴さんの指示）:
                     ・「〇〇 の企業ページ」 … 右の会社ブロックの社名が同じ場所へ行くので二重だった
                     ・「IT 求人を見る」     … 上の代替分岐。片方だけ残すと
                                              「会社が分かる人には何も出ず、分からない人には求人」になる
                     ・DM の文言を「〇〇 にDMを送る」→「メッセージ」に短縮
                ⚠️ minWidth: 0 は残す。可変長のボタンが並ぶ行なので、狭い画面で親を押し広げる。 */
          metaActions={<>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", margin: "14px 0 4px", minWidth: 0 }}>
                {/* カジュアル面談ボタン（非オーナー かつ 在籍企業の話を聞ける人 かつ 在籍企業が受付中） */}
                {!viewerIsOwner && isTalkableHere && isCurrentCompanyKnown && currentCompanyMeetingOpen && (
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
                    カジュアル面談
                  </Link>
                )}

                {/* DMボタン */}
                {!viewerIsOwner && authUser ? (
                  <DMButton targetUserId={owUser.id} targetName={owUser.name} label="メッセージ" />
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
                    メッセージ（無料登録）
                  </Link>
                ) : null}

                {/* ⚠️ 並びは「カジュアル面談 → メッセージ → ＋フォロー」（2026-08-23）。
                       主要な順に左から。フォローは最も軽い操作なので末尾。 */}
                {/* フォローボタン。オーナー本人には出さない。
                    未ログインでも押せるが、押すと /auth に飛ばす（企業フォローと同じ挙動） */}
                {!viewerIsOwner && (
                  <FollowUserButton
                    targetUserId={owUser.id}
                    initialFollowed={isFollowingUser}
                    isAuthenticated={!!authUser}
                  />
                )}

                {/* ⚠️ ここにあった「〇〇 の企業ページ」と「IT 求人を見る」は 2026-08-23 に外した。
                       前者は右の会社ブロック（ロゴ＋社名がリンク）と同じ行き先で二重。
                       後者はその代替分岐なので、片方だけ残すと出し分けが逆立ちする。
                    ⚠️ 書き戻さないこと。企業ページへは会社ブロックの社名から行ける。 */}
                {viewerIsOwner && (
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
                )}
              </div>
          </>}
        />

        {/* Two-column grid: main content | sidebar */}
        <div className="profile-grid">

          {/* ── Main column ─────────────────────────────────────────── */}
          <div>

            {/* ⚠️ ここにあった上位タブ（プロフィール / フィード）は 2026-08-23 に外した。
                   同じ投稿を「抜粋」と「全件」で2度出しており、
                   **アクティビティのセクションがあれば足りる**（柴さんの判断）。
                ⚠️ 戻さないこと。全件はアクティビティの中で展開する。 */}

            {/* ⚠️ ここにあったセクションナビ（自己紹介 / 職歴 / 学歴 …）は 2026-08-23 に外した。
                   上位タブ（プロフィール / フィード）を足した結果、**タブ風の行が2段**になり、
                   しかも下段は下線と塗りを併用していたため、どちらが選択中か読めなくなっていた
                   （`.claude/skills/ui-conventions/SKILL.md`「タブ」の
                    「選択状態は下線のみ・塗りを併用しない」に反していた）。
                ⚠️ **戻すなら、上位タブと見分けが付く形にすること**（丸いチップなど）。
                   同じ見た目の行を2段重ねない。
                ⚠️ プロフィールは実測で約3.5画面ぶん。ナビが無くてもスクロールで追える。 */}

            {/* ⚠️ ここにあった「プロフィール完成度」バナー（本人にだけ出る
                   黄色のプログレスバー＋未完了項目のチップ）は 2026-08-07 に削除した。
                   /u/[id] は**他人に見せるためのページ**で、本人が来るのは
                   見え方を確認するときなので、編集の督促を出す場所ではない。
                   完成度は /profile/edit（右カラム）と /mypage に出ている。
                ⚠️ 各セクションの「まだ書かれていません」の空状態は残す。
                   そこは「この欄が空である」という事実の表示であって督促ではない。 */}

            {/* About Me */}
            {/* ★`viewerIsOwner` を渡さない（常に false）。空の自己紹介に本人だけ
                   点線の CTA が出ていたのをやめる。追加は `/mypage` の
                   「セクションを追加」に集約した（2026-08-16）。 */}
            <ProfileAboutSection aboutMe={owUser.about_me} viewerIsOwner={false} />

            {/* ★アクティビティの抜粋（2026-08-23）。**自己紹介と職歴の間**に置く。
                   LinkedIn と同じ並びで、その人が何を発信しているかを
                   経歴を読む前に見せる。
                ⚠️ **0件でも出す。** 「まだ投稿していません」と書くことで、
                   投稿していないのか置き場所が無いのかを読み手が区別できる。
                ⚠️ 初期表示は3件。**残りはこのセクションの中で展開する**
                   （タブへ飛ばさない）。 */}
            <ActivitySection
              posts={recentPostsTyped}
              likedPostIds={likedPostIds}
              viewerIsOwner={viewerIsOwner}
              displayName={owUser.name}
            />
            {/* ── 職歴セクション ──
                   ⚠️ 枠・見出しは `ProfileTimelineSection` に切り出した（2026-08-16 / 2-6）。
                      `/mypage` が同じものを使う。DOM は切り出す前と同一（実測済み）。 */}
            {/* ⚠️ 会社名の伏せ字は `buildTimelineCareerEntriesFromRaw` に
                   `viewerIsOwner` を渡して解決済み。そちらは触らない。 */}
            {timelineCareers.length > 0 && (
              <ProfileTimelineSection id="career" title="職歴" latin="CAREER">
                <MergedTimeline
                  careers={timelineCareers}
                  educations={[]}
                  collapseAfter={4}
                />
              </ProfileTimelineSection>
            )}

            {/* ── 学歴セクション ──
                   ⚠️★`timelineEdus`（＝`toTimelineEducationEntries`）は
                      **入学年月の無い行を落とす**。年表は「年」で並べるので置き場が無い。
                      2026-08-28 まで、その行は**公開プロフィールから黙って消えていた**
                      （実データ2件。本人にも閲覧者にも欠けていることが伝わらない）。
                   → **年表の下に、年の分からない学歴として出す。**
                   ⚠️ 「入学年月 未入力」と書く。**推測した年を置かない**
                      （CLAUDE.md「値が無いことを、ある値に置き換えない」）。
                   ⚠️ **入力を必須にする案は採っていない。** 必須にすると、
                      既に登録している人が**思い出せない年月の入力を強いられる**
                      （＝推測値の投入を利用者にさせることになる）。 */}
            {(timelineEdus.length > 0 || unplacedEdus.length > 0) && (
              <ProfileTimelineSection id="education" title="学歴" latin="EDUCATION">
                {timelineEdus.length > 0 && (
                  <MergedTimeline
                    careers={[]}
                    educations={timelineEdus}
                  />
                )}
                {unplacedEdus.map((e) => (
                  <div key={e.id} style={{
                    display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                    paddingTop: 8, paddingBottom: 18,
                  }}>
                    <SchoolLogoImg schoolMaster={e.school_master ?? null} size={28} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>
                        {e.school}
                      </div>
                      {(e.faculty || e.degree) && (
                        <div style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 2 }}>
                          {[e.faculty, e.degree].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {/* ⚠️ 期間は出さない。始まりが分からないので月数を出しようがない */}
                      <div style={{ fontSize: 13, color: "var(--ink-mute)", marginTop: 2 }}>
                        入学年月 未入力
                      </div>
                    </div>
                  </div>
                ))}
              </ProfileTimelineSection>
            )}

            {/* ── 数値実績 / 受賞・表彰 ──
                   ⚠️ **2026-08-24 に「自己紹介の直後・職歴の前」から学歴の直下へ移した**
                      （柴さんの指示。資格より上）。
                   ⚠️ **並び順は `/mypage`（ProfileTab）と必ず揃えること。**
                      片方だけ動かすと、同じプロフィールが2つの画面で別の順に見える。 */}
            <ProfileAchievementsSection achievements={achievements} />
            <ProfileAwardsSection awards={awards} />

            {/* ── 資格（2026-08-24）──
                   ⚠️ **学歴の下**。柴さんの指示で LinkedIn と同じ並びにしてある。
                   ⚠️ 0件なら出さない（`actions` を渡さないので空状態も出ない）。 */}
            <ProfileCertificationsSection certifications={certifications} />

            {/* ── 言語（2026-08-24）──
                   ⚠️ **資格の下**。柴さんの指示で LinkedIn と同じ並びにしてある。
                   ⚠️ 0件なら出さない（`actions` を渡さないので空状態も出ない）。 */}
            <ProfileLanguagesSection languages={languages} />
            {/* ★スキル（2026-08-27）。⚠️ **`actions` を渡さない。**
                   渡すと他人の画面に追加・削除の導線が出る。
                   0件なら部品側が何も描かない（他人が見る DOM は1バイトも変わらない）。 */}
            <ProfileSkillsSection skills={skills} autoSkills={autoSkills} />


            {/* ── アクティビティ（最近の投稿）──
                   ★投稿フォームと0件の案内は外した（2026-08-17）。他の5つと同じ扱いにする。
                     **投稿フォームは `/mypage` にもある**ので、消しても投稿する手段は残る
                     （`/mypage` のプロフィールタブ下端「アクティビティ」。実測で確認）。
                   ⚠️ **投稿の一覧は残す。** 他人にも出るセクションで、
                      本人だけに見えるものではない。 */}

            {/* ── メディア掲載 ── */}
            <ProfileMediaSection mediaAppearances={mediaAppearances} />
            {/* ── OPINIO掲載記事 ── */}
            <ProfileArticlesSection featuredArticles={featuredArticles} />
            {/* ── 発信コンテンツ (外部リンク) ── */}
            {/* ★同上。0件のときセクションごと出さない・「＋ 追加」も出さない */}
            <ProfileContentLinksSection contentLinks={contentLinks} viewerIsOwner={false} />
          {/* ── 在籍企業の募集中求人 ──────────────────────────────────
              2026-08-15 に右サイドバーから本文カラム最下部へ移設した。

              ⚠️ 遷移先は **`/jobs?company=<slug>`**（2026-08-15 に企業ページから変更）。
                 `/companies/[id]/jobs` は 2026-07-01 にルートごと削除されて 404 のままなので、
                 そちらには**戻さないこと**。
                 値は slug 優先・UUID も可（JobsClient 側が両方受ける）。
              ⚠️ 見出しの件数は取得行数ではなく総数（currentCompanyJobCount）。
                 ここに currentCompanyJobs.length を書かないこと（最大3にしかならない）。 */}
          {/* ⚠️ 面談可のときだけ出す（2026-08-23）。判定は `canPromoteCurrentCompany`。
                 同意していない人のプロフィールを企業の求人広告にしない。 */}
          {canPromoteCurrentCompany && isCurrentCompanyKnown && currentCompanyJobs.length > 0 && (
            <section style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "24px 28px", marginBottom: 20,
              boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
            }}>
              {/* ⚠ 見出しは他のセクションと同じ形にする（2026-08-29）。
                     ここだけ Inter 16px で、件数がオレンジ（#D97706）だった。
                  ⚠★オレンジは**カジュアル面談だけの色**（.claude/skills/ui-conventions）。
                     求人の件数に使うと、凡例の無い色分けが増える。件数は他節と同じ
                     ニュートラル（--ink-mute）にした。 */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 15, fontWeight: 700, color: "var(--ink)", minWidth: 0 }}>
                  {shortCompanyName(currentCareer!.company_name)}の募集中の求人
                </span>
                <span style={{
                  fontSize: 12, color: "var(--ink-mute)", fontWeight: 600,
                  fontFamily: "var(--font-inter), var(--font-noto)", flexShrink: 0,
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
            {/* ⚠️ 企業名を出す分岐（1・2）は面談可のときだけ。満たさなければ
                   下の汎用分岐（IT求人を見る / 企業を見る）へ落ちる。 */}
            {canPromoteCurrentCompany && isCurrentCompanyKnown && currentCompanyJobs.length > 0 ? (
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
                  {/* ⚠️ `!viewerIsOwner` を必ず入れる（2026-08-23 に抜けを修正）。
                         ヘッダーのボタンには最初から入っていたが、
                         ここだけ抜けており、**本人が自分のページから自分の在籍企業へ
                         カジュアル面談を申し込める**状態だった。
                         ⚠️ 落ちた側は「企業を探す」になる。本人には申込導線を出さない。 */}
                  {!viewerIsOwner && isTalkableHere && currentCompanyMeetingOpen ? (
                    <Link href={`/companies/${currentCareer!.company_id!}/casual-meeting`} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "10px 22px", borderRadius: 8,
                      border: "1.5px solid #FCD34D", background: "#FFFBEB",
                      color: "#92400E", fontSize: 13, fontWeight: 700, textDecoration: "none",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      カジュアル面談
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
            ) : canPromoteCurrentCompany && isCurrentCompanyKnown ? (
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
