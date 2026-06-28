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
  const supabase = createClient();

  // 公開プロフィールの求職者を取得（visibility = 'public'）
  // ow_profiles.user_id = auth.users.id（= ow_users.auth_id）のため
  // Supabase の自動 JOIN は使わず、auth_id 経由で手動結合する
  const { data: rawUsers } = await supabase
    .from("ow_users")
    .select("id, name, location, is_mentor, created_at, auth_id")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(500);

  const userIds = (rawUsers ?? []).map((u: any) => u.id as string);
  const authIds = (rawUsers ?? [])
    .filter((u: any) => u.auth_id)
    .map((u: any) => u.auth_id as string);

  // ow_profiles: user_id = auth.users.id（= ow_users.auth_id）経由で取得
  const profilesByAuthId = new Map<string, {
    onboarding_completed: boolean;
    desired_work_style: string | null;
    desired_salary_min: number | null;
    desired_salary_max: number | null;
    job_type: string | null;
    desired_phase: string[] | null;
    transfer_timing: string | null;
  }>();

  if (authIds.length > 0) {
    // ow_profiles の RLS は own_read のみ（biz ユーザーは他者のプロフィールを読めない）
    // このページは getTenantContext() で biz 認証済みのため admin client で bypass する
    const adminClient = createAdminClient();
    const { data: profileRows } = await adminClient
      .from("ow_profiles")
      .select("user_id, onboarding_completed, desired_work_style, desired_salary_min, desired_salary_max, job_type, desired_phase, transfer_timing")
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

  const candidates = (rawUsers ?? []).map((u: any) => {
    const authId = u.auth_id as string | null;
    const profile = authId ? (profilesByAuthId.get(authId) ?? null) : null;
    const currentExp = currentExpByUser.get(u.id as string) ?? null;
    return {
      id: u.id as string,
      name: (u.name as string) || "名前未設定",
      location: (u.location as string) || null,
      isMentor: (u.is_mentor as boolean) || false,
      currentRole: currentExp?.role_title ?? null,
      currentCompany: currentExp?.company ?? null,
      jobType: profile?.job_type || null,
      workStyle: profile?.desired_work_style || null,
      desiredSalaryMin: profile?.desired_salary_min || null,
      desiredSalaryMax: profile?.desired_salary_max || null,
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
