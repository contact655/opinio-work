import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import FeedClient from "./FeedClient";
import type { SidebarJob, SidebarPerson } from "@/components/feed/FeedSidebar";
import type { FeedProfileData } from "@/components/feed/FeedProfileCard";

export const metadata: Metadata = {
  title: "投稿 | OPINIO",
  description: "IT/SaaS業界で働く人たちの投稿",
};

type RawPost = {
  id: string;
  content: string;
  image_url: string | null;
  link_url: string | null;
  link_title: string | null;
  link_image_url: string | null;
  link_description: string | null;
  link_domain: string | null;
  created_at: string;
  user: { id: string; name: string; avatar_color: string | null; avatar_url: string | null; visibility: string | null } | null;
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

  // 初期投稿を SSR でフェッチ（adminClient でコメント数・いいね数を確実に取得）
  const adminSupabase = createAdminClient();
  const { data: rawPosts } = await adminSupabase
    .from("ow_posts")
    .select(`
      id, content, image_url, link_url, link_title, link_image_url, link_description, link_domain, created_at,
      user:ow_users!user_id(id, name, avatar_color, avatar_url, visibility),
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

  // visibility フィルター（private は全員非表示 / login_only は未ログイン時も非表示）
  const visiblePosts = posts.filter((p) => {
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

  // ── 左カラム: 自分のプロフィールサマリー（失敗してもフィード本体は壊れない） ──
  let feedProfile: FeedProfileData | null = null;
  if (myOwUserId && owUser) {
    try {
      // 現職情報
      const { data: myExp } = await adminSupabase
        .from("ow_experiences")
        .select("role_title, company_text, company_anonymized")
        .eq("user_id", myOwUserId)
        .eq("is_current", true)
        .limit(1)
        .maybeSingle();

      // 完成度計算用データ
      const [{ data: owProfile }, { data: skillTags }, { data: careers }] = await Promise.all([
        adminSupabase.from("ow_users").select("about_me").eq("id", myOwUserId).maybeSingle(),
        adminSupabase.from("ow_user_skill_tags").select("id").eq("user_id", myOwUserId).limit(1),
        adminSupabase.from("ow_experiences").select("id").eq("user_id", myOwUserId).limit(1),
      ]);

      const hasName   = !!owUser.name && owUser.name !== "ユーザー";
      const hasAbout  = !!owProfile?.about_me && (owProfile.about_me as string).trim().length > 0;
      const hasSkills = (skillTags?.length ?? 0) > 0;
      const hasCareer = (careers?.length ?? 0) > 0;

      let profileStage: 1 | 2 | 3 = 1;
      if (hasName && hasAbout && hasSkills) profileStage = hasCareer ? 3 : 2;

      feedProfile = {
        userId: myOwUserId,
        name: owUser.name ?? "ユーザー",
        avatarColor: owUser.avatar_color ?? null,
        avatarUrl: owUser.avatar_url ?? null,
        roleTitle: myExp?.role_title ?? null,
        companyName: myExp?.company_text || myExp?.company_anonymized || null,
        profileStage,
      };
    } catch (e) {
      console.error("[feed profile card]", e);
    }
  }

  // ── サイドバー用データ（失敗してもフィード本体は壊れない） ───────────────────
  const sidebarJobs: SidebarJob[] = [];
  const sidebarPeople: SidebarPerson[] = [];

  try {
    const WORK_STYLE_LABELS: Record<string, string> = {
      full_remote: "フルリモート",
      hybrid: "ハイブリッド",
      on_site: "原則出社",
    };
    const FALLBACK_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";

    // 新着求人（会社制約なし、新着3件そのまま）
    const { data: jobRows } = await adminSupabase
      .from("ow_jobs")
      .select("id, title, job_category, salary_min, salary_max, work_style, ow_companies!inner(id, name, brand_name, logo_letter, logo_gradient, logo_url)")
      .in("status", ["published", "active"])
      .order("published_at", { ascending: false })
      .limit(3);

    for (const row of (jobRows ?? []) as unknown as Array<{
      id: string; title: string; job_category: string | null;
      salary_min: number | null; salary_max: number | null; work_style: string | null;
      ow_companies: { id: string; name: string; brand_name: string | null; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null;
    }>) {
      const co = row.ow_companies;
      if (!co) continue;
      const ws = row.work_style;
      sidebarJobs.push({
        id: row.id,
        title: row.title,
        companyName: co.brand_name ?? co.name,
        dept: row.job_category,
        salaryMin: row.salary_min,
        salaryMax: row.salary_max,
        workStyle: ws ? (WORK_STYLE_LABELS[ws] ?? ws) : null,
        logoUrl: co.logo_url,
        logoGradient: co.logo_gradient,
        logoLetter: co.logo_letter,
      });
    }

    // 話せる人（is_ambassador=true, 3人）
    const { data: ambassadors } = await adminSupabase
      .from("ow_company_admins")
      .select(`
        user_id,
        role_title,
        department,
        user:ow_users!user_id(id, name, avatar_color, avatar_url, visibility),
        company:ow_companies!company_id(name, brand_name)
      `)
      .eq("is_ambassador", true)
      .eq("is_active", true)
      .not("user_id", "is", null)
      .limit(10);

    if (ambassadors) {
      const seen = new Set<string>();
      for (const r of ambassadors as unknown as Array<{
        user_id: string; role_title: string | null; department: string | null;
        user: { id: string; name: string; avatar_color: string | null; avatar_url: string | null; visibility: string | null } | null;
        company: { name: string; brand_name: string | null } | null;
      }>) {
        if (!r.user || r.user.visibility !== "public" || seen.has(r.user_id)) continue;
        seen.add(r.user_id);
        const gradient = r.user.avatar_color?.startsWith("linear-gradient")
          ? r.user.avatar_color
          : FALLBACK_GRADIENT;
        sidebarPeople.push({
          userId: r.user.id,
          name: r.user.name,
          initial: r.user.name.charAt(0),
          gradient,
          avatarUrl: r.user.avatar_url,
          roleTitle: r.role_title ?? r.department ?? null,
          companyName: r.company?.brand_name ?? r.company?.name ?? "",
        });
        if (sidebarPeople.length >= 3) break;
      }
    }
  } catch (e) {
    console.error("[feed sidebar]", e);
    // フォールバック: 空配列のまま（フィード本体には影響なし）
  }

  const initialPosts = visiblePosts.map((p) => {
    const exp = p.user ? expByUser.get(p.user.id) : undefined;
    return {
      id: p.id,
      content: p.content,
      image_url: p.image_url,
      link_url: p.link_url,
      link_title: p.link_title,
      link_image_url: p.link_image_url,
      link_description: p.link_description,
      link_domain: p.link_domain,
      created_at: p.created_at,
      user: p.user
        ? { id: p.user.id, name: p.user.name, avatar_color: p.user.avatar_color, avatar_url: p.user.avatar_url, roleTitle: exp?.roleTitle ?? null, company: exp?.company ?? null }
        : { id: "", name: "不明", avatar_color: null, avatar_url: null, roleTitle: null, company: null },
      like_count: p.likes?.[0]?.count ?? 0,
      comment_count: p.comments?.[0]?.count ?? 0,
      liked_by_me: likedPostIds.has(p.id),
    };
  });

  return (
    <FeedClient
      initialPosts={initialPosts}
      myUserId={myOwUserId}
      myName={owUser?.name ?? null}
      myAvatarColor={owUser?.avatar_color ?? null}
      myAvatarUrl={owUser?.avatar_url ?? null}
      myLikedPostIds={Array.from(likedPostIds)}
      sidebarJobs={sidebarJobs}
      sidebarPeople={sidebarPeople}
      feedProfile={feedProfile}
    />
  );
}
