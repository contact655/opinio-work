import { createAdminClient } from "@/lib/supabase/admin";
import SalaryReportsAdminClient from "./SalaryReportsAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminSalaryReportsPage() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ow_salary_reports")
    .select(`
      id, company_id, user_id, role_id,
      annual_salary, years_of_experience, employment_status, prefecture,
      is_approved, is_flagged, created_at,
      ow_companies(name),
      ow_roles(name),
      ow_users(name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return <div style={{ padding: 32, color: "var(--error)" }}>エラー: {error.message}</div>;
  }

  const reports = (data ?? []).map((r) => ({
    id: r.id,
    company_id: r.company_id,
    user_id: r.user_id,
    role_id: r.role_id,
    annual_salary: r.annual_salary,
    years_of_experience: r.years_of_experience,
    employment_status: r.employment_status,
    prefecture: r.prefecture,
    is_approved: r.is_approved,
    is_flagged: r.is_flagged,
    created_at: r.created_at,
    company_name: ((r.ow_companies as unknown) as { name: string } | null)?.name ?? null,
    role_name: ((r.ow_roles as unknown) as { name: string } | null)?.name ?? null,
    user_name: ((r.ow_users as unknown) as { name: string } | null)?.name ?? null,
  }));

  const pendingCount = reports.filter((r) => !r.is_approved).length;
  const flaggedCount = reports.filter((r) => r.is_flagged).length;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>
          給与レポート審査
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
      </div>
      <SalaryReportsAdminClient reports={reports} />
    </div>
  );
}
