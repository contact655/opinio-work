import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateCompanyClient } from "./CreateCompanyClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "新しい会社を作成 | OPINIO Business" },
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


  // biz auth 登録時の規約同意フラグ（user_metadata から）
  const agreedTermsBusiness = (user?.user_metadata?.agreed_terms_business as boolean | undefined) ?? false;
  const agreedFeePct15 = (user?.user_metadata?.agreed_fee_pct15 as boolean | undefined) ?? false;
  const agreedTermsVersion = (user?.user_metadata?.agreed_terms_version as string | undefined) ?? null;
  const prefilledIndustry = (user?.user_metadata?.pending_industry as string | undefined) ?? null;

  // メールドメインで企業マスタを照合（LinkedIn的なドメインマッチング）
  const emailDomain = user?.email ? user.email.split("@")[1]?.toLowerCase() ?? null : null;
  // フリーメールドメインはマッチング対象外
  const FREE_DOMAINS = ["gmail.com", "yahoo.co.jp", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "me.com", "live.com", "googlemail.com"];
  const matchableDomain = emailDomain && !FREE_DOMAINS.includes(emailDomain) ? emailDomain : null;

  // ユーザー登録時に入力した所属企業を取得
  // 優先順位: user_metadata.pending_company > ow_experiences.is_current=true
  let prefilledCompanyName: string | null = null;
  let prefilledCompanyId: string | null = null;
  if (user) {
    // 1. biz auth 登録時に保存した会社名
    const metaCompany = (user.user_metadata?.pending_company as string | undefined) ?? null;
    if (metaCompany) {
      prefilledCompanyName = metaCompany;
    } else {
      // 2. 求職者プロフィールの現職企業
      const admin = createAdminClient();
      const { data: owUser } = await admin
        .from("ow_users")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();
      if (owUser) {
        // 2a. 求職者プロフィールの現職企業
        const { data: exp } = await admin
          .from("ow_experiences")
          .select("company_text, company_id, ow_companies(name)")
          .eq("user_id", owUser.id)
          .eq("is_current", true)
          .maybeSingle();
        if (exp) {
          prefilledCompanyName = (exp.ow_companies as unknown as { name: string } | null)?.name ?? exp.company_text ?? null;
          prefilledCompanyId = (exp.company_id as string | null) ?? null;
        }

        // 2b. 既存の company_admin 所属企業
        if (!prefilledCompanyName) {
          const { data: adminRow } = await admin
            .from("ow_company_admins")
            .select("ow_companies(id, name)")
            .eq("user_id", owUser.id)
            .maybeSingle();
          const co = (adminRow?.ow_companies as unknown as { id: string; name: string } | null);
          if (co) {
            prefilledCompanyName = co.name;
            prefilledCompanyId = co.id;
          }
        }
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
          prefilledCompanyName={prefilledCompanyName}
          prefilledCompanyId={prefilledCompanyId}
          prefilledIndustry={prefilledIndustry}
          emailDomain={matchableDomain}
          agreedTermsBusiness={agreedTermsBusiness}
          agreedFeePct15={agreedFeePct15}
          agreedTermsVersion={agreedTermsVersion}
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
        prefilledCompanyName={prefilledCompanyName}
        prefilledCompanyId={prefilledCompanyId}
        prefilledIndustry={prefilledIndustry}
        emailDomain={matchableDomain}
        agreedTermsBusiness={agreedTermsBusiness}
        agreedFeePct15={agreedFeePct15}
        agreedTermsVersion={agreedTermsVersion}
      />
    </BusinessLayout>
  );
}
