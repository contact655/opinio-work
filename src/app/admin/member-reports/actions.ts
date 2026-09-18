"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { revalidatePath } from "next/cache";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";
import { revalidateCompanyAmbassadors } from "@/lib/supabase/queries";

export type ActionResult = { ok: boolean; error?: string };

async function assertAdmin(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
  return user.id;
}

/** `auth.users.id` → `ow_users.id`。⚠️ 空間が違う（`resolved_by` は ow_users 空間） */
async function resolveOwUserId(authUserId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("ow_users").select("id").eq("auth_id", authUserId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * 報告を「対応済み」にする（元に戻せる）。
 *
 * ⚠️ **企業ページから外す操作とは別。** ここは運営の作業キューの印で、
 *    実際に外すのは下の `hideExperience`。片方だけでも成立する
 *    （例: 確認したが在籍していたので外さない → 対応済みだけ立てる）。
 */
export async function toggleResolved(reportId: string, resolved: boolean): Promise<ActionResult> {
  const authUserId = await assertAdmin();
  const owUserId = resolved ? await resolveOwUserId(authUserId) : null;

  const admin = createAdminClient();
  const r = await mutateOne(
    admin
      .from("ow_company_member_reports")
      .update({
        resolved_at: resolved ? new Date().toISOString() : null,
        resolved_by: owUserId,
      })
      .eq("id", reportId),
    "member report 対応済み",
  );
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath("/admin/member-reports");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * 企業ページから外す / 戻す（`ow_company_hidden_experiences`）。
 *
 * ⚠️★**この表は運営専用**（2026-09-18 / B7）。企業側の書き込み経路は削除した。
 * ⚠️ 外すと求職者側の見え方が変わるので、**企業ページのキャッシュを捨てる**。
 *    捨てないと「外したのに出ている」が最大5分続く。
 */
export async function setHidden(
  companyId: string,
  experienceId: string,
  hidden: boolean,
): Promise<ActionResult> {
  await assertAdmin();
  const admin = createAdminClient();

  if (hidden) {
    const { error } = await admin
      .from("ow_company_hidden_experiences")
      .insert({ company_id: companyId, experience_id: experienceId });
    /* ⚠️ 23505 は「既に外してある」。押し直しても壊れない形にする。 */
    if (error && error.code !== "23505") {
      console.error("[admin/member-reports] hide:", error.message);
      return { ok: false, error: "非表示にできませんでした。" };
    }
  } else {
    /* ⚠️ 0行でも正常（既に戻っている）。`mutateOne` を使わない。 */
    const { error } = await admin
      .from("ow_company_hidden_experiences")
      .delete()
      .eq("company_id", companyId)
      .eq("experience_id", experienceId);
    if (error) {
      console.error("[admin/member-reports] unhide:", error.message);
      return { ok: false, error: "表示に戻せませんでした。" };
    }
  }

  await revalidateCompanyPages(companyId);
  /* ⚠️★**面談対応者のキャッシュも捨てる**（2026-09-18）。B7 で
        `getPublicAmbassadorsCached` が非表示を見るようになったので、
        ここを呼ばないと「外したのに『話を聞ける人』には残る」が最大300秒続く。 */
  revalidateCompanyAmbassadors(companyId);
  revalidatePath("/admin/member-reports");
  return { ok: true };
}
