import { BusinessLayout } from "@/components/business/BusinessLayout";
import { JobEditForm } from "@/components/business/JobEditForm";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { mockTenantContext } from "@/lib/business/mockTenantContext";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "求人を作成 | Opinio Business",
};

export default async function JobNewPage() {
  // Mock mode
  if (process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true") {
    const ctx = mockTenantContext;
    return (
      <BusinessLayout
        userName={ctx.userName}
        tenantName={ctx.tenantName}
        tenantLogoGradient={ctx.logoGradient}
        tenantLogoLetter={ctx.logoLetter}
        planType={ctx.planType}
        variant="fullBleed"
      >
        <JobEditForm mode="new" />
      </BusinessLayout>
    );
  }

  // Production
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.email ? user.email.split("@")[0] : "ご担当者";

  const ctx = await getTenantContext();
  if (!ctx) {
    return (
      <BusinessLayout userName={userName} variant="fullBleed">
        <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--ink-mute)" }}>
          企業アカウントが必要です
        </div>
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      planType={ctx.planType}
      variant="fullBleed"
    >
      <JobEditForm mode="new" />
    </BusinessLayout>
  );
}
