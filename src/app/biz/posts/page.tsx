import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { PostsClient } from "./PostsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "投稿・発信管理 | OPINIO Business" },
};


export default async function BizPostsPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const supabase = createClient();

  const [{ data: externalLinks, error: linksErr }, { data: stories, error: storiesErr }] = await Promise.all([
    supabase
      .from("ow_company_external_links")
      .select("*")
      .eq("company_id", ctx.tenantId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),

    supabase
      .from("ow_company_posts")
      .select("*")
      .eq("company_id", ctx.tenantId)
      .order("created_at", { ascending: false }),
  ]);

  if (linksErr) console.error("[biz/posts] external_links fetch error:", linksErr.message);
  if (storiesErr) console.error("[biz/posts] stories fetch error:", storiesErr.message);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <PostsClient
        companyId={ctx.tenantId}
        companyName={ctx.tenantName}
        initialPosts={externalLinks ?? []}
        initialStories={stories ?? []}
      />
    </BusinessLayout>
  );
}
