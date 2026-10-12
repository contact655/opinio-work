import { can } from "@/lib/auth/roles";
import { guardBizPage } from "@/lib/auth/companyAccess";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchCompanyForTenant } from "@/lib/business/company";
import { fetchOfficePhotosForCompany } from "@/lib/business/photos";
import { createClient } from "@/lib/supabase/server";
import { CompanyEditClient } from "./CompanyEditClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAgreedTerms } from "@/lib/business/termsAgreement";
import { loadClassificationMasters } from "@/lib/companies/classificationMasters";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "企業ページ | OPINIO Business" },
};

export default async function BizCompanyPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/biz/dashboard");
  /* ★役割（2026-10-12）。権限が無ければホームへ（サイドバーにも出していない） */
  guardBizPage(ctx.currentPermission, "company.page");

  const supabase = createClient();

  // 全クエリを並列取得（company は genres に依存しないため同時実行）
  // 規約同意記録を確認（ow_terms_agreements）
  const { data: { user } } = await supabase.auth.getUser();
  const adminClient = createAdminClient();
  /* ⚠️ ここは **掲載** の同意だけを見る（2026-08-14 に分割）。
        人材紹介（成功報酬）の同意は、スカウト・紹介を使う画面で取る。
        分割前の `business` はどちらにも効く（`hasAgreedTerms` 参照）。 */
  const termsAgreed = user ? await hasAgreedTerms(user.id, "listing") : false;

  /* ⚠️ `ow_saas_categories` の取得は 2026-08-25 に外した。SaaSカテゴリの入力欄を
        撤去したので誰も使わない（列と値は残してある）。事業領域の入力欄を作る日に
        `ow_business_domains` を取りに行く。 */
  /* ⚠️★**`ow_genres`（選択肢）はもう引いていない**（2026-09-29 に企業側の入力欄を畳んだ）。
        ⚠️ `publishedGenresResult`（この企業に付いているジャンル）は**引き続き要る。**
           下書きに `genres` が無いときの初期値で、これが無いと
           **「変更を公開する」を押した瞬間に既存のジャンルが消える。** */
  const [initialPhotos, publishedGenresResult, masters, companyDomainsResult, listingRequestResult, customersResult] = await Promise.all([
    fetchOfficePhotosForCompany(supabase, ctx.tenantId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from("ow_company_genres")
      .select("ow_genres(slug)")
      .eq("company_id", ctx.tenantId)
      .eq("is_human_approved", true),
    /* ★分類の選択肢（2026-10-12。業種・事業）。入力用（出す前の新しい行と、この会社が追加した確認待ちの事業を含む）。
          ⚠️ 公開側には使わない */
    loadClassificationMasters(ctx.tenantId),
    adminClient
      .from("ow_company_business_domains")
      .select("domain_id, is_primary")
      .eq("company_id", ctx.tenantId),
    /* ⚠️ 通知先の候補はここで引かない（2026-10-12 に「メンバーと権限」へ移した） */
    /* ★掲載依頼の記録（2026-09-29）。
          ⚠️★**`fetchCompanyForTenant`（＝ `BizCompany`）に混ぜないこと。** あれは
             `draft_data` に自動保存される**企業が編集する値**で、この列は運営が
             対応したら NULL に戻す**サーバー側の状態**。混ぜると自動保存のたびに
             古い値で上書きされる。
          ⚠️ admin クライアントで引く。この列は authenticated に UPDATE を配っておらず、
             読みも運営の管理用なので、セッション側の可視性に依存させない。 */
    adminClient
      .from("ow_companies")
      /* ★`listing_status` も引く（2026-10-08）。状態表示（`companyPageStatus`）が要る。
            ⚠️ これも `form` に入れない（下書きに混ぜると古い値で上書きされる） */
      .select("listing_requested_at, listing_status, is_published, headquarters_address")
      .eq("id", ctx.tenantId)
      .maybeSingle(),
    /* ★お客さまの業界（公開中の値）。下書きに無いときの初期値 */
    adminClient.from("ow_company_customer_industries").select("industry_id").eq("company_id", ctx.tenantId),
    /* ⚠️ 開示充実度の計算に使っていた4本（公開求人数・公開ストーリー数・取材項目・ツール数）は
          2026-09-21 に外した。この画面から開示充実度を外したため（ダッシュボードに出している） */
  ]);

  /* ⚠️ `error` を捨てない。捨てると「取得できなかった」が「未依頼」に化け、
        既に依頼済みの企業にもう一度ボタンを出すことになる（API 側は 409 で止まるが、
        押した人には理由が分からない）。 */
  if (listingRequestResult.error) {
    console.error("[biz/company] listing_requested_at の取得に失敗:", listingRequestResult.error.message);
  }

  /* ⚠️ `error` を捨てない。捨てると「1件も選んでいない」と区別できず、
        取得に失敗した日に**画面が空のまま保存されて選択が消える。** */
  if (companyDomainsResult.error) {
    console.error("[biz/company] 事業領域の取得に失敗:", companyDomainsResult.error.message);
  }
  const companyDomainRows = (companyDomainsResult.data ?? []) as { domain_id: string; is_primary: boolean }[];
  if (customersResult.error) console.error("[biz/company] お客さまの業界の取得に失敗:", customersResult.error.message);

  /* ★下書きを読み戻す（`withDraft: true`。この画面だけ）。事業領域は下書きに無ければ公開中の値で初期化する。
     ⚠️ `/biz/dashboard` は同じ関数を `withDraft` 無しで呼ぶ（開示充実度は求職者に見えている値で出すため） */
  const companyRaw = await fetchCompanyForTenant(supabase, ctx.tenantId, [], {
    withDraft: true,
    publishedDomains: {
      ids: companyDomainRows.map((r) => r.domain_id),
      primaryId: companyDomainRows.find((r) => r.is_primary)?.domain_id ?? null,
    },
    publishedCustomerIds: (customersResult.data ?? []).map((r) => r.industry_id as string),
  });

  if (!companyRaw) redirect("/biz/dashboard");

  // 公開済みジャンルの slug 配列（draft_data.genres がない企業の初期値として使用）
  const publishedGenreSlugs: string[] = ((publishedGenresResult.data ?? []) as Record<string, unknown>[])
    .map((row) => (row.ow_genres as Record<string, string> | null)?.slug)
    .filter((s): s is string => typeof s === "string");

  // draft_data に genres がなければ公開済みジャンルで補完
  const company = companyRaw.genres.length === 0 && publishedGenreSlugs.length > 0
    ? { ...companyRaw, genres: publishedGenreSlugs }
    : companyRaw;

  return (
    <CompanyEditClient
      initialCompany={company}
      initialPhotos={initialPhotos}
      companyId={ctx.tenantId}
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient ?? undefined}
      tenantLogoLetter={ctx.logoLetter ?? undefined}
      memberships={ctx.allCompanies}
      isAdmin={can(ctx.currentPermission, "company.page")}
      canEditBasic={can(ctx.currentPermission, "company.basic")}
      canRequestListing={can(ctx.currentPermission, "company.listingRequest")}
      initialTermsAgreed={termsAgreed}
      userId={user?.id ?? ""}
      initialListingRequestedAt={(listingRequestResult.data?.listing_requested_at as string | null) ?? null}
      listingStatus={(listingRequestResult.data?.listing_status as string | null) ?? null}
      isPublished={listingRequestResult.data?.is_published === true}
      headquartersAddress={(listingRequestResult.data?.headquarters_address as string | null) ?? null}
      masters={masters}
    />
  );
}
