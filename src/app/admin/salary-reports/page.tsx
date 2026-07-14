import { createAdminClient } from "@/lib/supabase/admin";
import SalaryReportsAdminClient from "./SalaryReportsAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminSalaryReportsPage() {
  const admin = createAdminClient();

  const [reportsRes, companiesRes, rolesRes] = await Promise.all([
    admin
      .from("ow_salary_reports")
      .select(`
        id, company_id, user_id, role_id,
        ote, annual_salary, base_salary, bonus_salary, incentive, stock_options,
        allowances, fixed_overtime,
        start_year_month, end_year_month, grade,
        years_of_experience, employment_status, prefecture,
        is_approved, is_flagged, proxy_note, created_at,
        ow_companies(name),
        ow_roles(name),
        ow_users(name)
      `)
      .order("created_at", { ascending: false }),
    admin
      .from("ow_companies")
      .select("id, name, brand_name")
      .eq("is_published", true)
      .order("name"),
    admin
      .from("ow_roles")
      .select("id, name, parent_id")
      .order("display_order", { ascending: true }),
  ]);

  if (reportsRes.error) {
    return <div style={{ padding: 32, color: "var(--error)" }}>エラー: {reportsRes.error.message}</div>;
  }

  const reports = (reportsRes.data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown>;
    return {
      id: r["id"] as string,
      company_id: r["company_id"] as string,
      user_id: r["user_id"] as string | null,
      role_id: r["role_id"] as string,
      ote: r["ote"] as number | null,
      annual_salary: r["annual_salary"] as number | null,
      base_salary: r["base_salary"] as number | null,
      bonus_salary: r["bonus_salary"] as number | null,
      incentive: r["incentive"] as number | null,
      stock_options: r["stock_options"] as number | null,
      allowances: r["allowances"] as number | null,
      fixed_overtime: r["fixed_overtime"] as number | null,
      start_year_month: r["start_year_month"] as string | null,
      end_year_month: r["end_year_month"] as string | null,
      grade: r["grade"] as string | null,
      years_of_experience: r["years_of_experience"] as number | null,
      employment_status: r["employment_status"] as string,
      prefecture: r["prefecture"] as string | null,
      is_approved: r["is_approved"] as boolean,
      is_flagged: r["is_flagged"] as boolean,
      proxy_note: r["proxy_note"] as string | null,
      created_at: r["created_at"] as string,
      company_name: (r["ow_companies"] as { name: string } | null)?.name ?? null,
      role_name: (r["ow_roles"] as { name: string } | null)?.name ?? null,
      user_name: (r["ow_users"] as { name: string } | null)?.name ?? null,
    };
  });

  const companies = (companiesRes.data ?? []).map((c) => ({
    id: c.id,
    name: (c.brand_name as string | null) || c.name,
  }));

  const roles = (rolesRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    parent_id: r.parent_id as string | null,
  }));

  const pendingCount = reports.filter((r) => !r.is_approved).length;
  const flaggedCount = reports.filter((r) => r.is_flagged).length;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 960 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>
          給与データ管理
        </h1>
        {pendingCount > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, background: "var(--warm-soft)", color: "#92400E", padding: "3px 10px", borderRadius: 100 }}>
            承認待ち {pendingCount}件
          </span>
        )}
        {flaggedCount > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, background: "#FDE68A", color: "#92400E", padding: "3px 10px", borderRadius: 100 }}>
            ⚠ フラグ {flaggedCount}件
          </span>
        )}
        <span style={{ fontSize: 11, fontWeight: 700, background: "var(--royal-50)", color: "var(--royal)", padding: "3px 10px", borderRadius: 100 }}>
          全 {reports.length}件
        </span>
      </div>
      <SalaryReportsAdminClient reports={reports} companies={companies} roles={roles} />
    </div>
  );
}
