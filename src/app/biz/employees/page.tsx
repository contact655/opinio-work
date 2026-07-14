import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmployeesClient } from "./EmployeesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "社員管理 | OPINIO Business" },
};

export type BizEmployee = {
  experienceId: string;
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

  // 全経歴を取得
  const { data: rows } = await admin
    .from("ow_experiences")
    .select(`
      id,
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

  // 非表示 experience_id 一覧
  const { data: hiddenRows } = await admin
    .from("ow_company_hidden_experiences")
    .select("experience_id")
    .eq("company_id", ctx.tenantId);
  const hiddenIds = new Set((hiddenRows ?? []).map((r: any) => r.experience_id as string));

  const employees: BizEmployee[] = (rows ?? []).flatMap((row: any) => {
    const user = row.ow_users;
    if (!user) return [];
    return [{
      experienceId: row.id as string,
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

  const current = employees.filter((e) => e.isCurrent && !hiddenIds.has(e.experienceId));
  const alumni = employees.filter((e) => !e.isCurrent && !hiddenIds.has(e.experienceId));
  const hidden = employees.filter((e) => hiddenIds.has(e.experienceId));

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
        hidden={hidden}
        companyName={ctx.tenantName ?? ""}
      />
    </BusinessLayout>
  );
}
