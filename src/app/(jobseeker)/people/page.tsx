// revalidate を無効化: auth によって表示が変わるため静的キャッシュ不可
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { getDirectoryPeople } from "@/lib/people/directory";
import { getRoleTree } from "@/lib/supabase/queries";
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
  description:
    "OPINIO に登録しているユーザーの一覧です。経歴・スキルから、話を聞いてみたい人を探せます。",
  robots: { index: false, follow: false },
};

export default async function PeoplePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [people, roleTree] = await Promise.all([
    getDirectoryPeople(!!user),
    getRoleTree(),
  ]);

  // 職種フィルタは slug で持ち、ここで id に解決する。
  // クライアント側に ow_roles を渡さずに済ませるため。
  const roleSlugToId: Record<string, string> = {};
  for (const r of roleTree.topLevel) if (r.slug) roleSlugToId[r.slug] = r.id;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <PeopleListClient ambassadors={people} roleSlugToId={roleSlugToId} />
    </div>
  );
}
