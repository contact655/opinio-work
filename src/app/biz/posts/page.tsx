import { guardBizPage } from "@/lib/auth/companyAccess";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { listCompanyStories, storyViewTotals } from "@/lib/companyStories/server";
import { PostsClient } from "./PostsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "企業ストーリー | OPINIO Business" },
};

/**
 * ★企業ストーリーの一覧（2026-10-12 にカードの一覧にした）。編集は `/biz/posts/[id]`。
 * ⚠️ 読むのは lib/companyStories/server.ts（admin クライアント。未公開の変更の表はクライアントから読めない）。
 * ⚠️ 閲覧数は ow_page_view_daily（page_type = story）。2026-10-12 から数えている。取れなければ出さない。
 */
export default async function BizPostsPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;
  /* ★役割（2026-10-12）。権限が無ければホームへ（サイドバーにも出していない） */
  guardBizPage(ctx.currentPermission, "stories.edit");

  const [stories, views] = await Promise.all([listCompanyStories(ctx.tenantId), storyViewTotals(ctx.tenantId)]);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <PostsClient initialStories={stories} views={views} />
    </BusinessLayout>
  );
}
