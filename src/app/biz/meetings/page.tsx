import { MeetingsMockView } from "./MeetingsMockView";
import { MeetingsClient } from "./MeetingsClient";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchMeetingsForCompany } from "@/lib/business/meetings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "カジュアル面談 | OPINIO Business" },
};

export default async function BizMeetingsPage() {
  // dev mock mode
  if (process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true") {
    return <MeetingsMockView />;
  }

  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const supabase = createClient();
  const meetings = await fetchMeetingsForCompany(supabase, ctx.tenantId);

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
      <MeetingsClient
        meetings={meetings}
        tenantName={ctx.tenantName}
        currentUser={{
          owUserId: ctx.currentOwnId,
          name: ctx.userName,
          initial: ctx.userName.charAt(0),
          gradient: ctx.currentOwnerGradient,
        }}
      />
    </BusinessLayout>
  );
}
