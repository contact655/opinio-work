import type { CompanyRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { getCompanyContext } from "@/lib/business/company";
import { PLAN_LABELS, type PlanType } from "@/lib/constants/plans";
import { greetingName } from "@/lib/constants/personName";
import { jobState, jobStateTab } from "@/lib/jobs/jobState";

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
  /** ★ow_companies.listing_status（2026-10-12）。求人の即時公開の条件（企業ページが公開中か。lib/jobs/publishGate.ts） */
  listingStatus: string | null;
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
  /** ★いまの会社での役割（2026-10-12 に4つにした）。⚠️ 判定は lib/auth/roles.ts の can() を通す */
  currentPermission: CompanyRole;
};

/** ★求人の数（2026-10-12 に画面の状態に合わせて3つにした。lib/jobs/jobState.ts） */
export type JobStatusCounts = {
  published: number;
  draft: number;
  /** 停止中（自社で停止・運営が停止・再開を依頼済み） */
  stopped: number;
  /** そのうち運営が停止して、まだ再開を依頼していないもの（ホームの「やること」に出す） */
  stoppedByOps: number;
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
        .select("id, name, logo_gradient, logo_letter, is_published, is_approved, listing_status")
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
          メンバーと権限（`ow_users.name`）と食い違っていた（CLAUDE.md「name 表示の二重経路問題」）。
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
    /* ⚠️ 見つからないときに既定の役割で埋めない（権限を勝手に与えない）。所属が無ければ担当者ではない */
    const currentMembership = ctx.allMemberships.find((m) => m.companyId === tenantId);
    if (!currentMembership) return null;
    const currentPermission: CompanyRole = currentMembership.permission;

    return {
      tenantId,
      tenantName: companyRow.name || "—",
      isPublished: (companyRow as any).is_published === true,
      listingStatus: ((companyRow as any).listing_status as string | null) ?? null,
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
      .select("status, stopped_at")
      .eq("company_id", tenantId);
    const rows = (data || []) as { status: string | null; stopped_at: string | null }[];
    /* ★状態は jobState（画面と同じ関数）。⚠️ ここで status から数え方を組み直さない */
    const states = rows.map((r) => jobState({ status: r.status, stoppedAt: r.stopped_at }));
    return {
      published: states.filter((s) => s === "published").length,
      draft: states.filter((s) => s === "draft").length,
      stopped: states.filter((s) => jobStateTab(s) === "stopped").length,
      stoppedByOps: states.filter((s) => s === "stopped_ops").length,
    };
  } catch {
    return { published: 0, draft: 0, stopped: 0, stoppedByOps: 0 };
  }
}

// ⚠️ getTodoCounts / getMonthlyStats / getJobPerformance は 2026-09-22 に削除した。
//    読んでいた `ow_business_*` ビュー3つが、アプリの書かない表（`ow_applications` /
//    `ow_job_views`）を数えていて常に0だったため。ビューも同日に DROP した
//    （`20260922010000_drop_unused_business_views.sql`）。
//    月次の数字を作り直すなら `ow_job_applications` と `ow_casual_meetings` から数えること。

