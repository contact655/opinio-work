import { createAdminClient } from "@/lib/supabase/admin";
import { PlansClient, type CompanyPlanRow, type PlanHistoryRow } from "./PlansClient";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "プラン管理 | OPINIO Admin" } };

/*
 * 運営がプランを設定する画面。
 *
 * ⚠️ **決済は実装していない。** 請求は当面手作業。この画面がやるのは
 *    「どの企業がいまどのプランか」を記録することだけ。
 *
 * ⚠️ **プランの正は `ow_company_plans`。** `ow_companies.plan` は廃止予定で読まない。
 *
 * ⚠️ 一覧は**企業管理者が紐付いている企業だけ**に絞っている（2026-08-22 時点で7社）。
 *    87社を並べても、担当者が居ない企業のプランを変える意味が無い。
 *    絞りを外すときは、件数が増えても一覧が使えるかを確かめること。
 */
export default async function AdminPlansPage() {
  const admin = createAdminClient();

  // 企業管理者が1人でも居る企業
  const { data: adminRows, error: adminErr } = await admin
    .from("ow_company_admins")
    .select("company_id")
    .eq("is_active", true);
  if (adminErr) console.error("[admin/plans] ow_company_admins:", adminErr.message);

  const companyIds = Array.from(new Set((adminRows ?? []).map((r) => r.company_id as string)));

  const [{ data: companies, error: cErr }, { data: plans, error: pErr }] = await Promise.all([
    admin.from("ow_companies")
      .select("id, name, is_published, is_approved")
      .in("id", companyIds.length > 0 ? companyIds : ["00000000-0000-0000-0000-000000000000"])
      .order("name"),
    admin.from("ow_company_plans")
      .select("id, company_id, plan_type, billing_cycle, monthly_fee, started_at, ended_at, status")
      .in("company_id", companyIds.length > 0 ? companyIds : ["00000000-0000-0000-0000-000000000000"])
      .order("started_at", { ascending: false }),
  ]);
  /* ⚠️ error を捨てない。捨てると権限エラーが「0件」に化ける。 */
  if (cErr) console.error("[admin/plans] ow_companies:", cErr.message);
  if (pErr) console.error("[admin/plans] ow_company_plans:", pErr.message);

  const byCompany = new Map<string, PlanHistoryRow[]>();
  for (const p of plans ?? []) {
    const list = byCompany.get(p.company_id as string) ?? [];
    list.push({
      id: p.id as string,
      planType: p.plan_type as string,
      billingCycle: (p.billing_cycle as string) ?? "monthly",
      monthlyFee: (p.monthly_fee as number | null) ?? null,
      startedAt: p.started_at as string | null,
      endedAt: p.ended_at as string | null,
      status: p.status as string,
    });
    byCompany.set(p.company_id as string, list);
  }

  const rows: CompanyPlanRow[] = (companies ?? []).map((c) => {
    const history = byCompany.get(c.id as string) ?? [];
    return {
      companyId: c.id as string,
      companyName: (c.name as string) ?? "(名称未設定)",
      isPublished: c.is_published === true,
      isApproved: c.is_approved === true,
      /* ⚠️ active が無ければ null。既定値 'free' で埋めない
            （「まだ設定していない」と「無料と決めた」を混ぜないため）。 */
      current: history.find((h) => h.status === "active") ?? null,
      history,
    };
  });

  return <PlansClient rows={rows} />;
}
