import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { PostsClient } from "./PostsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "発信リンク管理 | Opinio Business",
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

export default async function BizPostsPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <NoTenantPage />;

  const supabase = createClient();

  const { data: posts } = await supabase
    .from("ow_company_external_links")
    .select("*")
    .eq("company_id", ctx.tenantId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

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
      <PostsClient
        companyId={ctx.tenantId}
        companyName={ctx.tenantName}
        initialPosts={posts ?? []}
      />
    </BusinessLayout>
  );
}
