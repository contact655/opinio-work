import { MeetingsMockView } from "./MeetingsMockView";
import { MeetingsClient } from "./MeetingsClient";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchMeetingsForCompany } from "@/lib/business/meetings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "カジュアル面談 | Opinio Business",
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

export default async function BizMeetingsPage() {
  // dev mock mode
  if (process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true") {
    return <MeetingsMockView />;
  }

  const ctx = await getTenantContext();
  if (!ctx) return <NoTenantPage />;

  const supabase = createClient();
  const meetings = await fetchMeetingsForCompany(supabase, ctx.tenantId);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      planType={ctx.planType}
      variant="fullBleed"
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
