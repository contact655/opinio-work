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
  const VALID_VISIBILITY = new Set(["public", "login_only", "private"]);
  if (!VALID_VISIBILITY.has(visibility)) {
    return { ok: false, error: "Invalid visibility value" };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("ow_users")
    .update({ visibility })
    .in("id", userIds);
  if (error) return { ok: false, error: "表示設定の更新に失敗しました" };
  revalidatePath("/admin/candidates");
  return { ok: true };
}

/*
  ⚠️ toggleCanTalkToCandidates（ow_users.can_talk_to_candidates）は 2026-08-05 に削除した。
     本番0件・参照は管理画面の表示だけ・何もゲートしていない、の3つが揃っていたため。
     「話せるか」の判定は can_casual_meeting が担っている（2026-08-04 に talk_themes の
     件数から切り替えたときに置き去りになった3つ目の概念だった）。
     ⚠️ カラムは残してある。復活させるなら、まず can_casual_meeting との違いを定義すること。
*/

/**
 * can_casual_meeting の切り替え。
 * この値が true の人だけが LP の「いま話を聞ける現役社員」枠と
 * /u/[id] のカジュアル面談CTAに出る（掲載 ≠ 面談可）。
 *
 * 本来は本人が設定すべき値だが、現状 /profile/edit に導線が無いため
 * 運営が代理で設定する。can_talk_to_hr との統合は別タスク。
 */
export async function toggleCanCasualMeeting(
  userId: string,
  value: boolean
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("ow_users")
    .update({ can_casual_meeting: value })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/candidates");
  // LP の FV カードはこの値で出し分けるので、あわせて再検証する
  revalidatePath("/");
  return { ok: true };
}

export async function bulkDeleteUsers(
  userIds: string[]
): Promise<{ ok: boolean; deleted: number; error?: string }> {
  await assertAdmin();
  if (userIds.length === 0) return { ok: true, deleted: 0 };
  if (userIds.length > 100) return { ok: false, deleted: 0, error: "一度に削除できるユーザーは100件までです" };
  const admin = createAdminClient();

  // auth_id を取得
  const { data: rows, error: fetchErr } = await admin
    .from("ow_users")
    .select("id, auth_id")
    .in("id", userIds);
  if (fetchErr) return { ok: false, deleted: 0, error: "ユーザー情報の取得に失敗しました" };

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
