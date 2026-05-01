"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./createPost";

export async function deletePost(id: string): Promise<ActionResult<null>> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "ログインしてください" };
  }

  const { error } = await supabase
    .from("ow_company_external_links")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deletePost] error:", error);
    return {
      success: false,
      error: `削除に失敗しました: ${error.message}`,
    };
  }

  revalidatePath("/biz/posts");
  return { success: true, data: null };
}
