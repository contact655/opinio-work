export const revalidate = 300;

import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { PeopleListClient, type AmbassadorCard } from "./PeopleListClient";

export const metadata: Metadata = {
  title: { absolute: "先輩を知る | OPINIO" },
  description: "IT/SaaS企業の現役社員・OB/OGに、はたらくリアルを直接聞いてみましょう。キャリア選択の参考に。",
  robots: { index: false, follow: false },
};

type DbAmbassador = {
  id: string;
  user_id: string;
  company_id: string;
  role_title: string | null;
  talk_themes: string[] | null;
  created_at: string | null;
  ow_users: { id: string; name: string | null; avatar_color: string | null; avatar_url: string | null; visibility: string | null; email: string | null } | null;
  ow_companies: {
    id: string;
    name: string | null;
    brand_name: string | null;
    logo_url: string | null;
    logo_gradient: string | null;
    logo_letter: string | null;
    phase: string | null;
    industry: string | null;
  } | null;
};

const FALLBACK_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";

async function getAmbassadors(): Promise<AmbassadorCard[]> {
  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from("ow_company_members")
    .select(`
      id,
      user_id,
      company_id,
      role_title,
      talk_themes,
      created_at,
      ow_users!user_id(id, name, avatar_color, avatar_url, visibility, email),
      ow_companies!company_id(id, name, brand_name, logo_url, logo_gradient, logo_letter, phase, industry)
    `)
    .eq("display_consent", true)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[people] fetch error:", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as DbAmbassador[];
  const filteredRows = rows.filter((r) =>
    r.ow_users?.visibility !== "private" &&
    r.ow_users?.name &&
    !r.ow_users?.email?.endsWith("@seed.internal")
  );

  if (filteredRows.length === 0) return [];

  // Fetch profiles for all user_ids in bulk
  const userIds = filteredRows.map((r) => r.user_id);
  const [profilesRes, skillsRes] = await Promise.all([
    adminSupabase
      .from("ow_user_profiles")
      .select("user_id, current_job_type, experience_years, work_style, preferred_locations")
      .in("user_id", userIds),
    adminSupabase
      .from("ow_user_skill_tags")
      .select("user_id, label, sort_order")
      .in("user_id", userIds)
      .order("sort_order", { ascending: true }),
  ]);

  const profileMap: Record<string, { current_job_type: string | null; experience_years: number | null; work_style: string | null; preferred_locations: string[] | null }> = {};
  for (const p of profilesRes.data ?? []) {
    const pp = p as { user_id: string; current_job_type: string | null; experience_years: number | null; work_style: string | null; preferred_locations: string[] | null };
    profileMap[pp.user_id] = pp;
  }

  const skillMap: Record<string, string[]> = {};
  for (const s of skillsRes.data ?? []) {
    const ss = s as { user_id: string; label: string };
    if (!skillMap[ss.user_id]) skillMap[ss.user_id] = [];
    skillMap[ss.user_id].push(ss.label);
  }

  return filteredRows.map((r) => {
    const gradient =
      r.ow_users?.avatar_color?.startsWith("linear-gradient")
        ? r.ow_users.avatar_color
        : FALLBACK_GRADIENT;

    const profile = profileMap[r.user_id] ?? null;

    return {
      adminId: r.id,
      userId: r.user_id,
      name: r.ow_users?.name ?? "—",
      initial: r.ow_users?.name?.charAt(0) ?? "?",
      gradient,
      avatarUrl: r.ow_users?.avatar_url ?? null,
      roleTitle: r.role_title,
      department: null,
      talkThemes: r.talk_themes ?? [],
      companyId: r.ow_companies?.id ?? r.company_id,
      companyName: r.ow_companies?.brand_name ?? r.ow_companies?.name ?? "—",
      companyPhase: r.ow_companies?.phase ?? null,
      companyIndustry: r.ow_companies?.industry ?? null,
      companyLogoUrl: r.ow_companies?.logo_url ?? null,
      companyLogoGradient: r.ow_companies?.logo_gradient ?? null,
      companyLogoLetter: r.ow_companies?.logo_letter ?? null,
      currentJobType: profile?.current_job_type ?? null,
      experienceYears: profile?.experience_years ?? null,
      workStyle: profile?.work_style ?? null,
      preferredLocations: profile?.preferred_locations ?? null,
      skillTags: skillMap[r.user_id] ?? [],
      createdAt: r.created_at ?? null,
    };
  });
}

export default async function PeoplePage() {
  const ambassadors = await getAmbassadors();

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <PeopleListClient ambassadors={ambassadors} />
    </div>
  );
}
