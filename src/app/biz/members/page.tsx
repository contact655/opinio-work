import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchMembersForCompany, fetchPendingInvitesForCompany } from "@/lib/business/members";
import { getOwUserId } from "@/lib/business/company";
import { createClient } from "@/lib/supabase/server";
import { MembersClient } from "./MembersClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "チーム管理 | Opinio Business",
};

async function NoTenantPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.email ? user.email.split("@")[0] : "ご担当者";
  return (
    <BusinessLayout userName={userName}>
      <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--ink-mute)" }}>
        企業アカウントが必要です
      </div>
    </BusinessLayout>
  );
}

export default async function MembersPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <NoTenantPage />;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [members, pendingInvites, currentUserId] = await Promise.all([
    fetchMembersForCompany(supabase, ctx.tenantId),
    fetchPendingInvitesForCompany(supabase, ctx.tenantId),
    user ? getOwUserId(supabase, user.id) : Promise.resolve(null),
  ]);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      planType={ctx.planType}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <MembersClient
        initialMembers={members}
        initialPendingInvites={pendingInvites}
        currentUserId={currentUserId ?? ""}
      />
    </BusinessLayout>
  );
}
