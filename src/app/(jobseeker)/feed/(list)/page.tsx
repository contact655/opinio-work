import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import FeedClient from "./FeedClient";

export const metadata: Metadata = {
  title: "投稿 | OPINIO",
  description: "IT/SaaS業界で働く人たちの投稿",
};

// サイドバー用型
export type SidebarFollow = { id: string; slug: string | null; name: string; brand_name: string | null; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null };
export type SidebarUserFollow = { id: string; name: string; avatar_color: string | null; avatar_url: string | null; role_title: string | null; company_name: string | null };
export type SidebarJob = { id: string; slug?: string | null; title: string; salary_min: number | null; salary_max: number | null; companyName: string | null };
export type SidebarMentor = { id: string; name: string; avatar_color: string | null; photo_url: string | null; current_role: string | null; current_company: string | null };

type RefCompany = { id: string; slug?: string | null; name: string; brand_name: string | null; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null;
type RefJob = { id: string; title: string; salary_min: number | null; salary_max: number | null; work_style: string | null } | null;
type RefArticle = { id: string; slug: string; title: string } | null;

type RawPost = {
  id: string;
  content: string;
  post_type: string;
  ref_company_id: string | null;
  ref_job_id: string | null;
  ref_article_id: string | null;
  image_url: string | null;
  link_url: string | null;
  link_title: string | null;
  link_image_url: string | null;
  link_description: string | null;
  link_domain: string | null;
  event_title: string | null;
  event_starts_at: string | null;
  event_location: string | null;
  created_at: string;
  user: { id: string; name: string; avatar_color: string | null; avatar_url: string | null; visibility: string | null; is_system: boolean | null } | null;
  ref_company: RefCompany;
  ref_job: RefJob;
  ref_article: RefArticle;
  likes: { count: number }[];
  comments: { count: number }[];
};

export default async function FeedPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ow_users レコードを取得（未ログインは null）
  let owUser: { id: string; name: string | null; avatar_color: string | null; avatar_url: string | null } | null = null;
  if (user) {
    const { data } = await supabase
      .from("ow_users")
      .select("id, name, avatar_color, avatar_url")
      .eq("auth_id", user.id)
      .maybeSingle();
    owUser = data;
  }

  const myOwUserId = owUser?.id ?? null;

  // adminClient (SSR / RLS バイパス)
  const adminSupabase = createAdminClient();

  // ログインユーザー自身の現職情報
  let myRoleTitle: string | null = null;
  let myCompany: string | null = null;
  if (myOwUserId) {
    const { data: myExp } = await adminSupabase
      .from("ow_experiences")
      .select("role_title, company_text, company_anonymized")
      .eq("user_id", myOwUserId)
      .eq("is_current", true)
      .limit(1)
      .maybeSingle();
    if (myExp) {
      myRoleTitle = myExp.role_title ?? null;
      myCompany = myExp.company_text || myExp.company_anonymized || null;
    }
  }

  // 初期投稿を SSR でフェッチ（adminClient でコメント数・いいね数を確実に取得）
  const { data: rawPosts } = await adminSupabase
    .from("ow_posts")
    .select(`
      id, content, post_type, ref_company_id, ref_job_id, ref_article_id,
      image_url, link_url, link_title, link_image_url, link_description, link_domain,
      event_title, event_starts_at, event_location, created_at,
      user:ow_users!user_id(id, name, avatar_color, avatar_url, visibility, is_system),
      ref_company:ow_companies!ref_company_id(id, slug, name, brand_name, logo_letter, logo_gradient, logo_url),
      ref_job:ow_jobs!ref_job_id(id, slug, title, salary_min, salary_max, work_style),
      ref_article:ow_articles!ref_article_id(id, slug, title),
      likes:ow_post_likes(count),
      comments:ow_post_comments(count)
    `)
    .order("created_at", { ascending: false })
    .limit(20);

  const posts = (rawPosts ?? []) as unknown as RawPost[];

  // liked_by_me
  let likedPostIds = new Set<string>();
  if (myOwUserId && posts.length > 0) {
    const postIds = posts.map((p) => p.id);
    const { data: likedRows } = await adminSupabase
      .from("ow_post_likes")
      .select("post_id")
      .eq("user_id", myOwUserId)
      .in("post_id", postIds);
    likedPostIds = new Set((likedRows ?? []).map((r: { post_id: string }) => r.post_id));
  }

  // visibility フィルター（is_system=true のシステム投稿は visibility に関わらず表示）
  const visiblePosts = posts.filter((p) => {
    if (p.user?.is_system) return true;
    const v = p.user?.visibility;
    if (v === "private") return false;
    if (v === "login_only" && !user) return false;
    return true;
  });

  // 現職情報を別クエリで取得
  const userIds = Array.from(new Set(visiblePosts.map((p) => p.user?.id).filter(Boolean) as string[]));
  const expByUser = new Map<string, { roleTitle: string | null; company: string | null }>();
  if (userIds.length > 0) {
    const { data: exps } = await adminSupabase
      .from("ow_experiences")
      .select("user_id, role_title, company_text, company_anonymized")
      .in("user_id", userIds)
      .eq("is_current", true);
    for (const exp of exps ?? []) {
      if (!expByUser.has(exp.user_id)) {
        expByUser.set(exp.user_id, {
          roleTitle: exp.role_title ?? null,
          company: exp.company_text || exp.company_anonymized || null,
        });
      }
    }
  }

  // top_likers: いいねしたユーザーのアバター（最大3件）をバッチ取得
  const topLikersMap = new Map<string, { id: string; name: string; avatar_color: string | null; avatar_url: string | null }[]>();
  if (visiblePosts.length > 0) {
    const pIds = visiblePosts.map((p) => p.id);
    const { data: likerRows } = await adminSupabase
      .from("ow_post_likes")
      .select("post_id, user:ow_users!user_id(id, name, avatar_color, avatar_url)")
      .in("post_id", pIds)
      .order("created_at", { ascending: false });
    for (const row of likerRows ?? []) {
      const r = row as unknown as { post_id: string; user: { id: string; name: string; avatar_color: string | null; avatar_url: string | null } };
      if (!topLikersMap.has(r.post_id)) topLikersMap.set(r.post_id, []);
      const arr = topLikersMap.get(r.post_id)!;
      if (arr.length < 3) arr.push(r.user);
    }
  }

  const initialPosts = visiblePosts.map((p) => {
    const exp = p.user ? expByUser.get(p.user.id) : undefined;
    return {
      id: p.id,
      content: p.content,
      post_type: p.post_type ?? "user_post",
      image_url: p.image_url,
      link_url: p.link_url,
      link_title: p.link_title,
      link_image_url: p.link_image_url,
      link_description: p.link_description,
      link_domain: p.link_domain,
      event_title: p.event_title ?? null,
      event_starts_at: p.event_starts_at ?? null,
      event_location: p.event_location ?? null,
      created_at: p.created_at,
      user: p.user
        ? { id: p.user.id, name: p.user.name, avatar_color: p.user.avatar_color, avatar_url: p.user.avatar_url, is_system: p.user.is_system ?? false, roleTitle: exp?.roleTitle ?? null, company: exp?.company ?? null }
        : { id: "", name: "不明", avatar_color: null, avatar_url: null, is_system: false, roleTitle: null, company: null },
      ref_company: p.ref_company ?? null,
      ref_job: p.ref_job ?? null,
      ref_article: p.ref_article ?? null,
      like_count: p.likes?.[0]?.count ?? 0,
      comment_count: p.comments?.[0]?.count ?? 0,
      liked_by_me: likedPostIds.has(p.id),
      top_likers: topLikersMap.get(p.id) ?? [],
    };
  });

  // ── サイドバーデータ（並列取得） ─────────────────────────────────────────────
  const [followResult, userFollowResult, bookmarkResult, mentorResult] = await Promise.all([
    // (a) フォロー中の企業 (全件)
    myOwUserId
      ? adminSupabase
          .from("ow_company_follows")
          .select("ow_companies!company_id(id, slug, name, brand_name, logo_letter, logo_gradient, logo_url)")
          .eq("follower_user_id", myOwUserId)
      : Promise.resolve({ data: [] }),
    // (a2) フォロー中のユーザー (全件)
    myOwUserId
      ? adminSupabase
          .from("ow_career_follows")
          .select("ow_career_profiles!target_profile_id(user_id, ow_users!user_id(id, name, avatar_color, avatar_url))")
          .eq("follower_user_id", myOwUserId)
      : Promise.resolve({ data: [] }),
    // (b) 気になる求人 (max 3) — ow_saved_jobs
    myOwUserId
      ? adminSupabase
          .from("ow_saved_jobs")
          .select("job_id")
          .eq("user_id", myOwUserId)
          .limit(3)
      : Promise.resolve({ data: [] }),
    // (c) 面談OKな人 (max 3) — ow_company_members から取得
    adminSupabase
      .from("ow_company_members")
      .select(`
        id,
        role_title,
        ow_users!user_id(id, name, avatar_color, avatar_url, visibility, is_test),
        ow_companies!company_id(id, name, brand_name)
      `)
      .eq("display_consent", true)
      .eq("is_public", true)
      .limit(6),
  ]);

  const sidebarFollows: SidebarFollow[] = (followResult.data ?? [])
    .map((r: Record<string, unknown>) => r["ow_companies"])
    .filter(Boolean) as SidebarFollow[];

  const sidebarUserFollows: SidebarUserFollow[] = (userFollowResult.data ?? [])
    .map((r: Record<string, unknown>) => {
      const profile = r["ow_career_profiles"] as Record<string, unknown> | null;
      if (!profile) return null;
      const user = profile["ow_users"] as { id: string; name: string; avatar_color: string | null; avatar_url: string | null } | null;
      if (!user) return null;
      return { id: user.id, name: user.name, avatar_color: user.avatar_color, avatar_url: user.avatar_url, role_title: null, company_name: null };
    })
    .filter(Boolean) as SidebarUserFollow[];

  // 気になる求人: job IDリストを取得してから jobs をフェッチ
  const bookmarkedJobIds = (bookmarkResult.data ?? []).map((r: { job_id: string }) => r.job_id).filter(Boolean);
  let sidebarSavedJobs: SidebarJob[] = [];
  if (bookmarkedJobIds.length > 0) {
    const { data: jobRows } = await adminSupabase
      .from("ow_jobs")
      .select("id, slug, title, salary_min, salary_max, ow_companies!company_id(name, brand_name)")
      .in("id", bookmarkedJobIds)
      .in("status", ["published", "active"]);
    sidebarSavedJobs = (jobRows ?? []).map((j: Record<string, unknown>) => {
      const co = j["ow_companies"] as { name: string; brand_name: string | null } | null;
      return {
        id: j.id as string,
        slug: (j.slug as string | null) ?? null,
        title: j.title as string,
        salary_min: j.salary_min as number | null,
        salary_max: j.salary_max as number | null,
        companyName: co?.brand_name ?? co?.name ?? null,
      };
    });
  }

  // ow_company_members から SidebarMentor 型に変換
  // 非ログイン: public のみ / ログイン済: public + login_only（private は常に除外、is_test も除外）
  // 表示順: DB のデフォルト順（INSERT 順）。.limit(6) 取得後 .slice(0,3) で最大3名に絞る。
  type MemberRow = {
    id: string;
    role_title: string | null;
    ow_users: { id: string; name: string; avatar_color: string | null; avatar_url: string | null; visibility: string | null; is_test: boolean | null } | null;
    ow_companies: { id: string; name: string; brand_name: string | null } | null;
  };
  const eligibleMembers = (mentorResult.data ?? [] as MemberRow[])
    .map((r) => r as unknown as MemberRow)
    .filter((r) => {
      const u = r.ow_users;
      if (!u) return false;
      if (u.is_test === true) return false;
      if (u.visibility === "private") return false;
      return true;
    });

  // ログイン状態に依存しないカウント（is_test=false かつ visibility!='private'）
  const hiddenMembersCount = user ? 0 : eligibleMembers.length;

  const sidebarMentors: SidebarMentor[] = eligibleMembers
    .filter((r) => {
      if (r.ow_users?.visibility === "login_only" && !user) return false;
      return true;
    })
    .slice(0, 3)
    .map((r) => {
      const u = r.ow_users!;
      const co = r.ow_companies;
      return {
        id: u.id,
        name: u.name,
        avatar_color: u.avatar_color,
        photo_url: u.avatar_url,
        current_role: r.role_title,
        current_company: co?.brand_name ?? co?.name ?? null,
      };
    });

  return (
    <FeedClient
      initialPosts={initialPosts}
      myUserId={myOwUserId}
      myName={owUser?.name ?? null}
      myAvatarColor={owUser?.avatar_color ?? null}
      myAvatarUrl={owUser?.avatar_url ?? null}
      myRoleTitle={myRoleTitle}
      myCompany={myCompany}
      myLikedPostIds={Array.from(likedPostIds)}
      sidebarFollows={sidebarFollows}
      sidebarUserFollows={sidebarUserFollows}
      sidebarSavedJobs={sidebarSavedJobs}
      sidebarMentors={sidebarMentors}
      hiddenMembersCount={hiddenMembersCount}
    />
  );
}
