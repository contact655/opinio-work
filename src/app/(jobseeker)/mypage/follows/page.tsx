export const dynamic = "force-dynamic";

import { companyLinkStateFor } from "@/lib/companies/linkState";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FollowsClient, type FollowedCompany, type FollowedUser } from "./FollowsClient";
import { isRegisteredUser, REGISTERED_USER_COL } from "@/lib/users/registered";

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
  const { data: me } = await admin.from("ow_users").select("id, is_test").eq("auth_id", user.id).maybeSingle();
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
    /* ⚠️ ここから下、Supabase の呼び出しは `error` を必ず受けてログに出す（2026-08-29）。
          捨てると **RLS も GRANT も 400 も、すべて「0件」に化ける**。`?? []` で受けている
          側からは区別が付かず、画面には**節ごと消えたようにしか見えない**。
          ⚠️ `try/catch` では捕まらない。supabase-js はエラーを**戻り値**で返す。 */
    const { data, error: qErr } = await admin
      .from("ow_companies")
      /* ⚠️ サブテキストは**事業領域**。`industry`(text) は廃止予定で新規企業では空。 */
      /* ⚠️★`is_published` / `is_test` を**必ず取る**（2026-09-27）。落とすと `undefined` に
            なり、下の判定が静かに「生きている」側へ倒れる。 */
      .select("id, slug, name, brand_name, logo_url, logo_letter, logo_gradient, is_published, is_test, ow_company_business_domains(is_primary, ow_business_domains(name))")
      .in("id", companyIds);
    if (qErr) console.error("[mypage/follows] ow_companies:", qErr.message);
    /* ⚠️ 埋め込みを `industry` に**畳んでから**渡す。畳まないと FollowsClient 側は
          `c.industry` が undefined になり、**型は optional なので tsc も lint も通ったまま
          サブテキストだけが黙って消える**（フィードで同じ形を踏んだ）。
       ⚠️ キー名は据え置き。中身は事業領域名で、`ow_companies.industry`(text) ではない。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flatten = (c: any) => {
      const links = (c.ow_company_business_domains ?? []) as {
        is_primary: boolean; ow_business_domains: { name: string } | null;
      }[];
      const { ow_company_business_domains: _, is_published, is_test, ...rest } = c;
      /* ★開けないものはリンクを外して理由を出す（2026-09-27 / B案。`/mypage/bookmarks` と同じ）。
            ⚠️★**一覧から落とさない。** 本人がフォローしたものなので、黙って消すと
               理由の分からないまま記録が減る。
            ⚠️★**詳細の軸**で見る（`is_published` = 404 ゲート）。ディレクトリ非掲載
               （`listing_status='draft'`）は**開けるので外さない**。
            ⚠️ 理由は断定しない（運営が下ろしたのか企業が下ろしたのかは分からない）。 */
      /* ★見ている人と会社がどちらも検証用なら、終了とは出さず文字だけ（2026-10-11。`companyLinkStateFor`） */
      const state = companyLinkStateFor({ isTest: is_test, isPublished: is_published }, { viewerIsTest: me.is_test === true });
      return {
        ...rest,
        industry: links.find((l) => l.is_primary)?.ow_business_domains?.name ?? null,
        gone_label: state === "closed" ? "公開を終了しました" : undefined,
        no_link: state === "open_test" ? true : undefined,
      };
    };
    // ow_follows_v の並び（新しい順）を保つ
    const byId = new Map((data ?? []).map((c) => [c.id, flatten(c)]));
    companies = companyIds.map((id) => byId.get(id)).filter(Boolean) as FollowedCompany[];
  }

  let users: FollowedUser[] = [];
  if (userIds.length > 0) {
    const { data, error: qErr } = await admin
      .from("ow_users")
      /* ⚠️★`auth_id` を落とさないこと。落とすと `isRegisteredUser` が**全員 false** を返し、
            **人のタブが丸ごと空になる**（`registered.ts` の注記）。型では気づけない。 */
      .select(`id, name, avatar_url, avatar_color, visibility, ${REGISTERED_USER_COL}, is_test, is_system`)
      .in("id", userIds);
    if (qErr) console.error("[mypage/follows] ow_users:", qErr.message);
    // ⚠️ private の人は出さない。フォローしていても本人の非公開の意思が優先。
    const byId = new Map((data ?? []).filter((u) => u.visibility !== "private").map((u) => {
      /* ★`/u/[id]` が 404 にする条件と揃える（2026-09-27）。あちらは
            `isRegisteredUser` が false なら `notFound()` を返す。
         ⚠️★**ここで落とさずリンクだけ外す。** 企業側と同じ扱い（B案）。
         ⚠️ `is_test` / `is_system` も `/u/[id]` 側の一覧条件に合わせて見る。 */
      const alive = isRegisteredUser(u as { auth_id?: string | null })
        && u.is_test !== true && u.is_system !== true;
      /* ⚠️ クライアントへ渡す列は絞る。`auth_id` / `is_test` / `is_system` は
            **判定に使うだけ**で、画面には要らない（運営の情報を配らない）。 */
      return [u.id, {
        id: u.id, name: u.name, avatar_url: u.avatar_url,
        avatar_color: u.avatar_color, visibility: u.visibility,
        gone_label: alive ? undefined : "表示できません",
      }];
    }));
    users = userIds.map((id) => byId.get(id)).filter(Boolean) as FollowedUser[];
  }

  return <FollowsClient companies={companies} users={users} />;
}
