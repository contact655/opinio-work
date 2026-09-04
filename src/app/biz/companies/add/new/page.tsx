import { BusinessLayout } from "@/components/business/BusinessLayout";
import { corporateDomainOfEmail } from "@/lib/constants/emailDomains";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateCompanyClient } from "./CreateCompanyClient";
import { fetchIndustryOptions } from "@/lib/companies/industries";

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


  /* ⚠️ ここにあった user_metadata の agreed_* の読み出しは 2026-08-25 に削除した。
        書き込んでいたのは /biz/auth の step 2 だけで、その step 2 自体が
        2026-07-23 以降到達不能だった（実データ 60人中0人）。
     ⚠️ 規約同意の記録は `ow_terms_agreements` に一本化してある。復活させないこと。 */
  /* ⚠️ 2026-08-25 に `pending_industry`(業種名) から `pending_industry_id`(ow_industries.id)
        へ変えた。**古いキーは読まない。** 業種名を id のつもりで渡すと、
        セレクトの value に一致せず**未選択として静かに保存される。** */
  const prefilledIndustryId = (user?.user_metadata?.pending_industry_id as string | undefined) ?? null;

  // 業種の選択肢（ow_industries のフラット20件）。⚠️ コードに書かない
  const industries = await fetchIndustryOptions(createAdminClient(), "biz/companies/add/new");

  // メールドメインで企業マスタを照合（LinkedIn的なドメインマッチング）。フリーメールは対象外
  /* ⚠️ フリーメールの一覧は `lib/constants/emailDomains.ts` に集約した（2026-09-04）。
        ここに書き戻さないこと。運営の依頼一覧が同じ判定を使う。 */
  const matchableDomain = corporateDomainOfEmail(user?.email);

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
      <BusinessLayout userName={userName} hasCompany={false}>
        <CreateCompanyClient
          userBadge={userBadge}
          prefilledCompanyName={prefilledCompanyName}
          prefilledCompanyId={prefilledCompanyId}
          prefilledIndustryId={prefilledIndustryId}
          industries={industries}
          emailDomain={matchableDomain}
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
        prefilledIndustryId={prefilledIndustryId}
        industries={industries}
        emailDomain={matchableDomain}
      />
    </BusinessLayout>
  );
}
