import { createAdminClient } from "@/lib/supabase/admin";
import ScoutQuotasClient from "./ScoutQuotasClient";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "スカウト枠管理 | OPINIO Admin" } };

export default async function ScoutQuotasPage() {
  const admin = createAdminClient();

  // ow_scout_quotas + 企業名
  const { data: quotaRows } = await admin
    .from("ow_scout_quotas")
    .select("id, company_id, monthly_limit, bonus_credits, used_this_month, period_start, ow_companies(id, name)")
    .order("company_id");

  // ow_companies で枠未設定の企業も含める
  const { data: allCompanies } = await admin
    .from("ow_companies")
    .select("id, name")
    .eq("is_published", true)
    .order("name");

  const quotaMap = new Map((quotaRows ?? []).map((q: any) => [q.company_id as string, q]));

  const quotas = (allCompanies ?? []).map((c: any) => {
    const q = quotaMap.get(c.id as string);
    return {
      companyId: c.id as string,
      companyName: c.name as string,
      quotaId: (q?.id as string) ?? null,
      monthlyLimit: (q?.monthly_limit as number) ?? 30,
      bonusCredits: (q?.bonus_credits as number) ?? 0,
      usedThisMonth: (q?.used_this_month as number) ?? 0,
      periodStart: (q?.period_start as string) ?? null,
    };
  });

  return <ScoutQuotasClient quotas={quotas} />;
}
