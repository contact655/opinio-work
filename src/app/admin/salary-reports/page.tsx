import { createAdminClient } from "@/lib/supabase/admin";
import SalaryReportsAdminClient from "./SalaryReportsAdminClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "給与レポート審査 | OPINIO Admin" },
};

export default async function AdminSalaryReportsPage() {
  const admin = createAdminClient();

  const { data: reports } = await admin
    .from("ow_salary_reports")
    .select("*, ow_companies(id, name), ow_users(name)")
    .order("created_at", { ascending: false })
    .limit(300);

  return <SalaryReportsAdminClient initialReports={(reports ?? []) as Parameters<typeof SalaryReportsAdminClient>[0]["initialReports"]} />;
}
