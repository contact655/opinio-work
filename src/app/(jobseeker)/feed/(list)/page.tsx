import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import FeedClient from "./FeedClient";
import { resolveExperienceCompanyName, EXPERIENCE_COMPANY_COLS } from "@/lib/experiences/companyName";
import { isPostVisibleTo, isJobPostAlive, isCompanyPostAlive } from "@/lib/feed/visibility";
import { canUserPost } from "@/lib/feed/canPost";
import { getCompaniesForList } from "@/lib/supabase/queries";
import { fetchBusinessDomainsByCompany } from "@/lib/supabase/queries";
import { primaryBusinessDomain } from "@/types/genre";

export const metadata: Metadata = {
  /* ⚠️ **`| OPINIO` を自分で書くなら `absolute` にする。** ルートの
          `template: "%s | OPINIO"`（app/layout.tsx）が後ろに足すので、
          素の `title` に書くと **「… | OPINIO | OPINIO」** になる。実測で3ページ該当した。 */
  title: { absolute: "投稿 | OPINIO" },
  description: "IT業界で働く人たちの投稿",
};

// サイドバー用型
export type SidebarFollow = { id: string; slug: string | null; name: string; brand_name: string | null; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null };
export type SidebarUserFollow = { id: string; name: string; avatar_color: string | null; avatar_url: string | null; role_title: string | null; company_name: string | null };
export type SidebarJob = { id: string; slug?: string | null; title: string; salary_min: number | null; salary_max: number | null; companyName: string | null };
/** 右レール「掲載中の企業」。ディレクトリに載っている企業から先頭3社 */
/**
 * 埋め込みで来た事業領域を、表示側が読む1つの値（主の1件）に畳む。
 * ⚠️ **キー名は `industry` のまま。** FeedClient と型の互換を保つため
 *    （中身は事業領域名。`ow_companies.industry`(text) ではない）。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenRefCompany(co: any): any {
  if (!co) return null;
  const links = (co.ow_company_business_domains ?? []) as {
    is_primary: boolean; ow_business_domains: { name: string } | null;
  }[];
  const { ow_company_business_domains: _, ...rest } = co;
  return { ...rest, industry: links.find((l) => l.is_primary)?.ow_business_domains?.name ?? null };
}

export type SidebarCompany = { id: string; slug: string | null; name: string; brand_name?: string | null; tagline: string | null; industry: string | null; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null };
export type SidebarMentor = { id: string; name: string; avatar_color: string | null; photo_url: string | null; current_role: string | null; current_company: string | null };

type RefCompany = { id: string; slug?: string | null; name: string; brand_name: string | null; /* ⚠️ company_joined の本文位置に出す（2026-08-13）。content は使わない */ tagline: string | null; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null; industry: string | null; employee_count: string | null; location: string | null; founded_year: number | null; /* ⚠️ 取り下げた企業の告知を出さないための判定に使う（isCompanyPostAlive・2026-08-13） */ is_published: boolean | null; is_test: boolean | null } | null;
type RefJob = { id: string; slug?: string | null; title: string; status?: string | null; salary_min: number | null; salary_max: number | null; work_style: string | null; company: RefCompany } | null;
/* ⚠️ `ow_articles` に画像カラムは1つも無い（2026-08-13 に全28列を確認）。
      サムネイルは作れないので、記事ごとに違う `eyecatch_gradient` /
      `company_gradient_text` と `company_initial_text` で絵を作る。 */
type RefArticle = { id: string; slug: string; title: string; eyecatch_gradient?: string | null; company_initial_text?: string | null; company_gradient_text?: string | null; company_name_text?: string | null } | null;

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
  visibility: string;
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

  /* ★自分の現職と投稿一覧は**互いに依存しない**ので並列に引く（2026-08-23）。
        直列だと1往復ぶん余計に待つ。 */
  let myRoleTitle: string | null = null;
  let myCompany: string | null = null;

  // 初期投稿を SSR でフェッチ（adminClient でコメント数・いいね数を確実に取得）
  // ⚠️ 読みは ow_posts_visible。参照先が消えた投稿（ref_* が NULL）を落とすビュー。
  //    ow_posts を直に引かないこと。除外条件はビュー1箇所に置いている。
  const [myExpResult, rawPostsResult] = await Promise.all([
    myOwUserId
      ? adminSupabase
          .from("ow_experiences")
          .select(`role_title, ${EXPERIENCE_COMPANY_COLS}`)
          .eq("user_id", myOwUserId)
          .eq("is_current", true)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    adminSupabase
    .from("ow_posts_visible")
    .select(`
      id, content, post_type, ref_company_id, ref_job_id, ref_article_id,
      image_url, link_url, link_title, link_image_url, link_description, link_domain,
      event_title, event_starts_at, event_location, created_at, visibility,
      user:ow_users!user_id(id, name, avatar_color, avatar_url, visibility, is_system),
      ref_company:ow_companies!ref_company_id(id, slug, name, brand_name, tagline, logo_letter, logo_gradient, logo_url, employee_count, location, founded_year, is_published, is_test, ow_company_business_domains(is_primary, ow_business_domains(name))),
      ref_job:ow_jobs!ref_job_id(id, slug, title, status, salary_min, salary_max, work_style, company:ow_companies!company_id(id, slug, name, brand_name, logo_letter, logo_gradient, logo_url)),
      ref_article:ow_articles!ref_article_id(id, slug, title, eyecatch_gradient, company_initial_text, company_gradient_text, company_name_text),
      likes:ow_post_likes(count),
      comments:ow_post_comments(count)
    `)
    .order("created_at", { ascending: false })
    .limit(20),
  ]);

  /* ⚠️ 型を狭めない。resolveExperienceCompanyName は会社名の解決に
        EXPERIENCE_COMPANY_COLS 一式を見る。 */
  const myExp = myExpResult.data;
  if (myExp) {
    myRoleTitle = myExp.role_title ?? null;
    myCompany = resolveExperienceCompanyName(myExp);
  }

  const posts = (rawPostsResult.data ?? []) as unknown as RawPost[];

  // liked_by_me
  let likedPostIds = new Set<string>();
  /* ★このあとの3つ（いいね済み / 投稿者の現職 / いいねした人）は
        **互いに依存しない**ので、可視判定のあとで1回にまとめて投げる。
        2026-08-23 まで3段の直列で、3往復ぶん待っていた。 */

  // 可視判定。⚠️ ここに if を増やさない。判定は lib/feed/visibility に集約している
  //    （3箇所に散っていた結果、パーマリンクだけ is_system の例外が抜けていた）
  const visiblePosts = posts.filter(
    (p) =>
      isPostVisibleTo({ postVisibility: p.visibility, author: p.user }, !!user) &&
      // 掲載を下ろした求人の「公開しました」投稿は出さない（押すと 404 になる）
      isJobPostAlive(p) &&
      // 取り下げた企業の「参加しました」投稿も同じく出さない（2026-08-13）
      isCompanyPostAlive(p),
  );

  // 現職情報を別クエリで取得
  const userIds = Array.from(new Set(visiblePosts.map((p) => p.user?.id).filter(Boolean) as string[]));
  const expByUser = new Map<string, { roleTitle: string | null; company: string | null }>();
  const visibleIds = visiblePosts.map((p) => p.id);

  const [likedResult, expsResult, likersResult] = await Promise.all([
    myOwUserId && posts.length > 0
      ? adminSupabase.from("ow_post_likes").select("post_id")
          .eq("user_id", myOwUserId).in("post_id", posts.map((p) => p.id))
      : Promise.resolve({ data: null }),
    userIds.length > 0
      ? adminSupabase.from("ow_experiences")
          .select(`user_id, role_title, ${EXPERIENCE_COMPANY_COLS}`)
          .in("user_id", userIds).eq("is_current", true)
      : Promise.resolve({ data: null }),
    visibleIds.length > 0
      ? adminSupabase.from("ow_post_likes")
          .select("post_id, user:ow_users!user_id(id, name, avatar_color, avatar_url)")
          .in("post_id", visibleIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  likedPostIds = new Set(((likedResult.data ?? []) as { post_id: string }[]).map((r) => r.post_id));

  {
    /* ⚠️ 型を狭めない。resolveExperienceCompanyName が会社名の解決に
          EXPERIENCE_COMPANY_COLS 一式を見る。 */
    const exps = expsResult.data;
    for (const exp of exps ?? []) {
      if (!expByUser.has(exp.user_id)) {
        expByUser.set(exp.user_id, {
          roleTitle: exp.role_title ?? null,
          company: resolveExperienceCompanyName(exp),
        });
      }
    }
  }

  // top_likers: いいねしたユーザーのアバター（最大3件）をバッチ取得
  const topLikersMap = new Map<string, { id: string; name: string; avatar_color: string | null; avatar_url: string | null }[]>();
  {
    const likerRows = likersResult.data;
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
      /* ⚠️ 埋め込みの `ow_company_business_domains[]` を **`industry` に畳んでから渡す。**
            畳まずに渡すと FeedClient は `co.industry` が undefined になり、
            **企業の情報行から業種だけが黙って消える**（型は optional なので tsc は通る）。 */
      ref_company: flattenRefCompany(p.ref_company),
      ref_job: p.ref_job ?? null,
      ref_article: p.ref_article ?? null,
      like_count: p.likes?.[0]?.count ?? 0,
      comment_count: p.comments?.[0]?.count ?? 0,
      liked_by_me: likedPostIds.has(p.id),
      top_likers: topLikersMap.get(p.id) ?? [],
    };
  });

  // ── サイドバーデータ（並列取得） ─────────────────────────────────────────────
  const [followResult, userFollowResult, bookmarkResult, listedCompanies, mentorResult] = await Promise.all([
    // (a) フォロー中の企業 (全件)
    myOwUserId
      ? adminSupabase
          .from("ow_company_follows")
          .select("ow_companies!company_id(id, slug, name, brand_name, logo_letter, logo_gradient, logo_url)")
          .eq("follower_user_id", myOwUserId)
      : Promise.resolve({ data: [] }),
    // (a2) フォロー中のユーザー (全件)
    //     ⚠️ 2026-08-04 まで ow_career_follows（対象が ow_career_profiles）を見ていた。
    //        あちらは実ユーザー5名中1名しか行が無く、1人しかフォローできなかったため
    //        ow_user_follows（対象が ow_users）に張り替えた。
    myOwUserId
      ? adminSupabase
          .from("ow_user_follows")
          .select("ow_users!target_user_id(id, name, avatar_color, avatar_url)")
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
    /* (d) 掲載中の企業 (max 3)
       ⚠️ **`Promise.all` の中に入れること。** 直列にすると1段増える。
       ⚠️ 並びは `getCompaniesForList()` のまま（sort_order 昇順 → updated_at 降順）。
          「注目」と名乗らないのは、`sort_order` の異なる値が6種類しかなく
          （公開79社・2026-08-13 実測）、運営が意図して並べた状態ではないため。
          「掲載中」なら並び順が何であっても表示と実態がずれない。 */
    getCompaniesForList(),
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

  // 右レール「面談OKな人」のフォローボタンの初期状態。
  // ⚠️ (a2) の userFollowResult は ow_users を JOIN した行なので、ここでは ID だけを別に取る。
  //    JOIN 結果から拾うと、対象ユーザーが消えていた場合に ID を落としてしまう。
  let followedUserIds: string[] = [];
  // 投稿できる人だけにコンポーザーを出す。条件は lib/feed/canPost に集約している
  let canPost = false;
  if (myOwUserId) {
    const { data: fRows, error: fErr } = await adminSupabase
      .from("ow_user_follows")
      .select("target_user_id")
      .eq("follower_user_id", myOwUserId);
    if (fErr) console.error("[feed followedUserIds]", fErr.message);
    followedUserIds = (fRows ?? []).map((r: { target_user_id: string }) => r.target_user_id);
    canPost = await canUserPost(adminSupabase, myOwUserId);
  }

  const sidebarUserFollows: SidebarUserFollow[] = (userFollowResult.data ?? [])
    .map((r: Record<string, unknown>) => {
      const user = r["ow_users"] as { id: string; name: string; avatar_color: string | null; avatar_url: string | null } | null;
      if (!user) return null;
      return { id: user.id, name: user.name, avatar_color: user.avatar_color, avatar_url: user.avatar_url, role_title: null, company_name: null };
    })
    .filter(Boolean) as SidebarUserFollow[];

  // 気になる求人: job IDリストを取得してから jobs をフェッチ
  const bookmarkedJobIds = (bookmarkResult.data ?? []).map((r: { job_id: string }) => r.job_id).filter(Boolean);
  let sidebarSavedJobs: SidebarJob[] = [];
  if (bookmarkedJobIds.length > 0) {
    /* ⚠️ ここから下、Supabase の呼び出しは `error` を必ず受けてログに出す（2026-08-29）。
          捨てると **RLS も GRANT も 400 も、すべて「0件」に化ける**。`?? []` で受けている
          側からは区別が付かず、画面には**節ごと消えたようにしか見えない**。
          ⚠️ `try/catch` では捕まらない。supabase-js はエラーを**戻り値**で返す。 */
    const { data: jobRows, error: jobRowsErr } = await adminSupabase
      .from("ow_jobs")
      .select("id, slug, title, salary_min, salary_max, ow_companies!company_id(name, brand_name)")
      .in("id", bookmarkedJobIds)
      .eq("status", "published").eq("is_test", false);
    if (jobRowsErr) console.error("[feed/(list)] ow_jobs:", jobRowsErr.message);
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

  /* ⚠️ タグは**事業領域**。`industry`(text) は廃止予定で新規企業では空になる。 */
  const sidebarDomains = await fetchBusinessDomainsByCompany(
    adminSupabase, listedCompanies.slice(0, 3).map((c) => c.id), "feed sidebar",
  );
  const sidebarCompanies: SidebarCompany[] = listedCompanies.slice(0, 3).map((c) => ({
    id: c.id, slug: c.slug, name: c.name, tagline: c.tagline || null,
    industry: primaryBusinessDomain(sidebarDomains.get(c.id))?.name ?? null,
    logo_letter: c.logo_letter, logo_gradient: c.logo_gradient, logo_url: c.logo_url,
  }));

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
      sidebarCompanies={sidebarCompanies}
      sidebarMentors={sidebarMentors}
      hiddenMembersCount={hiddenMembersCount}
      followedUserIds={followedUserIds}
      canPost={canPost}
    />
  );
}
