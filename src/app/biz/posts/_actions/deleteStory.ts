"use server";

import { createClient } from "@/lib/supabase/server";
import { mutateOne } from "@/lib/supabase/mutate";
import { revalidatePath } from "next/cache";

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function deleteStory(
  id: string
): Promise<ActionResult> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "ログインしてください" };

  // 所属確認: 削除対象のストーリーが自社のものかをチェック
  const { data: story } = await supabase
    .from("ow_company_posts")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();
  if (!story) return { success: false, error: "権限がありません" };
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return { success: false, error: "権限がありません" };

  const { data: membership } = await supabase
    .from("ow_company_admins")
    .select("id")
    .eq("company_id", story.company_id)
    .eq("user_id", owUser.id)
    .maybeSingle();
  if (!membership) return { success: false, error: "権限がありません" };

  /* ⚠️ **0行削除を成功として扱わない**（CLAUDE.md）。RLS に弾かれても
        `error` は null で返るため、削除できていないのに成功と表示される。 */
  const res = await mutateOne(
    supabase.from("ow_company_posts").delete().eq("id", id),
    "biz deleteStory",
  );
  const error = res.ok ? null : { message: res.error };

  if (error) {
    console.error("[deleteStory]", error);
    return { success: false, error: "削除に失敗しました" };
  }

  revalidatePath("/biz/posts");
  return { success: true, data: null };
}
