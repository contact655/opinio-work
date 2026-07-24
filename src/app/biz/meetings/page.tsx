import { PipelineClient } from "./PipelineClient";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchMeetingsForCompany } from "@/lib/business/meetings";
import { fetchApplicationsForCompany } from "@/lib/business/applications";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "採用パイプライン | OPINIO Business" },
};

export default async function BizMeetingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const supabase = createClient();
  const [meetings, applications] = await Promise.all([
    fetchMeetingsForCompany(supabase, ctx.tenantId),
    fetchApplicationsForCompany(supabase, ctx.tenantId),
  ]);

  // conversationId を applications に付与
  const userIds = Array.from(new Set(applications.map((a) => a.userId).filter(Boolean)));
  const convMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: convs } = await supabase
      .from("ow_conversations")
      .select("id, candidate_user_id")
      .eq("company_id", ctx.tenantId)
      .in("candidate_user_id", userIds);
    for (const c of convs ?? []) {
      if (c.candidate_user_id) convMap.set(c.candidate_user_id as string, c.id as string);
    }
  }
  const appsWithConv = applications.map((a) => ({
    ...a,
    conversationId: convMap.get(a.userId) ?? undefined,
  }));

  const initialTab = searchParams.tab === "applications" ? "applications" : "meetings";

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
      <PipelineClient
        meetings={meetings}
        applications={appsWithConv}
        tenantName={ctx.tenantName}
        currentUser={{
          owUserId: ctx.currentOwnId,
          name: ctx.userName,
          initial: ctx.userName.charAt(0),
          gradient: ctx.currentOwnerGradient,
        }}
        initialTab={initialTab}
      />
    </BusinessLayout>
  );
}
