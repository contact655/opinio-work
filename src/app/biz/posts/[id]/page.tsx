import { guardBizPage } from "@/lib/auth/companyAccess";
import { notFound } from "next/navigation";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { getCompanyStory } from "@/lib/companyStories/server";
import { StoryEditor } from "../StoryEditor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "ストーリーを編集 | OPINIO Business" },
};

/**
 * ★企業ストーリーの編集画面（2026-10-12）。`/biz/posts/new` は新しく書く。
 * ⚠️ いま選んでいる会社のストーリーだけ開ける。別の会社のものは 404（存在を区別させない）。
 */
export default async function BizStoryEditPage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;
  /* ★役割（2026-10-12）。権限が無ければホームへ（サイドバーにも出していない） */
  guardBizPage(ctx.currentPermission, "stories.edit");

  const story = params.id === "new" ? null : await getCompanyStory(ctx.tenantId, params.id);
  if (params.id !== "new" && !story) notFound();

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      {/* ⚠️★key を付けないこと。新しいストーリーは最初の保存で URL が /new から /<id> に変わり、
            公開・作成のあとはサーバーが画面を作り直す。key が変わると編集画面が作り直され、
            保存前に打っていた文字と表示中の状態が消える（2026-10-12 に一度踏んだ）。
            別のストーリーへは一覧（別の画面）を経由して移るので、持ち越しは起きない。 */}
      <StoryEditor initial={story} />
    </BusinessLayout>
  );
}
