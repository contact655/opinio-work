"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function updateSetting(key: string, value: string) {
  const admin = createAdminClient();
  await admin.from("ow_settings").upsert({ key, value }, { onConflict: "key" });
  revalidatePath("/admin/settings");
  revalidatePath("/reviews");
}
