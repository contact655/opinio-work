import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmployeesClient } from "./EmployeesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "社員管理 | OPINIO Business",
};

export type BizEmployee = {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  isMentor: boolean;
  roleTitle: string | null;
  startedAt: string;
  endedAt: string | null;
  isCurrent: boolean;
};

export default async function EmployeesPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const admin = createAdminClient();

  // ow_experiences で自社 company_id に紐づく全レコードを取得
  const { data: rows } = await admin
    .from("ow_experiences")
    .select(`
      user_id,
      role_title,
      started_at,
      ended_at,
      is_current,
      ow_users (
        id,
        name,
        avatar_url,
        is_mentor
      )
    `)
    .eq("company_id", ctx.tenantId)
    .order("started_at", { ascending: false });

  const employees: BizEmployee[] = (rows ?? []).flatMap((row: any) => {
    const user = row.ow_users;
    if (!user) return [];
    return [{
      userId: user.id as string,
      name: user.name as string | null,
      avatarUrl: user.avatar_url as string | null,
      isMentor: user.is_mentor === true,
      roleTitle: row.role_title as string | null,
      startedAt: row.started_at as string,
      endedAt: row.ended_at as string | null,
      isCurrent: row.is_current as boolean,
    }];
  });

  const current = employees.filter((e) => e.isCurrent);
  const alumni = employees.filter((e) => !e.isCurrent);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <EmployeesClient
        current={current}
        alumni={alumni}
        companyName={ctx.tenantName ?? ""}
      />
    </BusinessLayout>
  );
}
