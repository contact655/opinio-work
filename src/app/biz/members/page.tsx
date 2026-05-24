import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchMembersForCompany, fetchPendingInvitesForCompany } from "@/lib/business/members";
import { createClient } from "@/lib/supabase/server";
import { MembersClient } from "./MembersClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "チーム管理 | OPINIO Business",
};


export default async function MembersPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const supabase = createClient();

  const [members, pendingInvites] = await Promise.all([
    fetchMembersForCompany(supabase, ctx.tenantId),
    fetchPendingInvitesForCompany(supabase, ctx.tenantId),
  ]);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <MembersClient
        initialMembers={members}
        initialPendingInvites={pendingInvites}
        currentUserId={ctx.currentOwnId}
        isAdmin={ctx.currentPermission === "admin"}
      />
    </BusinessLayout>
  );
}
