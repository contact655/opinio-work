"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function togglePublish(
  id: string,
  publish: boolean
): Promise<ActionResult<Record<string, unknown>>> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "ログインしてください" };

  // 所属確認: ストーリーが自社のものかをチェック
  const { data: existing } = await supabase
    .from("ow_company_posts")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { success: false, error: "権限がありません" };
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) return { success: false, error: "権限がありません" };

  const { data: membership } = await supabase
    .from("ow_company_admins")
    .select("id")
    .eq("company_id", existing.company_id)
    .eq("user_id", owUser.id)
    .maybeSingle();
  if (!membership) return { success: false, error: "権限がありません" };

  const { data: story, error } = await supabase
    .from("ow_company_posts")
    .update({
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[togglePublish]", error);
    return { success: false, error: "更新に失敗しました" };
  }

  /* ⚠️★2026-09-07 追加。それまで `/biz/posts` しか revalidate しておらず、
        企業ストーリーを公開しても求職者側の企業ページは `revalidate` 待ちだった。
     ⚠️ ストーリーは `getCompanyStoriesCached`（unstable_cache 60秒）越しだが、
        **`revalidatePath` で一緒に落ちる**（2026-09-08 に本番でツールで実測）。 */
  await revalidateCompanyPages(existing.company_id as string);
  revalidatePath("/biz/posts");
  return { success: true, data: story as Record<string, unknown> };
}
