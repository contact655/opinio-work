import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { CreateCompanyClient } from "./CreateCompanyClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "新しい会社を作成 | Opinio Business",
};

export default async function CreateCompanyPage() {
  const ctx = await getTenantContext();

  // ログインユーザー情報（テナントの有無に関わらず取得）
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userBadge = user
    ? {
        name: (user.user_metadata?.name as string | undefined) || user.email?.split("@")[0] || "ご担当者",
        email: user.email ?? "",
      }
    : null;

  // テナントなし（初回登録 or 企業未所属）でもフォームを表示する
  // Phase 3: ヘッダーバッジで「○○さんのアカウントで企業を作成」を表示
  if (!ctx) {
    const userName = userBadge?.name ?? "ご担当者";
    return (
      <BusinessLayout userName={userName}>
        <CreateCompanyClient userBadge={userBadge} />
      </BusinessLayout>
    );
  }

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <CreateCompanyClient userBadge={userBadge} />
    </BusinessLayout>
  );
}
