"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function grantBonusCredits(companyId: string, amount: number): Promise<{ error?: string; quotaId?: string }> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("ow_scout_quotas")
    .select("id, bonus_credits")
    .eq("company_id", companyId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("ow_scout_quotas")
      .update({ bonus_credits: existing.bonus_credits + amount })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath("/admin/scout-quotas");
    return { quotaId: existing.id as string };
  } else {
    const { data, error } = await admin
      .from("ow_scout_quotas")
      .insert({ company_id: companyId, bonus_credits: amount, monthly_limit: 30, used_this_month: 0 })
      .select("id")
      .single();
    if (error) return { error: error.message };
    revalidatePath("/admin/scout-quotas");
    return { quotaId: (data as any).id as string };
  }
}

export async function updateMonthlyLimit(companyId: string, limit: number): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("ow_scout_quotas")
    .select("id")
    .eq("company_id", companyId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("ow_scout_quotas")
      .update({ monthly_limit: limit })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin
      .from("ow_scout_quotas")
      .insert({ company_id: companyId, monthly_limit: limit, bonus_credits: 0, used_this_month: 0 });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/scout-quotas");
  return {};
}
