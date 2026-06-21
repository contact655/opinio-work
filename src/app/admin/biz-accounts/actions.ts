"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function toggleAmbassador(adminId: string, value: boolean): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("ow_company_admins")
    .update({ is_ambassador: value })
    .eq("id", adminId);

  if (error) {
    console.error("[toggleAmbassador]", error.message);
    throw new Error("更新に失敗しました");
  }

  revalidatePath("/admin/biz-accounts");
  revalidatePath("/people");
}

export async function updateTalkThemes(adminId: string, themes: string[]): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("ow_company_admins")
    .update({ talk_themes: themes })
    .eq("id", adminId);

  if (error) {
    console.error("[updateTalkThemes]", error.message);
    throw new Error("更新に失敗しました");
  }

  revalidatePath("/admin/biz-accounts");
  revalidatePath("/people");
}
