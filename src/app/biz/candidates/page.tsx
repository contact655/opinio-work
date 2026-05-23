import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import CandidatesClient from "./CandidatesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "求職者を探す | OPINIO Business",
};

export default async function CandidatesPage() {
  const ctx = await getTenantContext();
  const supabase = createClient();

  // 公開プロフィールの求職者を取得（visibility = 'public'）
  const { data: rawUsers } = await supabase
    .from("ow_users")
    .select(`
      id, name, location, is_mentor, created_at,
      ow_profiles!left (
        onboarding_completed, desired_work_style,
        desired_salary_min, desired_salary_max, job_type
      )
    `)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(100);

  const userIds = (rawUsers ?? []).map((u: any) => u.id as string);

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
    const profile = Array.isArray(u.ow_profiles)
      ? u.ow_profiles[0] ?? null
      : u.ow_profiles ?? null;
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
