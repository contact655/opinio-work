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
        annual_salary, base_salary, bonus_salary, incentive, stock_options,
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

  const reports = (reportsRes.data ?? []).map((r) => ({
    id: r.id,
    company_id: r.company_id,
    user_id: (r.user_id as string | null),
    role_id: r.role_id,
    annual_salary: r.annual_salary,
    base_salary: (r as Record<string, unknown>).base_salary as number | null ?? null,
    bonus_salary: (r as Record<string, unknown>).bonus_salary as number | null ?? null,
    incentive: (r as Record<string, unknown>).incentive as number | null ?? null,
    stock_options: (r as Record<string, unknown>).stock_options as number | null ?? null,
    years_of_experience: r.years_of_experience,
    employment_status: r.employment_status,
    prefecture: r.prefecture,
    is_approved: r.is_approved,
    is_flagged: r.is_flagged,
    proxy_note: (r as Record<string, unknown>).proxy_note as string | null ?? null,
    created_at: r.created_at,
    company_name: ((r.ow_companies as unknown) as { name: string } | null)?.name ?? null,
    role_name: ((r.ow_roles as unknown) as { name: string } | null)?.name ?? null,
    user_name: ((r.ow_users as unknown) as { name: string } | null)?.name ?? null,
  }));

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
