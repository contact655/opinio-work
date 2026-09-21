import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { PostsClient } from "./PostsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "企業ストーリー | OPINIO Business" },
};


export default async function BizPostsPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const supabase = createClient();

  /* ⚠️ 外部リンク（ow_company_external_links）は 2026-09-21 から取らない。
        どこにも表示されない入力欄だったので外した（PostsClient の注記） */
  const { data: stories, error: storiesErr } = await supabase
    .from("ow_company_posts")
    .select("*")
    .eq("company_id", ctx.tenantId)
    .order("created_at", { ascending: false });
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
        initialStories={stories ?? []}
      />
    </BusinessLayout>
  );
}
