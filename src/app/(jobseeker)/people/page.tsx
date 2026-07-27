export const revalidate = 3600;

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
      ow_users!user_id(id, name, avatar_color, avatar_url, visibility, is_test),
      ow_companies!company_id(id, name, brand_name, logo_url, logo_gradient, logo_letter, phase)
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
    !r.ow_users?.is_test
  );

  if (filteredRows.length === 0) return [];

  // Fetch profiles for all user_ids in bulk
  const userIds = filteredRows.map((r) => r.user_id);
  const careerRes = await adminSupabase
    .from("ow_career_profiles")
    .select("user_id, birth_year")
    .in("user_id", userIds);

  const birthYearMap: Record<string, number | null> = {};
  for (const c of careerRes.data ?? []) {
    const cc = c as { user_id: string; birth_year: number | null };
    birthYearMap[cc.user_id] = cc.birth_year;
  }

  return filteredRows.map((r) => {
    const gradient =
      r.ow_users?.avatar_color?.startsWith("linear-gradient")
        ? r.ow_users.avatar_color
        : FALLBACK_GRADIENT;

    return {
      adminId: r.id,
      userId: r.user_id,
      name: r.ow_users?.name ?? "—",
      initial: r.ow_users?.name?.charAt(0) ?? "?",
      gradient,
      avatarUrl: r.ow_users?.avatar_url ?? null,
      roleTitle: r.role_title,
      talkThemes: r.talk_themes ?? [],
      companyId: r.ow_companies?.id ?? r.company_id,
      companyName: r.ow_companies?.brand_name ?? r.ow_companies?.name ?? "—",
      companyPhase: r.ow_companies?.phase ?? null,
      companyLogoUrl: r.ow_companies?.logo_url ?? null,
      companyLogoGradient: r.ow_companies?.logo_gradient ?? null,
      companyLogoLetter: r.ow_companies?.logo_letter ?? null,
      birthYear: birthYearMap[r.user_id] ?? null,
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
