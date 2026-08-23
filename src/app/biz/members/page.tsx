import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchMembersForCompany, fetchPendingInvitesForCompany } from "@/lib/business/members";
import { createAdminClient } from "@/lib/supabase/admin";
import { MembersClient, type AmbassadorRecord, type AmbassadorCandidate, type MeetingStat } from "./MembersClient";
import { canUse } from "@/lib/constants/plans";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "チーム管理 | OPINIO Business" },
};

const FALLBACK_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";

async function fetchAmbassadors(companyId: string): Promise<AmbassadorRecord[]> {
  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("ow_company_members")
    /* ⚠️ created_via も取る。無いと「本人からの申請」と「企業が招待した行」を区別できない。 */
    .select("id, user_id, role_title, display_consent, is_public, created_via, approved_at, invited_at, ow_users!user_id(name, avatar_color, avatar_url)")
    .eq("company_id", companyId)
    .order("invited_at", { ascending: false });

  if (error) {
    console.error("[ambassadors] fetch error:", error.message);
    return [];
  }

  type Row = {
    id: string;
    user_id: string;
    role_title: string | null;
    display_consent: boolean;
    is_public: boolean;
    approved_at: string | null;
    created_via: string | null;
    invited_at: string | null;
    ow_users: { name: string | null; avatar_color: string | null; avatar_url: string | null } | null;
  };

  return (data ?? []).map((row) => {
    const r = row as unknown as Row;
    const gradient = r.ow_users?.avatar_color?.startsWith("linear-gradient")
      ? r.ow_users.avatar_color
      : FALLBACK_GRADIENT;
    return {
      id: r.id,
      user_id: r.user_id,
      name: r.ow_users?.name ?? "—",
      initial: r.ow_users?.name?.charAt(0) ?? "?",
      gradient,
      avatar_url: r.ow_users?.avatar_url ?? null,
      role_title: r.role_title,
      display_consent: r.display_consent,
      is_public: r.is_public,
      approved_at: r.approved_at,
      created_via: r.created_via,
      invited_at: r.invited_at,
    };
  });
}

async function fetchAmbassadorCandidates(
  companyId: string,
  existingUserIds: string[]
): Promise<AmbassadorCandidate[]> {
  const adminSupabase = createAdminClient();

  // ow_experiences.company_id = companyId AND is_current = true
  const { data: exps, error } = await adminSupabase
    .from("ow_experiences")
    .select("user_id, role_title, ow_users!user_id(id, name, avatar_color, avatar_url)")
    .eq("company_id", companyId)
    .eq("is_current", true);

  if (error) {
    console.error("[ambassador candidates] fetch error:", error.message);
    return [];
  }

  type ExpRow = {
    user_id: string;
    role_title: string | null;
    ow_users: { id: string; name: string | null; avatar_color: string | null; avatar_url: string | null } | null;
  };

  const seen = new Set<string>();
  const results: AmbassadorCandidate[] = [];

  for (const row of (exps ?? []) as unknown as ExpRow[]) {
    if (!row.ow_users || seen.has(row.user_id)) continue;
    if (existingUserIds.includes(row.user_id)) continue;
    seen.add(row.user_id);

    const gradient = row.ow_users.avatar_color?.startsWith("linear-gradient")
      ? row.ow_users.avatar_color
      : FALLBACK_GRADIENT;

    results.push({
      user_id: row.user_id,
      name: row.ow_users.name ?? "名前未設定",
      initial: row.ow_users.name?.charAt(0) ?? "?",
      gradient,
      avatar_url: row.ow_users.avatar_url ?? null,
      role_title: row.role_title,
      current_company: null,
    });
  }

  return results;
}

export default async function MembersPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const adminSupabase = createAdminClient();

  const [members, pendingInvites, ambassadors] = await Promise.all([
    /* ⚠️ admin クライアントを渡す。担当者一覧は他メンバーの email を表示するが、
          2026-08-06 に authenticated から ow_users.email の SELECT 権限を剥がした。
          会社の管理者であることは上の getTenantContext で確認済み。 */
    fetchMembersForCompany(adminSupabase, ctx.tenantId),
    fetchPendingInvitesForCompany(adminSupabase, ctx.tenantId),
    fetchAmbassadors(ctx.tenantId),
  ]);

  const existingUserIds = ambassadors.map((a) => a.user_id);
  const [candidates, meetingStatsRaw, selfCurrentExp] = await Promise.all([
    fetchAmbassadorCandidates(ctx.tenantId, existingUserIds),
    adminSupabase
      .from("ow_casual_meetings")
      .select("assignee_user_id, status, completed_at")
      .eq("company_id", ctx.tenantId)
      .not("assignee_user_id", "is", null),
    /* ★自分がこの会社に「在籍中」の経歴を持っているか（2026-08-23）。
          ⚠️ 面談対応者として**表示される条件**が `ow_company_members` に載っていることと
             `is_current = true` の経歴があることの両方だから（lib/companyMembers/talkable.ts）。
             経歴が無い人を登録できてしまうと、**登録は成功するのにページに出ない**。
          ⚠️ 実測（2026-08-23）: 有効な企業管理者10人のうち、自社に在籍中の経歴が
             あるのは1人だけ。**大半がこの状態に落ちる。** */
    adminSupabase
      .from("ow_experiences")
      .select("id")
      .eq("user_id", ctx.currentOwnId)
      .eq("company_id", ctx.tenantId)
      .eq("is_current", true)
      .limit(1),
  ]);

  /* ⚠️ 握り潰さない。引けなかったときに「経歴あり」に倒すと、
        出ない登録を作らせることになる。取れなければ false（＝入口を出さない）。 */
  if (selfCurrentExp.error) {
    console.error("[biz/members] self current experience:", selfCurrentExp.error.message);
  }
  const selfHasCurrentExperience = (selfCurrentExp.data ?? []).length > 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const statsMap = new Map<string, MeetingStat>();
  for (const row of (meetingStatsRaw.data ?? [])) {
    const uid = row.assignee_user_id as string;
    if (!statsMap.has(uid)) statsMap.set(uid, { user_id: uid, total: 0, completed: 0, this_month_completed: 0 });
    const s = statsMap.get(uid)!;
    s.total += 1;
    if (row.status === "completed") {
      s.completed += 1;
      if (row.completed_at && row.completed_at >= monthStart) s.this_month_completed += 1;
    }
  }
  const meetingStats = Array.from(statsMap.values());

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
        initialMembers={members}
        initialPendingInvites={pendingInvites}
        currentUserId={ctx.currentOwnId}
        isAdmin={ctx.currentPermission === "admin"}
        ambassadors={ambassadors}
        ambassadorCandidates={candidates}
        meetingStats={meetingStats}
        /* ⚠️ これは**見た目だけ**。実際のゲートは POST /api/biz/ambassador/invite にある。
              ここを消しても API 側が 403 を返す。逆は成り立たない。 */
        canInviteAmbassador={canUse(ctx.planType, "ambassadorInvite")}
        /* ⚠️ これも**見た目だけ**。実際のゲートは POST /api/biz/ambassador/self-register にある。 */
        selfHasCurrentExperience={selfHasCurrentExperience}
      />
    </BusinessLayout>
  );
}
