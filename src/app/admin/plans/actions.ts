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
 *
 * ── ★月額（`monthlyFee`）について（2026-09-21 に画面から受け取る形へ変えた）───
 * **`lib/constants/plans.ts` の `PAID_PLAN_MONTHLY_FEE` は「定価」で、
 * `ow_company_plans.monthly_fee` は「その企業と実際に結んだ額」。別のもの。**
 * 企業ごとに違う額で契約することがあるので、運営が画面で打てるようにした。
 *
 * ⚠️★**したがって LP の定価と DB の記録は食い違いうる。** それは不具合ではない。
 *    ⚠️ 画面側は定価を初期値に入れ、**違う額を打つと注意書きを出す**
 *       （`PlansClient`）。**その注意書きを消さないこと** —— 打ち間違いと
 *       個別契約を見分ける手段がこれしか無い。
 * ⚠️ **省略されたら定価を入れる。** 呼び出し側が渡し忘れたときに 0 で記録されると、
 *    有料契約が無料として残る。
 */
export async function changePlan(
  companyId: string,
  planType: string,
  billingCycle: string,
  monthlyFee?: number,
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

  /* ⚠️ 列は `integer`。小数・負数・桁の打ち間違いをここで止める。
        ⚠️★DB 側に CHECK は無い（金額に「正しい範囲」を決められないため）。
           **この検証が唯一の歯止め。** 上限は桁の打ち間違い（0 を1つ多く打つ）を
           捕まえるためだけの値で、意味のある上限ではない。 */
  const fee = monthlyFee ?? PLAN_MONTHLY_FEE[planType as PlanType];
  if (!Number.isInteger(fee) || fee < 0 || fee > 100_000_000) {
    return { ok: false, error: `不正な月額です: ${monthlyFee}` };
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
      /* ⚠️ 記録するのは**その企業と結んだ額**（上の注記）。
            LP に出す定価を変えるなら `lib/constants/plans.ts` の
            `PAID_PLAN_MONTHLY_FEE` を直す。**ここを直しても定価は変わらない。** */
      monthly_fee: fee,
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
