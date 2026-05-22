import { BusinessLayout } from "@/components/business/BusinessLayout";
import { ApplicationsClient } from "./ApplicationsClient";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchApplicationsForCompany } from "@/lib/business/applications";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "選考管理 | OPINIO Business",
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

export default async function BizApplicationsPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <NoTenantPage />;

  const supabase = createClient();
  const applications = await fetchApplicationsForCompany(supabase, ctx.tenantId);

  // 候補者ごとの conversation ID を一括取得してマッピング
  const userIds = Array.from(new Set(applications.map((a) => a.userId).filter(Boolean)));
  const convMap = new Map<string, string>(); // userId → conversationId
  if (userIds.length > 0) {
    const { data: convs } = await supabase
      .from("ow_conversations")
      .select("id, candidate_user_id")
      .eq("company_id", ctx.tenantId)
      .in("candidate_user_id", userIds);
    for (const c of convs ?? []) {
      if (c.candidate_user_id) {
        convMap.set(c.candidate_user_id as string, c.id as string);
      }
    }
  }

  // conversationId を applications に付与
  const appsWithConv = applications.map((a) => ({
    ...a,
    conversationId: convMap.get(a.userId) ?? undefined,
  }));

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <ApplicationsClient applications={appsWithConv} />
    </BusinessLayout>
  );
}
