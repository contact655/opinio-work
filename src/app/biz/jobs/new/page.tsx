import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { JobEditForm } from "@/components/business/JobEditForm";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchTeamMembers } from "@/lib/business/jobs";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RoleItem, DeptItem } from "@/components/business/JobEditForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "求人を作成 | OPINIO Business" },
};

export default async function JobNewPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.email ? user.email.split("@")[0] : "ご担当者";

  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage userName={userName} />;

  const adminClient = createAdminClient();
  const [teamMembers, rolesResult, deptsResult] = await Promise.all([
    fetchTeamMembers(supabase, ctx.tenantId),
    /*
      求人フォームの職種候補。
      ⚠️ is_active = true かつ is_it_saas = true で絞る（is_it_saas は 2026-08-06 に追加）。
         is_it_saas は「OPINIO の掲載企業（SaaS/IT）の求人で使う職種か」の意味に
         再定義した。非IT系の大分類7件（医療・建設・製造ほか）は求人には出さない。
         ⚠️ ユーザーの職歴入力（/profile/edit）ではこのフラグで絞らないこと。
            過去職歴には非IT職が入る。
    */
    adminClient.from("ow_roles").select("id, parent_id, name, level").eq("is_active", true).eq("is_it_saas", true).order("display_order", { ascending: true }),
    supabase.from("ow_company_departments").select("id, parent_id, name, display_order").eq("company_id", ctx.tenantId).is("deleted_at", null).order("display_order").order("name"),
  ]);

  const roles: RoleItem[] = (rolesResult.data ?? []) as RoleItem[];
  const departments: DeptItem[] = (deptsResult.data ?? []) as DeptItem[];

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      variant="fullBleed"
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <JobEditForm
        mode="new"
        companyId={ctx.tenantId}
        teamMembers={teamMembers}
        roles={roles}
        departments={departments}
      />
    </BusinessLayout>
  );
}
