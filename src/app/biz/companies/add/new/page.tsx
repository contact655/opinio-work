import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateCompanyClient } from "./CreateCompanyClient";
import type { Genre } from "@/components/ui/GenreChipSelector";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "新しい会社を作成 | OPINIO Business" },
};

export default async function CreateCompanyPage() {
  const ctx = await getTenantContext();

  // ログインユーザー情報（テナントの有無に関わらず取得）
  const supabase = createClient();
  const [{ data: { user } }, genresResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("ow_genres")
      .select("slug, name, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
  ]);

  const userBadge = user
    ? {
        name: (user.user_metadata?.name as string | undefined) || user.email?.split("@")[0] || "ご担当者",
        email: user.email ?? "",
      }
    : null;

  const availableGenres: Genre[] = (genresResult.data ?? []) as Genre[];

  // ユーザー登録時に入力した所属企業を取得（ow_experiences.is_current=true）
  let prefilledCompanyName: string | null = null;
  let prefilledCompanyId: string | null = null;
  if (user) {
    const admin = createAdminClient();
    const { data: owUser } = await admin
      .from("ow_users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();
    if (owUser) {
      const { data: exp } = await admin
        .from("ow_experiences")
        .select("company_text, company_id, ow_companies(name)")
        .eq("user_id", owUser.id)
        .eq("is_current", true)
        .maybeSingle();
      if (exp) {
        const companyName = (exp.ow_companies as unknown as { name: string } | null)?.name ?? exp.company_text ?? null;
        prefilledCompanyName = companyName;
        prefilledCompanyId = (exp.company_id as string | null) ?? null;
      }
    }
  }

  // テナントなし（初回登録 or 企業未所属）でもフォームを表示する
  if (!ctx) {
    const userName = userBadge?.name ?? "ご担当者";
    return (
      <BusinessLayout userName={userName}>
        <CreateCompanyClient
          userBadge={userBadge}
          availableGenres={availableGenres}
          prefilledCompanyName={prefilledCompanyName}
          prefilledCompanyId={prefilledCompanyId}
        />
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
      <CreateCompanyClient
        userBadge={userBadge}
        availableGenres={availableGenres}
        prefilledCompanyName={prefilledCompanyName}
        prefilledCompanyId={prefilledCompanyId}
      />
    </BusinessLayout>
  );
}
