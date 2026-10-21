import { readAll } from "@/lib/supabase/paging";
import { createClient } from "@/lib/supabase/server";
import PostsAdminClient from "./PostsAdminClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "発信管理 | OPINIO Admin" },
};

export default async function AdminPostsPage() {
  const supabase = createClient();

  // 全企業を名前順で取得
  /* ★1,000行ずつ最後まで読む（2026-10-22。1,000行で黙って切れるため） */
  const { data: companies } = await readAll("admin/posts companies", (f, t) => supabase
    .from("ow_companies")
    .select("id, name")
    .order("name", { ascending: true })
    .order("id")
    .range(f, t));

  // 全発信リンクを取得（会社名も JOIN）
  const { data: posts } = await supabase
    .from("ow_company_external_links")
    .select("*, ow_companies(id, name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <PostsAdminClient
      companies={companies ?? []}
      initialPosts={(posts ?? []) as Parameters<typeof PostsAdminClient>[0]["initialPosts"]}
    />
  );
}
