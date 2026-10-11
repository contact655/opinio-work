import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchCompanyForTenant } from "@/lib/business/company";
import { fetchOfficePhotosForCompany } from "@/lib/business/photos";
import { createClient } from "@/lib/supabase/server";
import { CompanyEditClient } from "./CompanyEditClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAgreedTerms } from "@/lib/business/termsAgreement";
import { fetchBusinessDomainOptions } from "@/lib/companies/businessDomains";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "企業ページ | OPINIO Business" },
};

export default async function BizCompanyPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/biz/dashboard");

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
  const [initialPhotos, publishedGenresResult, industriesResult, businessDomainOptions, companyDomainsResult, listingRequestResult] = await Promise.all([
    fetchOfficePhotosForCompany(supabase, ctx.tenantId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from("ow_company_genres")
      .select("ow_genres(slug)")
      .eq("company_id", ctx.tenantId)
      .eq("is_human_approved", true),
    adminClient
      .from("ow_industries")
      /* ★`parent_id` を取る（2026-09-05 に業種を2階層に戻した）。
            ⚠️ **2段セレクトには戻していない。** 1段のまま `<optgroup>` で出している
               （`IndustrySelectOptions`）。この列が無いと親子が組めず、
               `display_order` は**親ごとの相対順**なので並びが壊れる。 */
      .select("id, name, slug, display_order, parent_id, requires_business_domain")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    /* ★事業領域の選択肢とこの企業の選択（2026-09-29）。
          ⚠️★**`/biz` にこの入力欄が無かったせいで、企業は自分で公開ゲートを
             満たせなかった**（実測: 主の事業領域が無い企業が14社）。
          ⚠️ 選択肢はマスタから。**コードに書かないこと**（業種と同じ扱い）。 */
    fetchBusinessDomainOptions(adminClient, "biz/company"),
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

  /* ★下書きを読み戻す（`withDraft: true`。この画面だけ）。事業領域は下書きに無ければ公開中の値で初期化する。
     ⚠️ `/biz/dashboard` は同じ関数を `withDraft` 無しで呼ぶ（開示充実度は求職者に見えている値で出すため） */
  const companyRaw = await fetchCompanyForTenant(supabase, ctx.tenantId, [], {
    withDraft: true,
    publishedDomains: {
      ids: companyDomainRows.map((r) => r.domain_id),
      primaryId: companyDomainRows.find((r) => r.is_primary)?.domain_id ?? null,
    },
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

  /** ⚠️ `parent_id` を含める。2階層（製造業）を `<optgroup>` で出すのに要る（2026-09-05）
   *  ⚠️ `requires_business_domain` は事業領域が必須かの判定（2026-09-29）。
   *     **slug で判定しないこと**（`/admin` 側と同じ規則）。 */
  type IndustryItem = {
    id: string; name: string; slug: string; display_order: number; parent_id: string | null;
    requires_business_domain: boolean;
  };

  const industries: IndustryItem[] = (industriesResult.data ?? []) as IndustryItem[];


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
      isAdmin={ctx.currentPermission === "admin"}
      initialTermsAgreed={termsAgreed}
      userId={user?.id ?? ""}
      initialListingRequestedAt={(listingRequestResult.data?.listing_requested_at as string | null) ?? null}
      listingStatus={(listingRequestResult.data?.listing_status as string | null) ?? null}
      isPublished={listingRequestResult.data?.is_published === true}
      headquartersAddress={(listingRequestResult.data?.headquarters_address as string | null) ?? null}
      businessDomainOptions={businessDomainOptions}
      /* ⚠️ 事業領域が必須かは業種マスタの `requires_business_domain`（画面側で今の業種から引く）。slug で判定しない */
      industries={industries}
    />
  );
}
