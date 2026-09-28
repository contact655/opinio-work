import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchCompanyForTenant } from "@/lib/business/company";
import { fetchOfficePhotosForCompany } from "@/lib/business/photos";
import { createClient } from "@/lib/supabase/server";
import { CompanyEditClient, type NotificationTeamMember } from "./CompanyEditClient";
import type { Genre } from "@/components/ui/GenreChipSelector";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAgreedTerms } from "@/lib/business/termsAgreement";

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
  const [initialPhotos, genresResult, publishedGenresResult, companyRaw, industriesResult, teamAdminsResult, listingRequestResult] = await Promise.all([
    fetchOfficePhotosForCompany(supabase, ctx.tenantId),
    adminClient
      .from("ow_genres")
      .select("slug, name, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from("ow_company_genres")
      .select("ow_genres(slug)")
      .eq("company_id", ctx.tenantId)
      .eq("is_human_approved", true),
    fetchCompanyForTenant(supabase, ctx.tenantId, []),
    adminClient
      .from("ow_industries")
      /* ★`parent_id` を取る（2026-09-05 に業種を2階層に戻した）。
            ⚠️ **2段セレクトには戻していない。** 1段のまま `<optgroup>` で出している
               （`IndustrySelectOptions`）。この列が無いと親子が組めず、
               `display_order` は**親ごとの相対順**なので並びが壊れる。 */
      .select("id, name, slug, display_order, parent_id")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    /* ★通知先の候補（2026-09-29）。その会社の**有効な担当者**。
          ⚠️★**`ow_company_admins` から `ow_users` は埋め込めない**（FK が無い。
             `getCompanyContext` の NOTE と同じ）。user_id を取ってから2本目で引く。
          ⚠️ `permission` も取る。未設定のときのフォールバック先（②有効な管理者）を
             画面に出すのに要る ——「いまは誰に届くか」を出さないと、
             上書きであることが伝わらない。 */
    adminClient
      .from("ow_company_admins")
      .select("user_id, department, role_title, permission")
      .eq("company_id", ctx.tenantId)
      .eq("is_active", true),
    /* ★掲載依頼の記録（2026-09-29）。
          ⚠️★**`fetchCompanyForTenant`（＝ `BizCompany`）に混ぜないこと。** あれは
             `draft_data` に自動保存される**企業が編集する値**で、この列は運営が
             対応したら NULL に戻す**サーバー側の状態**。混ぜると自動保存のたびに
             古い値で上書きされる。
          ⚠️ admin クライアントで引く。この列は authenticated に UPDATE を配っておらず、
             読みも運営の管理用なので、セッション側の可視性に依存させない。 */
    adminClient
      .from("ow_companies")
      .select("listing_requested_at")
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

  /* ── 通知先の候補を組み立てる（2026-09-29）────────────────────────────────
        ⚠️ `error` を捨てない。捨てると「担当者が1人もいない」ように見えて、
           自由入力だけの画面になる（実際には居る）。
        ⚠️ メールが無い行は落とす。**通知先として選べないものを出さない。**
        ⚠️★`is_test` では絞らない。その会社の担当者として実在し、実際に受け取れるため
           （求職者側に出す一覧とは目的が違う）。 */
  if (teamAdminsResult.error) {
    console.error("[biz/company] 担当者の取得に失敗:", teamAdminsResult.error.message);
  }
  const teamAdminRows = (teamAdminsResult.data ?? []) as {
    user_id: string | null; department: string | null; role_title: string | null; permission: string | null;
  }[];
  const teamUserIds = teamAdminRows.map((r) => r.user_id).filter((v): v is string => Boolean(v));
  /* ⚠️ `.in()` に空配列を渡すと全件返る。0件のときは引かない。 */
  const teamUsersResult = teamUserIds.length > 0
    ? await adminClient.from("ow_users").select("id, name, email").in("id", teamUserIds)
    : { data: [], error: null };
  if (teamUsersResult.error) {
    console.error("[biz/company] 担当者の氏名・メールの取得に失敗:", teamUsersResult.error.message);
  }
  const teamUserMap = new Map(
    ((teamUsersResult.data ?? []) as { id: string; name: string | null; email: string | null }[])
      .map((u) => [u.id, u]),
  );
  const teamMembers: NotificationTeamMember[] = teamAdminRows
    .map((r) => {
      const u = r.user_id ? teamUserMap.get(r.user_id) : undefined;
      if (!u?.email) return null;
      return {
        /* ⚠️ `ow_users.name` は NOT NULL だが、空文字の行を出しても選べないので既定を置く */
        name: (u.name ?? "").trim() || u.email,
        email: u.email,
        department: r.department,
        roleTitle: r.role_title,
        isAdminPermission: r.permission === "admin",
      };
    })
    .filter((m): m is NotificationTeamMember => m !== null)
    /* 管理者を上に。⚠️ 並びを固定しないと、保存のたびに順序が変わって見える */
    .sort((a, b) => (Number(b.isAdminPermission) - Number(a.isAdminPermission)) || a.name.localeCompare(b.name, "ja"));

  if (!companyRaw) redirect("/biz/dashboard");

  // 公開済みジャンルの slug 配列（draft_data.genres がない企業の初期値として使用）
  const publishedGenreSlugs: string[] = ((publishedGenresResult.data ?? []) as Record<string, unknown>[])
    .map((row) => (row.ow_genres as Record<string, string> | null)?.slug)
    .filter((s): s is string => typeof s === "string");

  // draft_data に genres がなければ公開済みジャンルで補完
  const company = companyRaw.genres.length === 0 && publishedGenreSlugs.length > 0
    ? { ...companyRaw, genres: publishedGenreSlugs }
    : companyRaw;

  const availableGenres: Genre[] = (genresResult.data ?? []) as Genre[];

  /** ⚠️ `parent_id` を含める。2階層（製造業）を `<optgroup>` で出すのに要る（2026-09-05） */
  type IndustryItem = { id: string; name: string; slug: string; display_order: number; parent_id: string | null };

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
      availableGenres={availableGenres}
      initialTermsAgreed={termsAgreed}
      userId={user?.id ?? ""}
      initialListingRequestedAt={(listingRequestResult.data?.listing_requested_at as string | null) ?? null}
      teamMembers={teamMembers}
      industries={industries}
    />
  );
}
