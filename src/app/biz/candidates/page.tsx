import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CandidatesClient from "./CandidatesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "求職者を探す | OPINIO Business" },
};

export default async function CandidatesPage() {
  const ctx = await getTenantContext();
  if (!ctx) {
    return (
      <BusinessLayout userName="担当者">
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid var(--line)",
          padding: 40, textAlign: "center", maxWidth: "var(--max-w-form)", margin: "60px auto",
        }}>
          <p style={{ fontSize: 14, color: "var(--error)" }}>
            企業アカウントが見つかりませんでした。ログインし直してください。
          </p>
        </div>
      </BusinessLayout>
    );
  }
  const supabase = createClient();
  const adminClient = createAdminClient();

  // 転職勧奨禁止期間中の候補者IDを取得（就職後2年以内かつ在職中）
  const { data: blockedPlacements } = await adminClient
    .from("ow_placements")
    .select("candidate_id")
    .is("resigned_at", null)
    .gte("joined_at", new Date(Date.now() - 2 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const blockedCandidateIds = new Set((blockedPlacements ?? []).map((p: any) => p.candidate_id as string));

  // 公開プロフィールの求職者を取得（visibility = 'public'）
  // ow_profiles.user_id = auth.users.id（= ow_users.auth_id）のため
  // Supabase の自動 JOIN は使わず、auth_id 経由で手動結合する
  const { data: rawUsers } = await supabase
    .from("ow_users")
    .select("id, name, location, is_mentor, can_talk_to_hr, created_at, auth_id")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(500);

  const userIds = (rawUsers ?? []).map((u: any) => u.id as string);
  const authIds = (rawUsers ?? [])
    .filter((u: any) => u.auth_id)
    .map((u: any) => u.auth_id as string);

  // ow_profiles: user_id = auth.users.id（= ow_users.auth_id）経由で取得
  // desired_salary_min/max は機微情報のため除外
  const profilesByAuthId = new Map<string, {
    onboarding_completed: boolean;
    desired_work_style: string | null;
    job_type: string | null;
    desired_phase: string[] | null;
    transfer_timing: string | null;
  }>();

  if (authIds.length > 0) {
    // ow_profiles の RLS は own_read のみ（biz ユーザーは他者のプロフィールを読めない）
    // このページは getTenantContext() で biz 認証済みのため admin client で bypass する
    const { data: profileRows } = await adminClient
      .from("ow_profiles")
      .select("user_id, onboarding_completed, desired_work_style, job_type, desired_phase, transfer_timing")
      .in("user_id", authIds);

    for (const p of profileRows ?? []) {
      profilesByAuthId.set(p.user_id as string, p as any);
    }
  }

  // 現職情報を別取得（is_current = true の最初の 1 件）
  const { data: currentExps } = userIds.length > 0
    ? await supabase
        .from("ow_experiences")
        .select("user_id, role_title, company_text, company_anonymized")
        .in("user_id", userIds)
        .eq("is_current", true)
    : { data: [] };

  // user_id → current exp のマップ
  const currentExpByUser = new Map<string, { role_title: string | null; company: string | null }>();
  for (const exp of currentExps ?? []) {
    if (!currentExpByUser.has(exp.user_id as string)) {
      const company = (exp.company_text as string | null)
        || (exp.company_anonymized as string | null)
        || null;
      currentExpByUser.set(exp.user_id as string, {
        role_title: exp.role_title as string | null,
        company,
      });
    }
  }

  const candidates = (rawUsers ?? []).filter((u: any) => !blockedCandidateIds.has(u.id as string)).map((u: any) => {
    const authId = u.auth_id as string | null;
    const profile = authId ? (profilesByAuthId.get(authId) ?? null) : null;
    const currentExp = currentExpByUser.get(u.id as string) ?? null;
    return {
      id: u.id as string,
      name: (u.name as string) || "名前未設定",
      location: (u.location as string) || null,
      isMentor: (u.is_mentor as boolean) || false,
      canTalkToHr: (u.can_talk_to_hr as boolean) || false,
      currentRole: currentExp?.role_title ?? null,
      currentCompany: currentExp?.company ?? null,
      jobType: profile?.job_type || null,
      workStyle: profile?.desired_work_style || null,
      desiredPhase: profile?.desired_phase || null,
      transferTiming: profile?.transfer_timing || null,
      onboardingCompleted: profile?.onboarding_completed || false,
      createdAt: u.created_at as string,
    };
  });

  const layoutProps = ctx
    ? {
        userName: ctx.userName,
        tenantName: ctx.tenantName,
        tenantLogoGradient: ctx.logoGradient,
        tenantLogoLetter: ctx.logoLetter,
        memberships: ctx.allCompanies,
        currentTenantId: ctx.tenantId,
      }
    : { userName: "担当者" };

  return (
    <BusinessLayout {...layoutProps}>
      <CandidatesClient candidates={candidates} />
    </BusinessLayout>
  );
}
