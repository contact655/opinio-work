import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import MypageLayout from "../_components/MypageLayout";
import SalaryListClient from "./SalaryListClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "投稿した給与データ | OPINIO", robots: { index: false, follow: false } };

export interface MySalaryReport {
  id: string;
  company_id: string;
  company_name: string | null;
  role_id: string;
  role_name: string | null;
  ote: number | null;
  annual_salary: number | null;
  base_salary: number | null;
  bonus_salary: number | null;
  incentive: number | null;
  stock_options: number | null;
  allowances: number | null;
  fixed_overtime: number | null;
  start_year_month: string | null;
  end_year_month: string | null;
  grade: string | null;
  years_of_experience: number | null;
  employment_status: string;
  prefecture: string | null;
  is_approved: boolean;
  is_flagged: boolean;
  created_at: string;
}

export interface RoleOption { id: string; name: string; parent_id: string | null; }

export default async function MySalaryPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/mypage/salary");

  const admin = createAdminClient();
  const { data: owUser } = await admin
    .from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();

  let reports: MySalaryReport[] = [];
  let roles: RoleOption[] = [];

  if (owUser) {
    const [reportsRes, rolesRes] = await Promise.all([
      admin
        .from("ow_salary_reports")
        .select(`
          id, company_id, role_id,
          ote, annual_salary, base_salary, bonus_salary, incentive, stock_options,
          allowances, fixed_overtime,
          start_year_month, end_year_month, grade,
          years_of_experience, employment_status, prefecture,
          is_approved, is_flagged, created_at,
          ow_companies(name),
          ow_roles(name)
        `)
        .eq("user_id", owUser.id)
        .order("created_at", { ascending: false }),
      admin
        .from("ow_roles")
        .select("id, name, parent_id")
        .order("display_order", { ascending: true }),
    ]);

    reports = (reportsRes.data ?? []).map((row) => {
      const r = row as unknown as Record<string, unknown>;
      return {
        id: r["id"] as string,
        company_id: r["company_id"] as string,
        company_name: (r["ow_companies"] as { name: string } | null)?.name ?? null,
        role_id: r["role_id"] as string,
        role_name: (r["ow_roles"] as { name: string } | null)?.name ?? null,
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
        created_at: r["created_at"] as string,
      };
    });

    roles = (rolesRes.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      parent_id: r.parent_id as string | null,
    }));
  }

  return (
    <MypageLayout activeKey="salary">
      <SalaryListClient reports={reports} roles={roles} />
    </MypageLayout>
  );
}
