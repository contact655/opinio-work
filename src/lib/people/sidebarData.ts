import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileCardData } from "@/components/common/ProfileCard";
import { getFollowCounts } from "@/lib/people/followCounts";
import { getRoleTree } from "@/lib/supabase/queries";
import { resolveTopRole } from "@/lib/roles/jobRoles";
import { EXPERIENCE_COMPANY_COLS, resolveExperienceCompanyLabel } from "@/lib/experiences/companyName";

/**
 * `/people` の左サイドバーが要る「自分の情報」をまとめて引く（2026-09-18）。
 *
 * ⚠️★**`getDirectoryPeople()` の結果から自分を探す形にしないこと。**
 *    あれは `is_test` / `is_system` / `auth_id IS NULL` を除外するので、
 *    **検証用アカウントで見ると自分が居らず、サイドバーが丸ごと空になる。**
 *    ここは自分の行を直接引く。
 *
 * ⚠️ 読むのは admin クライアント。`ow_users.birth_date` などは
 *    `authenticated` に SELECT を配っていない列があり、セッションクライアントだと
 *    **クエリごと 403 になって全部 0 件に化ける**（CLAUDE.md）。
 *    ⚠️ そのぶん `.eq("user_id", 自分)` が唯一の防波堤。**他人の行を引かないこと。**
 */

export type PeopleSidebarData = {
  me: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    gradient: string;
    initial: string;
    affiliation: string | null;
  };
  /** ⚠️★型は `ProfileCard` に集約している。ここで作り直さないこと（割れると片方だけ直る） */
  counts: ProfileCardData["counts"];
  nextStep: { label: string; href: string } | null;
  /** ⚠️ `null` は「`ow_company_members` の行が無い」＝サイドバーに行ごと出さない */
  meetingOk: boolean | null;
  myRole: { slug: string; label: string } | null;
  /** 在籍した企業の id（現職・過去）。⚠️ 画面に出さない。突き合わせにだけ使う */
  myCompanyIds: string[];
};

const FALLBACK_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";

/**
 * 次に埋めるとよい項目を**1つだけ**返す。
 *
 * ⚠️★**割合（%）も件数（あと N 項目）も出さないこと。**
 *    完成度バーは 2026-08-16 に廃止、2026-09-10 に「%も『あと N 項目』も出さない」と
 *    決めてある（docs/profile-progress-20260910.md）。ここは**次の1件**だけ。
 *
 * ⚠️★**生年月日を入れないこと。** ここが勧めるのは「埋めると**他のユーザーに伝わる**項目」で、
 *    **他のユーザーに出ない項目**を混ぜると嘘になる。
 *    ⚠️ 2026-09-20 まで、この理由を画面の説明文が担っていたが、
 *       **その一文は同日に削除した**（柴さんの指示）。**規則は変えていない。**
 *    ⚠️ 同じ理由で希望条件（スカウト用の非公開情報）も入れない。
 *    ⚠️ これは `calcPublicScore` が `PUBLIC_KEYS` から prefs / birth を外しているのと同じ線。
 */
function pickNextStep(d: {
  experienceCount: number;
  hasAvatar: boolean;
  hasAboutMe: boolean;
  hasHeadline: boolean;
  educationCount: number;
}): { label: string; href: string } | null {
  if (d.experienceCount === 0) return { label: "職歴を追加する", href: "/mypage" };
  if (!d.hasAvatar) return { label: "プロフィール写真を追加する", href: "/mypage" };
  if (!d.hasHeadline) return { label: "肩書きを1行で書く", href: "/mypage" };
  if (!d.hasAboutMe) return { label: "自己紹介を書く", href: "/mypage" };
  if (d.educationCount === 0) return { label: "学歴を追加する", href: "/mypage" };
  /* ⚠️ 全部埋まっていたら **null**。「完了！」を出さない（達成の演出は情報を増やさない） */
  return null;
}

export async function getPeopleSidebarData(owUserId: string): Promise<PeopleSidebarData | null> {
  const db = createAdminClient();

  const [userRes, expRes, eduRes, memberRes, companyFollowRes, savedJobRes, counts, roleTree] = await Promise.all([
    db.from("ow_users").select("id, name, avatar_url, avatar_color, headline, about_me").eq("id", owUserId).maybeSingle(),
    /* ⚠️★**並び順を指定すること**（2026-09-18）。下で `find(is_current)` が
          **配列の先頭の現職**を代表に採るので、順序を空けると
          **並行在籍（現職が2件以上）の人の所属行と「同じ職種の人」が、
          リロードのたびに入れ替わりうる。**
       ⚠️★**`id` のタイブレーカーを外さないこと。** 同着は実在する
          （検証用アカウントに `started_at` が同日の現職が2件ある）。
          CLAUDE.md の「開始日が同着の2社が実行ごとに入れ替わる」と同じ形。
       ⚠️ `directory.ts`（一覧のカード）も**同じ並びにしてある**。片方だけ変えると、
          自分のサイドバーと自分のカードで所属が食い違う。 */
    db.from("ow_experiences")
      .select(`id, is_current, started_at, ended_at, role_category_id, ${EXPERIENCE_COMPANY_COLS}`)
      .eq("user_id", owUserId)
      .order("started_at", { ascending: false })
      .order("id", { ascending: true }),
    db.from("ow_user_educations").select("id", { count: "exact", head: true }).eq("user_id", owUserId),
    db.from("ow_company_members").select("id, is_public, display_consent").eq("user_id", owUserId),
    db.from("ow_company_follows").select("id", { count: "exact", head: true }).eq("follower_user_id", owUserId),
    /* ★保存した募集（♡）。⚠️ **フォローではない。** 募集に「フォロー」は存在せず、
          `ow_bookmarks` の `target_type='job'` が唯一の実体（2026-09-18 に確認）。
       ⚠️ `posts/route.ts` の `followedJobIds` は「**フォロー中の企業の求人**」の意味で別物。
          ここと混ぜないこと。 */
    db.from("ow_bookmarks").select("id", { count: "exact", head: true })
      .eq("user_id", owUserId).eq("target_type", "job"),
    getFollowCounts(owUserId),
    getRoleTree(),
  ]);

  /* ⚠️ error を捨てない。権限や列名の間違いが「0件」に化ける（CLAUDE.md） */
  if (userRes.error) console.error("[peopleSidebar ow_users]", userRes.error.message);
  if (expRes.error) console.error("[peopleSidebar ow_experiences]", expRes.error.message);
  if (eduRes.error) console.error("[peopleSidebar ow_user_educations]", eduRes.error.message);
  if (memberRes.error) console.error("[peopleSidebar ow_company_members]", memberRes.error.message);
  if (companyFollowRes.error) console.error("[peopleSidebar ow_company_follows]", companyFollowRes.error.message);
  if (savedJobRes.error) console.error("[peopleSidebar ow_bookmarks]", savedJobRes.error.message);

  const u = userRes.data;
  if (!u?.name) return null;

  const exps = (expRes.data ?? []) as Array<Record<string, unknown>>;
  const current = exps.find((e) => e.is_current === true) ?? null;

  /* 所属の1行。⚠️ 「会社 ／ ow_roles名」に統一した（2026-09-18 / 柴さんの判断）。
     フィードが `ow_experiences.role_title`（自由入力）を出していて食い違っていたのを揃えたもの。
     ⚠️ `role_title` に戻さないこと。粒度が人によってばらつく（null 3件 / 長文5件の実測）。 */
  const roleNode = current?.role_category_id
    ? roleTree.byId.get(current.role_category_id as string) ?? null
    : null;
  const companyLabel = current ? resolveExperienceCompanyLabel(current as never) : null;
  const affiliation = [companyLabel, roleNode?.name].filter(Boolean).join(" ／ ") || null;

  /* 大分類の slug。⚠️ 現職が無ければ null（「同じ職種の人」を出さない）。推測で埋めない */
  const topRole = current?.role_category_id
    ? resolveTopRole(roleTree, current.role_category_id as string)
    : null;

  const members = memberRes.data ?? [];

  return {
    me: {
      userId: u.id,
      name: u.name,
      avatarUrl: u.avatar_url ?? null,
      gradient: typeof u.avatar_color === "string" && u.avatar_color.startsWith("linear-gradient")
        ? u.avatar_color : FALLBACK_GRADIENT,
      initial: u.name.charAt(0),
      affiliation,
    },
    counts: {
      following: counts.following,
      followers: counts.followers,
      companies: companyFollowRes.count ?? 0,
      savedJobs: savedJobRes.count ?? 0,
    },
    nextStep: pickNextStep({
      experienceCount: exps.length,
      hasAvatar: !!u.avatar_url,
      hasAboutMe: !!(u.about_me as string | null)?.trim(),
      hasHeadline: !!(u.headline as string | null)?.trim(),
      educationCount: eduRes.count ?? 0,
    }),
    /* ⚠️ 行が無ければ null（サイドバーは行ごと出さない）。false と混ぜないこと */
    meetingOk: members.length === 0
      ? null
      : members.some((m) => m.is_public === true && m.display_consent === true),
    myRole: topRole?.slug ? { slug: topRole.slug, label: topRole.name } : null,
    myCompanyIds: Array.from(new Set(exps.flatMap((e) => (e.company_id ? [e.company_id as string] : [])))),
  };
}
