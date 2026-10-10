import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { canUse } from "@/lib/constants/plans";
import { isCompanyReviewed } from "@/lib/business/scoutGate";
import { listSavedSearchesWithCounts } from "@/lib/business/savedSearchServer";
import { describeFilters } from "@/lib/business/candidates/model";
import { getRoleTree } from "@/lib/supabase/queries";
import { DESIRED_WORK_STYLE_LABELS, CAREER_STANCES } from "@/lib/constants/careerPreferences";
import SavedSearchesClient, { type SavedSearchView } from "./SavedSearchesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "保存した条件 | OPINIO Business" } };

/**
 * ★保存した条件の一覧（2026-10-10 / 候補者探し 段3・キャンバス2）。
 * ⚠️ 見えるのは自分の条件と、同じ企業で共有された条件。新着の数え方は `savedSearchServer.ts`。
 * ⚠️ `?edit=<id>` で開くと、その条件の編集を開いた状態で出す（お知らせのメールの「お知らせの設定を変える」）。
 * ⚠️ ここを開くと、まだ前回見た日時の無い条件（共有を初めて見る など）はこの時点が初期値になる。
 */
export default async function SavedSearchesPage({ searchParams }: { searchParams?: { edit?: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) {
    return (
      <BusinessLayout userName="担当者" hasCompany={false}>
        <p style={{ padding: 40, fontSize: 14, color: "var(--error)" }}>企業アカウントが見つかりませんでした。ログインし直してください。</p>
      </BusinessLayout>
    );
  }
  const layoutProps = {
    userName: ctx.userName, tenantName: ctx.tenantName, tenantLogoGradient: ctx.logoGradient,
    tenantLogoLetter: ctx.logoLetter, memberships: ctx.allCompanies, currentTenantId: ctx.tenantId,
  };
  /* ⚠️ ゲートは /biz/candidates と同じ（審査済み・プランが引ける・候補者検索が使える） */
  if (!isCompanyReviewed(ctx) || ctx.planType === null || !canUse(ctx.planType, "candidateSearch")) {
    return (
      <BusinessLayout {...layoutProps}>
        <p style={{ padding: 40, fontSize: 14, color: "var(--ink-soft)" }}>保存した条件は、候補者検索を使える企業でご利用いただけます。</p>
      </BusinessLayout>
    );
  }

  const [rows, roleTree] = await Promise.all([
    listSavedSearchesWithCounts({ companyId: ctx.tenantId, viewerOwUserId: ctx.currentOwnId, viewerPermission: ctx.currentPermission, planType: ctx.planType }),
    getRoleTree(),
  ]);
  const roleNameById = new Map<string, string>();
  roleTree.byId.forEach((n, id) => roleNameById.set(id, n.name));
  const views: SavedSearchView[] | null = rows?.map((r) => ({
    id: r.id, name: r.name, ownerName: r.ownerName, isMine: r.isMine, isShared: r.isShared,
    notifyFrequency: r.notifyFrequency, canEdit: r.canEdit, canDelete: r.canDelete, newCount: r.newCount,
    chips: describeFilters(r.filters, roleNameById, { workStyles: DESIRED_WORK_STYLE_LABELS, careerStances: [...CAREER_STANCES] }),
  })) ?? null;
  const editId = searchParams?.edit && views?.some((v) => v.id === searchParams.edit && v.canEdit) ? searchParams.edit : null;

  return (
    <BusinessLayout {...layoutProps}>
      <SavedSearchesClient initial={views} initialEditId={editId} />
    </BusinessLayout>
  );
}
