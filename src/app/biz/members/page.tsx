import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { fetchMembersForCompany, fetchPendingInvitesForCompany } from "@/lib/business/members";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MembersClient, type AmbassadorRecord, type AmbassadorCandidate } from "./MembersClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "チーム管理 | OPINIO Business" },
};

const FALLBACK_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";

async function fetchAmbassadors(companyId: string): Promise<AmbassadorRecord[]> {
  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("ow_company_members")
    .select("id, user_id, role_title, display_consent, is_public, invited_at, ow_users!user_id(name, avatar_color, avatar_url)")
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

  const supabase = createClient();

  const [members, pendingInvites, ambassadors] = await Promise.all([
    fetchMembersForCompany(supabase, ctx.tenantId),
    fetchPendingInvitesForCompany(supabase, ctx.tenantId),
    fetchAmbassadors(ctx.tenantId),
  ]);

  const existingUserIds = ambassadors.map((a) => a.user_id);
  const candidates = await fetchAmbassadorCandidates(ctx.tenantId, existingUserIds);

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
      />
    </BusinessLayout>
  );
}
