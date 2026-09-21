import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { getCompanyContext } from "@/lib/business/company";
import { PLAN_LABELS, type PlanType } from "@/lib/constants/plans";
import { greetingName } from "@/lib/constants/personName";

/**
 * Opinio Business — Dashboard data layer
 *
 * すべての fetch は try/catch で空値を返す。
 * テーブル/ビューが未存在でもダッシュボードがクラッシュしないようガードする。
 */

/* ⚠️ `INDUSTRY_AVG_CONVERSION_RATE`（業界平均の応募率 4.1%）は 2026-09-22 に削除した。
      根拠の無い固定値で、比べる相手（閲覧数・応募数）も記録されていなかった。 */

// ─── Types ────────────────────────────────────────────

export type TenantCompany = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type TenantContext = {
  tenantId: string;
  tenantName: string;
  isPublished: boolean;          // ow_companies.is_published
  isApproved: boolean;           // ow_companies.is_approved — 運営が承認済みか
  /**
   * いま有効な契約プラン。`ow_company_plans` の status='active' の行。
   * ⚠️ **プランの正はこの表。`ow_companies.plan` は廃止予定で読まない。**
   * ⚠️ 取れなければ null。`canUse()` が null を「何も開かない」に倒す。
   */
  planType: PlanType | null;
  planLabel: string;
  userName: string;
  logoGradient: string | null;
  logoLetter: string | null;
  currentOwnId: string;          // ow_users.id (UUID) — assignee resolution
  currentOwnerGradient: string;  // avatar_color or royal fallback
  allCompanies: TenantCompany[]; // all active memberships (for CompanySwitcher)
  currentPermission: "admin" | "member"; // Phase 12: current user's permission in the active tenant
};

export type JobStatusCounts = {
  active: number;
  review: number;
  draft: number;
  /**
   * ★`rejected` と `private` を分けて持つ（2026-08-31）。
   *
   * ⚠️ それまでは2つを `closed` にまとめていたが、**意味が違う**。
   *    `rejected` = 運営が差し戻した（企業が直して再申請する）
   *    `private`  = 運営が公開を止めた（取り下げ）
   *    `/biz/jobs` のタブは元から「差し戻し」「非公開」に分かれており、
   *    ダッシュボードだけがまとめていた。
   */
  rejected: number;
  private: number;
};

// ─── Tenant Context ───────────────────────────────────

/**
 * 企業に所属していない人にも出せる表示名。
 *
 * ⚠️ **参加系のページ（`/biz/companies/add` 配下）は `getTenantContext` の
 *    戻り値でページ全体を出し分けないこと。** あれは所属が無いと null を返すので、
 *    「これから参加する人」が参加画面に入れなくなる。
 *    実際 2026-08-14 まで、所属の無い人は
 *    `/biz/dashboard` → `/biz/companies/add`（レイアウトのリダイレクト）→
 *    「企業アカウントが必要です」だけが出る行き止まりに入っていた。
 */
export async function getBizUserName(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "ご担当者"
  );
}

/**
 * 現在ログイン中ユーザーの企業ロール (tenant_id) と企業情報を取得。
 * 企業ロールが無い場合は null を返す。
 *
 * ★React の `cache` で包んである（2026-09-21）。`app/biz/layout.tsx` がサイドバー用に
 *   呼び、各ページも呼ぶので、**同じリクエストの中では1回だけ引く**ようにしている。
 *   ⚠️ 外すとサイドバーのぶん問い合わせが倍になる。
 */
export const getTenantContext = cache(loadTenantContext);

async function loadTenantContext(): Promise<TenantContext | null> {
  const supabase = createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // admin client で RLS をバイパスして確実に company membership を解決する
    const admin = createAdminClient();
    const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
    const ctx = await getCompanyContext(admin, user.id, cookieCompanyId);
    if (!ctx) return null;

    // Multi-company: redirect to selection page when no cookie is set
    if (!cookieCompanyId && ctx.allMemberships.length > 1) {
      redirect("/biz/select-company");
    }

    const { companyId: tenantId, owUserId } = ctx;
    const allMembershipIds = ctx.allMemberships.map((m) => m.companyId);

    /* ow_companies / ow_users を一括並列取得。
       ⚠️ プランはここで引かない。**`getCompanyContext` が既に解決している。**
          2箇所で引くと、片方だけ直したときに画面と API で判定が割れる。 */
    const [companiesRes, owUserRes] = await Promise.all([
      admin.from("ow_companies")
        .select("id, name, logo_gradient, logo_letter, is_published, is_approved")
        .in("id", allMembershipIds),
      admin.from("ow_users")
        .select("avatar_color, name")
        .eq("id", owUserId)
        .maybeSingle(),
    ]);

    const companies = companiesRes.data ?? [];
    const companyRow = companies.find((c) => c.id === tenantId);
    if (!companyRow) return null;

    // allCompanies: joined_at 順を保持
    const allCompanies: TenantCompany[] = ctx.allMemberships.map((m) => ({
      id: m.companyId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: (companies as any[]).find((c) => c.id === m.companyId)?.name ?? "(不明)",
      isDefault: m.isDefault,
    }));

    const planType: PlanType | null = ctx.planType;

    const owUser = owUserRes.data;

    /* ★表示名は `ow_users.name`（プロフィールの氏名）を正にする（2026-09-21）。
          それまでは auth の metadata か**メールアドレスの @ より前**を使っており、
          チーム管理（`ow_users.name`）と食い違っていた（CLAUDE.md「name 表示の二重経路問題」）。
       ⚠️ `'ユーザー'`（プレースホルダ）は名前として出さない（`greetingName` が弾く）。
       ⚠️★**メールアドレスの一部を名前にしないこと。** 最後は「ご担当者」に倒す。 */
    const userName =
      greetingName(owUser?.name as string | null | undefined) ??
      greetingName((user.user_metadata as any)?.name) ??
      "ご担当者";
    const currentOwnerGradient =
      (owUser?.avatar_color && owUser.avatar_color.startsWith("linear-gradient"))
        ? owUser.avatar_color
        : "linear-gradient(135deg, var(--royal), var(--accent))";

    // Phase 12: derive current user's permission from allMemberships
    const currentPermission: "admin" | "member" =
      ctx.allMemberships.find((m) => m.companyId === tenantId)?.permission ?? "member";

    return {
      tenantId,
      tenantName: companyRow.name || "—",
      isPublished: (companyRow as any).is_published === true,
      isApproved: (companyRow as any).is_approved === true,
      planType,
      planLabel: planType ? (PLAN_LABELS[planType] ?? "—") : "未設定",
      userName,
      logoGradient: companyRow.logo_gradient ?? null,
      logoLetter: companyRow.logo_letter ?? null,
      currentOwnId: owUserId,
      currentOwnerGradient,
      allCompanies,
      currentPermission,
    };
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return null;
  }
}

// ─── Job Status Counts ────────────────────────────────

export async function getJobStatusCounts(tenantId: string): Promise<JobStatusCounts> {
  /* ⚠️★`ow_business_*` ビューは **service_role でしか読めない**（2026-08-29 / `20260829110000`）。
        ビューは `OWNER TO postgres` で `security_invoker` ではないため RLS を迂回し、
        **anon にまで `GRANT ALL` されていた**（baseline 由来）。実測で
        **未ログインから他社の非公開求人タイトル15件・閲覧数・応募数**が取れていた。
     ⚠️ したがってここは `createAdminClient()` を使う。**`createClient()` に戻さないこと。**
        戻すと権限が無く 401 になり、`?? 0` で受けている側では**全部 0 に見える**。
     ⚠️ 絞り込みの `tenantId` は `getTenantContext()` が所属を検証済みの値。
        **呼び出し側で検証していない id をここに渡さないこと。** */
  const supabase = createAdminClient();
  try {
    const { data } = await supabase
      .from("ow_jobs")
      .select("status")
      .eq("company_id", tenantId);
    const rows = data || [];
    // DB の実際のステータス値: published / pending_review / draft / rejected / private
    return {
      active: rows.filter((r: any) => r.status === "published").length,
      review: rows.filter((r: any) => r.status === "pending_review").length,
      draft: rows.filter((r: any) => r.status === "draft").length,
      rejected: rows.filter((r: any) => r.status === "rejected").length,
      private: rows.filter((r: any) => r.status === "private").length,
    };
  } catch {
    return { active: 0, review: 0, draft: 0, rejected: 0, private: 0 };
  }
}

// ⚠️ getTodoCounts / getMonthlyStats / getJobPerformance は 2026-09-22 に削除した。
//    読んでいた `ow_business_*` ビュー3つが、アプリの書かない表（`ow_applications` /
//    `ow_job_views`）を数えていて常に0だったため。ビューも同日に DROP した
//    （`20260922010000_drop_unused_business_views.sql`）。
//    月次の数字を作り直すなら `ow_job_applications` と `ow_casual_meetings` から数えること。

