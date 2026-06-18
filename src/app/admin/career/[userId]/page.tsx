import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { CareerEditorClient } from "./CareerEditorClient";

async function getUserCareerData(userId: string) {
  const supabase = createAdminClient();

  const [userRes, expsRes, profileRes, companiesRes] = await Promise.all([
    supabase
      .from("ow_users")
      .select("id, name, email, visibility")
      .eq("id", userId)
      .single(),
    supabase
      .from("ow_experiences")
      .select(`
        id, user_id, company_id, company_text, company_anonymized,
        role_title, started_at, ended_at, is_current, employment_type,
        salary_man, visibility_company, visibility_salary, visibility_reason,
        display_order, join_reason
      `)
      .eq("user_id", userId)
      .order("display_order", { ascending: true }),
    supabase
      .from("ow_career_profiles")
      .select("id, user_id, headline, years_of_experience, is_published, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("ow_companies")
      .select("id, name")
      .order("name"),
  ]);

  if (userRes.error || !userRes.data) return null;

  return {
    user: userRes.data,
    experiences: expsRes.data ?? [],
    profile: profileRes.data ?? null,
    companies: companiesRes.data ?? [],
  };
}

export default async function AdminCareerUserPage({
  params,
}: {
  params: { userId: string };
}) {
  const data = await getUserCareerData(params.userId);
  if (!data) notFound();

  return (
    <CareerEditorClient
      user={data.user}
      experiences={data.experiences}
      profile={data.profile}
      companies={data.companies}
    />
  );
}
