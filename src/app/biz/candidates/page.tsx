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

  // 公開プロフィールの求職者を取得（visibility = 'public' のユーザー）
  const { data: rawUsers } = await supabase
    .from("ow_users")
    .select(`
      id, name, email, location, is_mentor, created_at,
      ow_profiles!left (
        onboarding_completed, current_role, current_company,
        work_style_preference, desired_salary_min, desired_salary_max
      )
    `)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(100);

  const candidates = (rawUsers ?? []).map((u: any) => {
    const profile = u.ow_profiles?.[0] ?? u.ow_profiles ?? null;
    return {
      id: u.id as string,
      name: (u.name as string) || "名前未設定",
      location: (u.location as string) || null,
      isMentor: (u.is_mentor as boolean) || false,
      currentRole: profile?.current_role || null,
      currentCompany: profile?.current_company || null,
      workStyle: profile?.work_style_preference || null,
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
