"use server";

import { createClient } from "@/lib/supabase/server";
import { mutateOne } from "@/lib/supabase/mutate";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./createPost";

export async function deletePost(id: string): Promise<ActionResult<null>> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "ログインしてください" };
  }

  // 所属確認: 削除対象の投稿が自社のものかをチェック
  const { data: post } = await supabase
    .from("ow_company_external_links")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();
  if (!post) return { success: false, error: "権限がありません" };
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return { success: false, error: "権限がありません" };

  const { data: membership } = await supabase
    .from("ow_company_admins")
    .select("id")
    .eq("company_id", post.company_id)
    .eq("user_id", owUser.id)
    .maybeSingle();
  if (!membership) return { success: false, error: "権限がありません" };

  /* ⚠️ **0行削除を成功として扱わない**（CLAUDE.md）。RLS に弾かれても
        `error` は null で返るため、削除できていないのに成功と表示される。 */
  const res = await mutateOne(
    supabase.from("ow_company_external_links").delete().eq("id", id),
    "biz deletePost",
  );
  const error = res.ok ? null : { message: res.error };

  if (error) {
    console.error("[deletePost] error:", error);
    return {
      success: false,
      error: "削除に失敗しました",
    };
  }

  revalidatePath("/biz/posts");
  return { success: true, data: null };
}
