import { announcementsInStream } from "@/lib/feed/streamMode";
import { nextFeedPage } from "@/lib/feed/cursor";
import "server-only";
import { PUBLIC_JOB_MATCH } from "@/lib/jobs/publicJobs";
import { keepJobsAtRespondingCompanies, respondingCompanyIds } from "@/lib/jobs/respondingJobs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/paging";
import { resolveExperienceCompanyName, EXPERIENCE_COMPANY_COLS } from "@/lib/experiences/companyName";
import { isPostVisibleTo, isJobPostAlive, isCompanyPostAlive, isArticlePostAlive, jobPostCompanyIds, postRefersToTest } from "@/lib/feed/visibility";
import { viewerIsTestByAuthId } from "@/lib/feed/viewerIsTest";
import { canUserPost } from "@/lib/feed/canPost";
import { getFeedSidebarCompanies } from "@/lib/supabase/queries";
import { fetchBusinessDomainsByCompany } from "@/lib/supabase/queries";
import { primaryBusinessDomain } from "@/types/genre";
import { getPeopleSidebarData } from "@/lib/people/sidebarData";
import type { ProfileCardProps } from "@/components/common/ProfileCard";
import { getCareerMoveBlocks, type CareerMoveBlock } from "@/lib/feed/careerMoves";


/**
 * ★ホーム（/feed）の画面に渡すものをまとめて作る（2026-10-21 にページから切り出した）。
 *   検索結果（/search）も、左右の列をホームと同じにするためにこれを呼ぶ（柴さんの指示）。
 * ⚠️ 中身は切り出す前の FeedPage と同じ。ホームの見え方を変えるときはここを直す
 */
// サイドバー用型（FeedClient が import する。page.tsx からも再 export している）
export type SidebarFollow = { id: string; slug: string | null; name: string; brand_name: string | null; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null };
export type SidebarUserFollow = { id: string; name: string; avatar_color: string | null; avatar_url: string | null; role_title: string | null; company_name: string | null };
export type SidebarJob = { id: string; slug?: string | null; title: string; salary_min: number | null; salary_max: number | null; salary_negotiable: boolean; employment_type: string | null; companyName: string | null };
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

type RefCompany = { id: string; slug?: string | null; name: string; brand_name: string | null; /* ⚠️ company_joined の本文位置に出す（2026-08-13）。content は使わない */ tagline: string | null; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null; industry: string | null; employee_count: string | null; location: string | null; founded_year: number | null; /* ⚠️ 取り下げた企業の告知を出さないための判定に使う（isCompanyPostAlive・2026-08-13） */ is_published: boolean | null; is_test: boolean | null; /* ★「新しく掲載された企業」の枠は掲載中だけ（2026-10-26。FeedClient の buildHomeRailItems） */ listing_status?: string | null } | null;
type RefJob = { id: string; slug?: string | null; title: string; status?: string | null; is_test?: boolean | null; salary_min: number | null; salary_max: number | null; work_style: string | null; company: RefCompany } | null;
/* ⚠️ `ow_articles` に画像カラムは1つも無い（2026-08-13 に全28列を確認）。
      サムネイルは作れないので、記事ごとに違う `eyecatch_gradient` /
      `company_gradient_text` と `company_initial_text` で絵を作る。 */
type RefArticle = { id: string; slug: string; title: string; is_published: boolean | null; eyecatch_gradient?: string | null; company_initial_text?: string | null; company_gradient_text?: string | null; company_name_text?: string | null; /* ★検証用の判定（postRefersToTest）に使う */ company?: { is_test?: boolean | null } | null } | null;

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
  user: { id: string; name: string; avatar_color: string | null; avatar_url: string | null; visibility: string | null; is_system: boolean | null; is_test: boolean | null } | null;
  ref_company: RefCompany;
  ref_job: RefJob;
  ref_article: RefArticle;
  likes: { count: number }[];
  comments: { count: number }[];
};

/** フィードの1ページの件数（もっと読み込む API と同じ） */
export const FEED_PAGE_SIZE = 20;

export async function loadFeedProps() {
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
  /* ★ミニプロフィールカードの中身。**`/people` の左サイドバーと同じ `getPeopleSidebarData`**（2026-09-18）。
        ⚠️★`ow_experiences.role_title`（自由入力）を直に読む形に戻さないこと。
           それが `/people`（会社 ／ ow_roles名）と食い違っていた原因。 */
  let profileCard: ProfileCardProps | null = null;

  // 初期投稿を SSR でフェッチ（adminClient でコメント数・いいね数を確実に取得）
  // ⚠️ 読みは ow_posts_visible。参照先が消えた投稿（ref_* が NULL）を落とすビュー。
  //    ow_posts を直に引かないこと。除外条件はビュー1箇所に置いている。
  /* ★募集と記事の告知は、投稿の読み込み（新しい順 20件）とは別に引く（2026-10-20）。
        最初の20件はほぼ企業の掲載告知で、募集・記事の枠がスクロールするまで出なかった。
        ⚠️ initialPosts に混ぜないこと。続きの読み込みは最後の投稿の時刻を手がかりにするので、古い告知が混ざると途中の投稿が飛ぶ */
  const POST_SELECT = `
      id, content, post_type, ref_company_id, ref_job_id, ref_article_id,
      image_url, link_url, link_title, link_image_url, link_description, link_domain,
      event_title, event_starts_at, event_location, created_at, visibility,
      user:ow_users!user_id(id, name, avatar_color, avatar_url, visibility, is_system, is_test),
      ref_company:ow_companies!ref_company_id(id, slug, name, brand_name, tagline, logo_letter, logo_gradient, logo_url, employee_count, employee_count_band, location, founded_year, is_published, is_test, listing_status, ow_company_business_domains(is_primary, ow_business_domains(name))),
      ref_job:ow_jobs!ref_job_id(id, slug, title, status, is_test, salary_min, salary_max, work_style, company:ow_companies!company_id(id, slug, name, brand_name, logo_letter, logo_gradient, logo_url, is_test)),
      ref_article:ow_articles!ref_article_id(id, slug, title, is_published, eyecatch_gradient, company_initial_text, company_gradient_text, company_name_text, company:ow_companies!company_id(is_test)),
      likes:ow_post_likes(count),
      comments:ow_post_comments(count)
    `;
  const [sidebarResult, viewerIsTest, rawPostsResult, rawBlockResult, humanPostsResult] = await Promise.all([
    myOwUserId ? getPeopleSidebarData(myOwUserId) : Promise.resolve(null),
    viewerIsTestByAuthId(user?.id),
    adminSupabase
    .from("ow_posts_visible")
    .select(POST_SELECT)
    /* ★時刻 → id の2段（2026-10-28。lib/feed/cursor.ts）。同じ時刻の投稿の順を決める */
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(FEED_PAGE_SIZE),
    adminSupabase
      .from("ow_posts_visible")
      .select(POST_SELECT)
      .in("post_type", ["job_posted", "article_published"])
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(20),
    /* ★人が書いた投稿の数（お知らせを真ん中に混ぜるかの判定用。lib/feed/streamMode.ts）。見える判定は下で isPostVisibleTo を通す。
          ⚠️ しきい値ぶん見えれば足りるが、見えない投稿が混ざるので多めに引く */
    adminSupabase
      .from("ow_posts_visible")
      .select("id, visibility, user:ow_users!user_id(visibility, is_system, is_test)")
      .eq("post_type", "user_post")
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(500),
  ]);
  if (rawBlockResult.error) console.error("[feed] block posts:", rawBlockResult.error.message);
  if (humanPostsResult.error) console.error("[feed] human posts:", humanPostsResult.error.message);
  /* ★見える「人が書いた投稿」の数 → お知らせを真ん中に混ぜるか。⚠️ 取れなかったときは混ぜる側に倒す（真ん中が空になるよりよい） */
  const visibleHumanPostCount = ((humanPostsResult.data ?? []) as unknown as { visibility: string | null; user: { visibility: string | null; is_system: boolean | null; is_test: boolean | null } | null }[])
    .filter((h) => isPostVisibleTo({ postVisibility: h.visibility, author: h.user, refersToTest: false }, !!user, viewerIsTest)).length;
  const announcementsInStreamMode = humanPostsResult.error ? true : announcementsInStream(visibleHumanPostCount);

  /* ⚠️ 取得に失敗したら null のまま（カードごと出さない）。
        `getPeopleSidebarData` の中で列ごとに console.error を出している。 */
  if (sidebarResult) {
    profileCard = { me: sidebarResult.me, counts: sidebarResult.counts, nextStep: sidebarResult.nextStep };
  }

  const posts = (rawPostsResult.data ?? []) as unknown as RawPost[];
  /* ★続きの手がかりは「読んだ最後の行」から作る（見せない投稿を落としたあとの最後ではない。lib/feed/cursor.ts） */
  const initialPage = nextFeedPage(posts, FEED_PAGE_SIZE);
  const mainIds = new Set(posts.map((p) => p.id));
  const blockOnly = ((rawBlockResult.data ?? []) as unknown as RawPost[]).filter((p) => !mainIds.has(p.id));

  // liked_by_me
  let likedPostIds = new Set<string>();
  /* ★このあとの3つ（いいね済み / 投稿者の現職 / いいねした人）は
        **互いに依存しない**ので、可視判定のあとで1回にまとめて投げる。
        2026-08-23 まで3段の直列で、3往復ぶん待っていた。 */

  // 可視判定。⚠️ ここに if を増やさない。判定は lib/feed/visibility に集約している
  //    （3箇所に散っていた結果、パーマリンクだけ is_system の例外が抜けていた）
  /* ★担当者がいない会社の求人の「公開しました」も出さない（2026-10-27。lib/jobs/respondingJobs.ts） */
  const respondingForPosts = await respondingCompanyIds(jobPostCompanyIds([...posts, ...blockOnly]), "feed 求人の投稿");
  const visiblePosts = [...posts, ...blockOnly].filter(
    (p) =>
      isPostVisibleTo({ postVisibility: p.visibility, author: p.user, refersToTest: postRefersToTest(p) }, !!user, viewerIsTest) &&
      // 掲載を下ろした求人の「公開しました」投稿は出さない（押すと 404 になる）
      isJobPostAlive(p, respondingForPosts) &&
      // 取り下げた企業の「参加しました」投稿も同じく出さない（2026-08-13）
      isCompanyPostAlive(p) &&
      // 非公開にした記事の「公開しました」投稿も出さない（2026-10-20）
      isArticlePostAlive(p),
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
      : Promise.resolve({ data: null, error: null }),
    visibleIds.length > 0
      /* ★1,000 行ずつ最後まで（2026-10-19。人気の投稿が増えると「いいね」が黙って欠けた） */
      ? fetchAllRows((from, to) => adminSupabase.from("ow_post_likes")
          .select("post_id, created_at, user:ow_users!user_id(id, name, avatar_color, avatar_url)")
          .in("post_id", visibleIds).order("created_at", { ascending: false }).order("post_id").order("user_id").range(from, to), "feed likes")
          .then((r) => ({ data: r.data }))
      : Promise.resolve({ data: null }),
  ]);

  likedPostIds = new Set(((likedResult.data ?? []) as { post_id: string }[]).map((r) => r.post_id));

  {
    /* ⚠️ 型を狭めない。resolveExperienceCompanyName が会社名の解決に
          EXPERIENCE_COMPANY_COLS 一式を見る。 */
    if (expsResult.error) console.error("[feed/(list)] ow_experiences:", expsResult.error.message);
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

  const formattedPosts = visiblePosts.map((p) => {
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
  const initialPosts = formattedPosts.filter((p) => mainIds.has(p.id));
  const blockPosts = formattedPosts.filter((p) => !mainIds.has(p.id));

  // ── サイドバーデータ（並列取得） ─────────────────────────────────────────────
  const [followResult, userFollowResult, bookmarkResult, listedCompanies, careerMoveBlocks] = await Promise.all([
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
    getFeedSidebarCompanies(3),
    /* (e) ★「◯◯から次に進んだ人」（2026-10-19）。ログイン中だけ。失敗しても空で返る */
    myOwUserId ? getCareerMoveBlocks(myOwUserId) : Promise.resolve([] as CareerMoveBlock[]),
  ]);

  const sidebarFollows: SidebarFollow[] = (followResult.data ?? [])
    .map((r: Record<string, unknown>) => r["ow_companies"])
    .filter(Boolean) as SidebarFollow[];

  /* 投稿できる人だけにコンポーザーを出す。条件は lib/feed/canPost に集約している。
     ★2026-10-01 から「ログインしていること」だけ。**ここに条件を書き足さないこと。**
     ⚠️ 右レール「話を聞ける人」のフォロー状態（followedUserIds）は 2026-10-16 にパネルごと撤去した */
  const canPost = myOwUserId ? canUserPost(myOwUserId) : false;

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
      .select("id, slug, title, salary_min, salary_max, salary_negotiable, employment_type, company_id, ow_companies!company_id(name, brand_name)")
      .in("id", bookmarkedJobIds)
      .match(PUBLIC_JOB_MATCH);
    if (jobRowsErr) console.error("[feed/(list)] ow_jobs:", jobRowsErr.message);
    /* ★担当者がいない会社の求人は出さない（2026-10-27。lib/jobs/respondingJobs.ts） */
    sidebarSavedJobs = (await keepJobsAtRespondingCompanies((jobRows ?? []) as Record<string, unknown>[] as { company_id: string | null }[], "feed 保存した求人") as unknown as Record<string, unknown>[]).map((j: Record<string, unknown>) => {
      const co = j["ow_companies"] as { name: string; brand_name: string | null } | null;
      return {
        id: j.id as string,
        slug: (j.slug as string | null) ?? null,
        title: j.title as string,
        salary_min: j.salary_min as number | null,
        salary_max: j.salary_max as number | null,
        salary_negotiable: j.salary_negotiable === true,
        employment_type: (j.employment_type as string | null) ?? null,
        companyName: co?.brand_name ?? co?.name ?? null,
      };
    });
  }

  /* ⚠️ タグは**事業領域**。`industry`(text) は廃止予定で新規企業では空になる。 */
  const sidebarDomains = await fetchBusinessDomainsByCompany(
    adminSupabase, listedCompanies.companies.map((c) => c.id), "feed sidebar",
  );
  const sidebarCompanies: SidebarCompany[] = listedCompanies.companies.map((c) => ({
    id: c.id, slug: c.slug, name: c.name, tagline: c.tagline || null,
    industry: primaryBusinessDomain(sidebarDomains.get(c.id))?.name ?? null,
    logo_letter: c.logo_letter, logo_gradient: c.logo_gradient, logo_url: c.logo_url,
  }));

  return {
    initialPosts: initialPosts,
    initialCursor: initialPage.nextCursor,
    announcementsInStream: announcementsInStreamMode,
    initialHasMore: initialPage.hasMore,
    blockPosts: blockPosts,
    myUserId: myOwUserId,
    myName: owUser?.name ?? null,
    myAvatarColor: owUser?.avatar_color ?? null,
    myAvatarUrl: owUser?.avatar_url ?? null,
    profileCard: profileCard,
    myLikedPostIds: Array.from(likedPostIds),
    sidebarFollows: sidebarFollows,
    sidebarUserFollows: sidebarUserFollows,
    sidebarSavedJobs: sidebarSavedJobs,
    sidebarCompanies: sidebarCompanies,
    canPost: canPost,
    careerMoveBlocks: careerMoveBlocks,
    listedCompanyCount: listedCompanies.total,
  };
}

export type FeedProps = Awaited<ReturnType<typeof loadFeedProps>>;
