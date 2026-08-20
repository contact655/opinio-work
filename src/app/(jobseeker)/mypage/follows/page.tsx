export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FollowsClient, type FollowedCompany, type FollowedUser } from "./FollowsClient";

export const metadata: Metadata = {
  /* ⚠️ **`| OPINIO` を自分で書くなら `absolute` にする。** ルートの
          `template: "%s | OPINIO"`（app/layout.tsx）が後ろに足すので、
          素の `title` に書くと **「… | OPINIO | OPINIO」** になる。実測で3ページ該当した。 */
  title: { absolute: "フォロー中 | OPINIO" },
  robots: { index: false, follow: false },
};

/**
 * フォロー中の一覧。企業 / 人 をタブで出す。
 *
 * ⚠️ 取得は ow_follows_v（ow_company_follows と ow_user_follows の UNION）。
 *    テーブルは統合していないので、読むときだけこのビューでまとめる。
 * ⚠️ ビューは UNION なので PostgREST のリソース埋め込みが使えない。
 *    target_id から企業・ユーザーを引くのは別クエリにしている。
 */
export default async function FollowsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/mypage/follows");

  const admin = createAdminClient();
  const { data: me } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!me?.id) redirect("/auth?next=/mypage/follows");

  const { data: rows, error } = await admin
    .from("ow_follows_v")
    .select("target_type, target_id, created_at")
    .eq("follower_user_id", me.id)
    .order("created_at", { ascending: false });
  if (error) console.error("[mypage/follows]", error.message);

  const all = (rows ?? []) as { target_type: string; target_id: string; created_at: string }[];
  const companyIds = all.filter((r) => r.target_type === "company").map((r) => r.target_id);
  const userIds = all.filter((r) => r.target_type === "user").map((r) => r.target_id);

  let companies: FollowedCompany[] = [];
  if (companyIds.length > 0) {
    const { data } = await admin
      .from("ow_companies")
      .select("id, slug, name, brand_name, industry, logo_url, logo_letter, logo_gradient")
      .in("id", companyIds);
    // ow_follows_v の並び（新しい順）を保つ
    const byId = new Map((data ?? []).map((c) => [c.id, c]));
    companies = companyIds.map((id) => byId.get(id)).filter(Boolean) as FollowedCompany[];
  }

  let users: FollowedUser[] = [];
  if (userIds.length > 0) {
    const { data } = await admin
      .from("ow_users")
      .select("id, name, avatar_url, avatar_color, visibility")
      .in("id", userIds);
    // ⚠️ private の人は出さない。フォローしていても本人の非公開の意思が優先。
    const byId = new Map((data ?? []).filter((u) => u.visibility !== "private").map((u) => [u.id, u]));
    users = userIds.map((id) => byId.get(id)).filter(Boolean) as FollowedUser[];
  }

  return <FollowsClient companies={companies} users={users} />;
}
