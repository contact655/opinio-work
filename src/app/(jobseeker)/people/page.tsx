// revalidate を無効化: auth によって表示が変わるため静的キャッシュ不可
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { getDirectoryPeople } from "@/lib/people/directory";
import { getRoleTree, getRoleAliases } from "@/lib/supabase/queries";
import { getPeopleSidebarData } from "@/lib/people/sidebarData";
import { getConsultantUserIds, getFeaturedConsultants, type ConsultantCard } from "@/lib/featuredConsultants/server";
import { PeopleListClient, type PrevCareerProps } from "./PeopleListClient";
import { getPathsView } from "@/lib/paths/server";
import { PrevCareerSummary } from "@/components/people/PrevCareerSummary";
import { prevCareerText, prevSelectionOf } from "@/lib/people/prevCareer";

/**
 * 登録ユーザーの一覧。
 *
 * 2026-08-04 に「企業が承認した所属を持つ人」から「登録ユーザー全体」に変更した。
 * 取得と表示条件は src/lib/people/directory.ts に集約している
 * （/people/role/[slug] の7ページと共有するため。片方だけ変えると食い違う）。
 *
 * robots は noindex。middleware でログイン必須にもしている。
 */
export const metadata: Metadata = {
  title: { absolute: "登録ユーザーを探す | OPINIO" },
  // ⚠️ スキルタグは 2026-08-04 に廃止した。ここに「スキル」と書かない。
  //    カードに出るのは 所属企業 / 職種（ow_roles）/ 経験年数 の3つ。
  description:
    "OPINIO に登録しているユーザーの一覧です。所属企業・職種・経験年数から、話を聞いてみたい人を探せます。",
  robots: { index: false, follow: false },
};

/* ★前の経歴（2026-11-03。旧 /paths をまとめた）。キーは lib/people/prevCareer.ts の PREV_PARAM */
type PeopleSearchParams = { prev_role?: string; prev_industry?: string; prev_company?: string };

export default async function PeoplePage({ searchParams }: { searchParams?: PeopleSearchParams }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  /* ⚠️ `roleAliases` は `getRoleAliases()`（**`/jobs` の検索と同じ辞書**）。
        キーワード検索を職種で当てるために渡す。**2つ目の辞書を作らないこと。**
        辞書は `unstable_cache`（revalidate 3600）＋ react `cache()` 済みなので、
        ここで呼んでも追加の往復は増えない。 */
  const [people, roleTree, roleAliases] = await Promise.all([
    getDirectoryPeople(!!user),
    getRoleTree(),
    getRoleAliases(),
  ]);

  // フォローボタンの初期状態。
  // ⚠️ middleware でログイン必須なので user は基本 null にならないが、
  //    ここで null を前提にしないこと（ゲート漏れが起きても壊れないようにする）。
  let myUserId: string | null = null;
  let followedUserIds: string[] = [];
  /* ★自分をフォローしている人（2026-09-18）。サイドバーの「フォロワー」を押したときの絞り込みに使う。
     ⚠️ 件数は `getFollowCounts` が別に数えている。**ここは id の一覧**で、用途が違う。 */
  let followerUserIds: string[] = [];
  let sidebar: Awaited<ReturnType<typeof getPeopleSidebarData>> = null;
  let prevCareer: PrevCareerProps | null = null;
  /* ★相談できる人（2026-11-12）。サイドバーはログイン中だけ出るので、読むのもログイン中だけ */
  let consultants: ConsultantCard[] = [];
  /* ★相談可能なユーザー全員（2026-11-12。?consult=1 の絞り込み）。読めなかったら null（チップを出さない） */
  let consultantUserIds: string[] | null = null;
  if (user) {
    const admin = createAdminClient();
    const { data: me, error: meErr } = await admin.from("ow_users").select("id, is_test").eq("auth_id", user.id).maybeSingle();
    if (meErr) console.error("[people] me:", meErr.message);
    myUserId = me?.id ?? null;
    if (myUserId) {
      const [outRes, inRes, sidebarData, pathsView, consultantList, consultantIds] = await Promise.all([
        admin.from("ow_user_follows").select("target_user_id").eq("follower_user_id", myUserId),
        admin.from("ow_user_follows").select("follower_user_id").eq("target_user_id", myUserId),
        getPeopleSidebarData(myUserId),
        /* ⚠️ autoStart: false。前の経歴を選んでいない /people を本人の経歴で勝手に絞らない */
        getPathsView(
          { role: searchParams?.prev_role, industry: searchParams?.prev_industry, company: searchParams?.prev_company },
          { owUserId: myUserId, isTest: me?.is_test === true },
          { autoStart: false },
        ),
        getFeaturedConsultants({ excludeOwUserId: myUserId }),
        getConsultantUserIds(),
      ]);
      consultants = consultantList;
      consultantUserIds = consultantIds;
      if (pathsView) {
        const start = pathsView.start;
        prevCareer = {
          options: pathsView.options,
          selfStart: pathsView.selfStart,
          selected: start ? prevSelectionOf(start) : { role: null, industry: null, company: null },
          activeLabel: start ? prevCareerText(start) : null,
          /* ★その経歴から次へ進んだ人（旧 /paths の個人カード）。一覧はこの人たちだけに絞る。⚠️ 人数は画面に出さない */
          notes: start
            ? Object.fromEntries((pathsView.cards ?? []).map((c) => [c.userId, `以前: ${c.fromLabel} → ${c.toIsCurrent ? "現在" : "次"}: ${c.toLabel}`]))
            : null,
          summary: start ? <PrevCareerSummary view={pathsView} /> : null,
        };
      }
      if (outRes.error) console.error("[people followedUserIds]", outRes.error.message);
      if (inRes.error) console.error("[people followerUserIds]", inRes.error.message);
      followedUserIds = (outRes.data ?? []).map((r: { target_user_id: string }) => r.target_user_id);
      followerUserIds = (inRes.data ?? []).map((r: { follower_user_id: string }) => r.follower_user_id);
      sidebar = sidebarData;
    }
  }

  // 職種フィルタは slug で持ち、ここで id に解決する。
  // クライアント側に ow_roles を渡さずに済ませるため。
  const roleSlugToId: Record<string, string> = {};
  for (const r of roleTree.topLevel) if (r.slug) roleSlugToId[r.slug] = r.id;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <PeopleListClient
        ambassadors={people}
        roleSlugToId={roleSlugToId}
        roleAliases={roleAliases}
        myUserId={myUserId}
        followedUserIds={followedUserIds}
        followerUserIds={followerUserIds}
        sidebar={sidebar}
        prevCareer={prevCareer}
        consultants={consultants}
        consultantUserIds={consultantUserIds}
      />
    </div>
  );
}
