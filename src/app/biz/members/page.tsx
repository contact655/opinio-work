import { can } from "@/lib/auth/roles";
import { guardBizPage } from "@/lib/auth/companyAccess";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchMembersForCompany, fetchPendingInvitesForCompany } from "@/lib/business/members";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSlackSettingsView } from "@/lib/notify/slack";
import { MembersClient } from "./MembersClient";
import { fetchNotificationSettings } from "@/lib/business/notificationTeam";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "メンバーと権限 | OPINIO Business" },
};

/* ⚠️ 「面談対応者」「面談を依頼できる社員」の取得（fetchAmbassadors / fetchAmbassadorCandidates /
      面談の件数）は 2026-10-16 に撤去した（面談OKの撤去）。この画面は採用担当だけ */

export default async function MembersPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;
  /* ★役割（2026-10-12）。権限が無ければホームへ（サイドバーにも出していない） */
  guardBizPage(ctx.currentPermission, "members.manage");

  const adminSupabase = createAdminClient();

  const [members, pendingInvites, notification] = await Promise.all([
    /* ⚠️ admin クライアントを渡す。担当者一覧は他メンバーの email を表示するが、
          2026-08-06 に authenticated から ow_users.email の SELECT 権限を剥がした。
          会社の管理者であることは上の getTenantContext で確認済み。 */
    fetchMembersForCompany(adminSupabase, ctx.tenantId),
    fetchPendingInvitesForCompany(adminSupabase, ctx.tenantId),
    /* ★通知の宛先（2026-10-12 に /biz/company から移した） */
    fetchNotificationSettings(ctx.tenantId),
  ]);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <MembersClient
        slackSettings={can(ctx.currentPermission, "integrations.manage") ? await getSlackSettingsView(ctx.tenantId) : null}
        notificationMembers={notification.members}
        notificationEmails={notification.emails}
        initialMembers={members}
        initialPendingInvites={pendingInvites}
        currentUserId={ctx.currentOwnId}
        isAdmin={can(ctx.currentPermission, "members.manage")}
      />
    </BusinessLayout>
  );
}
