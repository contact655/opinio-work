import { redirect } from "next/navigation";
import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import FeedClient from "./FeedClient";
import type { SidebarJob, SidebarPerson } from "@/components/feed/FeedSidebar";

export const metadata: Metadata = {
  title: "投稿 | OPINIO",
  description: "IT/SaaS業界で働く人たちの投稿",
};

type RawPost = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user: { id: string; name: string; avatar_color: string | null; avatar_url: string | null; visibility: string | null } | null;
  likes: { count: number }[];
  comments: { count: number }[];
};

export default async function FeedPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/feed");
  }

  // ow_users レコードを取得
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id, name, avatar_color, avatar_url")
    .eq("auth_id", user.id)
    .maybeSingle();

  const myOwUserId = owUser?.id ?? null;

  // 初期投稿を SSR でフェッチ（adminClient でコメント数・いいね数を確実に取得）
  const adminSupabase = createAdminClient();
  const { data: rawPosts } = await adminSupabase
    .from("ow_posts")
    .select(`
      id, content, image_url, created_at,
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

  // visibility フィルター（private は全員非表示 / login_only はログイン済みなので表示）
  const visiblePosts = posts.filter((p) => p.user?.visibility !== "private");

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

    // 新着求人（1社1件、3件）
    const { data: jobRows } = await adminSupabase
      .from("ow_jobs")
      .select("id, title, job_category, salary_min, salary_max, work_style, ow_companies!inner(id, name, brand_name, logo_letter, logo_gradient, logo_url)")
      .in("status", ["published", "active"])
      .order("published_at", { ascending: false })
      .limit(20);

    if (jobRows) {
      const seen = new Set<string>();
      for (const row of jobRows as unknown as Array<{
        id: string; title: string; job_category: string | null;
        salary_min: number | null; salary_max: number | null; work_style: string | null;
        ow_companies: { id: string; name: string; brand_name: string | null; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null;
      }>) {
        const co = row.ow_companies;
        if (!co || seen.has(co.id)) continue;
        seen.add(co.id);
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
          logoGradient: co.logo_gradient ?? FALLBACK_GRADIENT,
          logoLetter: co.logo_letter ?? (co.brand_name ?? co.name).charAt(0).toUpperCase(),
        });
        if (sidebarJobs.length >= 3) break;
      }
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
    />
  );
}
