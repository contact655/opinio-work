"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateCompanyAmbassadors } from "@/lib/supabase/queries";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: boolean; error?: string };

async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
}

/**
 * 運営が代理で承認する（`is_public` → true）。
 *
 * ── なぜ運営に要るか ────────────────────────────────────────────────────────
 * **掲載中79社のうち77社は通知の宛先が0件**（2026-08-23 実測）で、
 * 企業側に承認できる人がいない。運営が代理承認できないと、
 * 本人の申請は「会社の確認待ち」のまま宙吊りで終わる。
 *
 * ⚠️ 既存の `PATCH /api/biz/ambassador/update` は `getTenantContext()` 必須の
 *    **企業管理者専用**なので流用できない。だから Server Action を別に置く。
 *
 * ⚠️ **`ow_company_admins.is_ambassador` とは無関係。** あちらは別テーブルの別概念で、
 *    公開側からの参照が0件の死にフラグ（`/admin/biz-accounts` の「話せる人」トグル）。
 *    ここに合流させないこと。
 *
 * ⚠️ 承認は**在籍の確認**を意味する。`ow_experiences` の在籍は自己申告なので、
 *    運営が押す前に実態を確かめること（画面にもその旨を出している）。
 */
export async function approveRequest(memberId: string): Promise<ActionResult> {
  await assertAdmin();
  const admin = createAdminClient();

  /* ⚠️ 0行更新を成功として扱わない（CLAUDE.md）。`.select("...")` で戻り行を受ける。
        ⚠️ 引数なしの `.select()` を呼ばない。全列を返すため、列単位 GRANT を
           剥がした列があると 403 になる。 */
  const { data, error } = await admin
    .from("ow_company_members")
    .update({ is_public: true })
    .eq("id", memberId)
    .select("id, company_id");

  if (error) {
    console.error("[admin/ambassador-requests] approve:", error.message);
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "対象が見つかりませんでした（既に処理済みかもしれません）" };
  }

  /* ⚠️ 面談対応者のキャッシュを捨てる。7経路すべてで呼ぶ決まり
        （`companyAmbassadorsTag` のコメント参照）。忘れると最大60秒ズレる。 */
  revalidateCompanyAmbassadors(data[0].company_id as string);
  revalidatePath("/admin/ambassador-requests");
  return { ok: true };
}

/**
 * 運営が代理で見送る（行を DELETE）。
 *
 * ⚠️ **本人には通知が届かない。** 本人からは「申請が消えた」ようにしか見えず、
 *    却下の記録も残らない（器を作らないと決めた / 2026-08-23）。
 *    だから画面側で二段階の確認を挟んでいる。
 */
export async function dismissRequest(memberId: string): Promise<ActionResult> {
  await assertAdmin();
  const admin = createAdminClient();

  /* 消す前に company_id を取る。消したあとでは分からず、キャッシュを捨てられない。 */
  const { data: target, error: findErr } = await admin
    .from("ow_company_members")
    .select("company_id")
    .eq("id", memberId)
    .maybeSingle();
  if (findErr) {
    console.error("[admin/ambassador-requests] find:", findErr.message);
    return { ok: false, error: findErr.message };
  }
  if (!target) return { ok: false, error: "対象が見つかりませんでした" };

  const { data, error } = await admin
    .from("ow_company_members")
    .delete()
    .eq("id", memberId)
    .select("id");

  if (error) {
    console.error("[admin/ambassador-requests] dismiss:", error.message);
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "対象が見つかりませんでした" };
  }

  revalidateCompanyAmbassadors(target.company_id as string);
  revalidatePath("/admin/ambassador-requests");
  return { ok: true };
}
