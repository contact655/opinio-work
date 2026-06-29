"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
}

export async function bulkSetVisibility(
  userIds: string[],
  visibility: "public" | "login_only" | "private"
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  if (userIds.length === 0) return { ok: true };
  const admin = createAdminClient();
  const { error } = await admin
    .from("ow_users")
    .update({ visibility })
    .in("id", userIds);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/candidates");
  return { ok: true };
}

export async function bulkDeleteUsers(
  userIds: string[]
): Promise<{ ok: boolean; deleted: number; error?: string }> {
  await assertAdmin();
  if (userIds.length === 0) return { ok: true, deleted: 0 };
  const admin = createAdminClient();

  // auth_id を取得
  const { data: rows, error: fetchErr } = await admin
    .from("ow_users")
    .select("id, auth_id")
    .in("id", userIds);
  if (fetchErr) return { ok: false, deleted: 0, error: fetchErr.message };

  let deleted = 0;
  const withoutAuth: string[] = [];

  for (const row of rows ?? []) {
    if (row.auth_id) {
      // auth.users を削除 → ow_users は CASCADE で自動削除
      const { error } = await admin.auth.admin.deleteUser(row.auth_id);
      if (!error) deleted++;
    } else {
      withoutAuth.push(row.id);
    }
  }

  // auth_id なし（ダミーユーザー等）は直接削除
  if (withoutAuth.length > 0) {
    const { error } = await admin.from("ow_users").delete().in("id", withoutAuth);
    if (!error) deleted += withoutAuth.length;
  }

  revalidatePath("/admin/candidates");
  return { ok: true, deleted };
}
