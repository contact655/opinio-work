// revalidate を無効化: auth によって表示が変わるため静的キャッシュ不可
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { getDirectoryPeople } from "@/lib/people/directory";
import { getRoleTree, getRoleAliases } from "@/lib/supabase/queries";
import { PeopleListClient } from "./PeopleListClient";

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

export default async function PeoplePage() {
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
  if (user) {
    const admin = createAdminClient();
    const { data: me } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
    myUserId = me?.id ?? null;
    if (myUserId) {
      const { data: fRows, error } = await admin
        .from("ow_user_follows")
        .select("target_user_id")
        .eq("follower_user_id", myUserId);
      if (error) console.error("[people followedUserIds]", error.message);
      followedUserIds = (fRows ?? []).map((r: { target_user_id: string }) => r.target_user_id);
    }
  }

  // 職種フィルタは slug で持ち、ここで id に解決する。
  // クライアント側に ow_roles を渡さずに済ませるため。
  const roleSlugToId: Record<string, string> = {};
  for (const r of roleTree.topLevel) if (r.slug) roleSlugToId[r.slug] = r.id;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <PeopleListClient ambassadors={people} roleSlugToId={roleSlugToId} roleAliases={roleAliases} myUserId={myUserId} followedUserIds={followedUserIds} />
    </div>
  );
}
