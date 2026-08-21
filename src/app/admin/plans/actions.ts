"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { PLAN_TYPES, BILLING_CYCLES, PLAN_MONTHLY_FEE, type PlanType, type BillingCycle } from "@/lib/constants/plans";

export type ActionResult = { ok: boolean; error?: string };

async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
}

/**
 * プランを変更する。
 *
 * ⚠️ **上書きしない。履歴として積む。**
 *    いまの active な行に `ended_at` を入れて `status='ended'` にし、
 *    新しい行を1本 INSERT する。「いつからいつまで何プランだったか」を
 *    後から再構成できるようにするため。
 *
 * ⚠️ 1社に active が2本ある状態を作らないこと。
 *    先に閉じてから入れる。順序を逆にしない。
 */
export async function changePlan(
  companyId: string,
  planType: string,
  billingCycle: string,
): Promise<ActionResult> {
  await assertAdmin();

  /* ⚠️ 許容値は `lib/constants/plans.ts` の1箇所に置いてある。
        ここで `new Set([...])` を書かない（書いた瞬間に UI と割れる）。
        DB 側にも同じ CHECK があり、3つ揃えている。 */
  if (!(PLAN_TYPES as readonly string[]).includes(planType)) {
    return { ok: false, error: `不正なプランです: ${planType}` };
  }
  if (!(BILLING_CYCLES as readonly string[]).includes(billingCycle)) {
    return { ok: false, error: `不正な支払い周期です: ${billingCycle}` };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // ① いまの active を閉じる
  const { data: closed, error: closeErr } = await admin
    .from("ow_company_plans")
    .update({ status: "ended", ended_at: now })
    .eq("company_id", companyId)
    .eq("status", "active")
    .select("id");

  /* ⚠️ 0行更新を成功として扱わない（CLAUDE.md）。
        active が無い企業は本来存在しない（全社に1本入れてある）ので、
        0行なら company_id が違うか、行が消えている。 */
  if (closeErr) {
    console.error("[admin/plans] close failed:", closeErr.message);
    return { ok: false, error: "現在のプランを終了できませんでした" };
  }
  if ((closed?.length ?? 0) === 0) {
    return { ok: false, error: "この企業に有効なプランが見つかりませんでした" };
  }

  // ② 新しい行を積む
  const { error: insErr } = await admin
    .from("ow_company_plans")
    .insert({
      company_id: companyId,
      plan_type: planType as PlanType,
      billing_cycle: billingCycle as BillingCycle,
      /* ⚠️ 月額は**定数から入れる。画面から受け取らない。**
            運営が手で打つと、表示（LP）と記録（DB）が食い違う。
            金額を変えるときは `lib/constants/plans.ts` の
            `PAID_PLAN_MONTHLY_FEE` を直す。 */
      monthly_fee: PLAN_MONTHLY_FEE[planType as PlanType],
      started_at: now,
      ended_at: null,
      status: "active",
    });

  if (insErr) {
    console.error("[admin/plans] insert failed:", insErr.message);
    /* ⚠️ ①が通って②が落ちると、その企業は active なプランが無くなる。
          `canUse` は null を false に倒すので機能は閉じる（fail-closed）が、
          **運営が気づけるようにエラーを返す。** 握り潰さない。 */
    return { ok: false, error: "新しいプランを作成できませんでした。前のプランは終了済みです。もう一度設定してください。" };
  }

  revalidatePath("/admin/plans");
  return { ok: true };
}
