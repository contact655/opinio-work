export const revalidate = 300;

import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { PeopleListClient, type AmbassadorCard, type PeerCard } from "./PeopleListClient";

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
  ow_users: { id: string; name: string | null; avatar_color: string | null; avatar_url: string | null; visibility: string | null } | null;
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
      ow_users!user_id(id, name, avatar_color, avatar_url, visibility),
      ow_companies!company_id(id, name, brand_name, logo_url, logo_gradient, logo_letter, phase, industry)
    `)
    .eq("display_consent", true)
    .eq("is_public", true)
    .order("company_id", { ascending: true });

  if (error) {
    console.error("[people] fetch error:", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as DbAmbassador[];

  return rows
    .filter((r) => r.ow_users?.visibility !== "private" && r.ow_users?.name)
    .map((r) => {
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
        department: null,
        talkThemes: r.talk_themes ?? [],
        companyId: r.ow_companies?.id ?? r.company_id,
        companyName: r.ow_companies?.brand_name ?? r.ow_companies?.name ?? "—",
        companyPhase: r.ow_companies?.phase ?? null,
        companyIndustry: r.ow_companies?.industry ?? null,
        companyLogoUrl: r.ow_companies?.logo_url ?? null,
        companyLogoGradient: r.ow_companies?.logo_gradient ?? null,
        companyLogoLetter: r.ow_companies?.logo_letter ?? null,
      };
    });
}

async function getPeers(): Promise<PeerCard[]> {
  const adminSupabase = createAdminClient();

  // キャリア軌跡を公開しているユーザーを取得
  const { data: careerProfiles, error } = await adminSupabase
    .from("ow_career_profiles")
    .select("user_id, headline, years_of_experience, birth_year, ow_users(id, name, avatar_color, avatar_url, auth_id, visibility)")
    .eq("is_published", true)
    .order("updated_at", { ascending: false });

  if (error || !careerProfiles || careerProfiles.length === 0) return [];

  type CareerRow = {
    user_id: string;
    headline: string | null;
    years_of_experience: number | null;
    birth_year: number | null;
    ow_users: { id: string; name: string | null; avatar_color: string | null; avatar_url: string | null; auth_id: string | null; visibility: string | null } | null;
  };

  const rows = careerProfiles as unknown as CareerRow[];
  const validRows = rows.filter((r) => r.ow_users?.visibility !== "private" && r.ow_users?.name);

  if (validRows.length === 0) return [];

  const userIds = validRows.map((r) => r.user_id);
  const authIds = validRows.map((r) => r.ow_users?.auth_id).filter(Boolean) as string[];

  // 現職情報
  const { data: exps } = await adminSupabase
    .from("ow_experiences")
    .select("user_id, role_title, company_text, company_anonymized")
    .in("user_id", userIds)
    .eq("is_current", true);

  const expByUser = new Map<string, { role_title: string | null; company: string | null }>();
  for (const exp of exps ?? []) {
    if (!expByUser.has(exp.user_id as string)) {
      expByUser.set(exp.user_id as string, {
        role_title: exp.role_title as string | null,
        company: (exp.company_text as string | null) || (exp.company_anonymized as string | null) || null,
      });
    }
  }

  // job_type
  const jobTypeByAuthId = new Map<string, string | null>();
  if (authIds.length > 0) {
    const { data: profiles } = await adminSupabase
      .from("ow_profiles")
      .select("user_id, job_type")
      .in("user_id", authIds);
    for (const p of profiles ?? []) {
      jobTypeByAuthId.set(p.user_id as string, p.job_type as string | null);
    }
  }

  return validRows.map((r) => {
    const u = r.ow_users!;
    const gradient = u.avatar_color?.startsWith("linear-gradient") ? u.avatar_color : FALLBACK_GRADIENT;
    const exp = expByUser.get(r.user_id) ?? null;
    const jobType = u.auth_id ? (jobTypeByAuthId.get(u.auth_id) ?? null) : null;
    return {
      userId: r.user_id,
      name: u.name ?? "名前未設定",
      initial: (u.name ?? "?").charAt(0),
      gradient,
      avatarUrl: u.avatar_url ?? null,
      roleTitle: exp?.role_title ?? null,
      companyName: exp?.company ?? null,
      jobType,
      headline: r.headline,
      yearsOfExperience: r.years_of_experience,
      birthYear: r.birth_year ?? null,
    };
  });
}

export default async function PeoplePage() {
  const [ambassadors, peers] = await Promise.all([getAmbassadors(), getPeers()]);

  // 企業ごとにグループ化してフィルター用のリストを作成
  const companies = Array.from(
    new Map(
      ambassadors.map((a) => [a.companyId, { id: a.companyId, name: a.companyName }])
    ).values()
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <PeopleListClient ambassadors={ambassadors} peers={peers} companies={companies} />
    </div>
  );
}
