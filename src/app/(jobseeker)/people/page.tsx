export const revalidate = 300;

import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { PeopleListClient, type AmbassadorCard, type PeerCard } from "./PeopleListClient";

export const metadata: Metadata = {
  title: { absolute: "先輩を知る | OPINIO" },
  description: "IT/SaaS企業の現役社員・OB/OGに、はたらくリアルを直接聞いてみましょう。キャリア選択の参考に。",
  alternates: { canonical: "https://opinio.jp/people" },
  openGraph: {
    title: "先輩を知る — 話せる人を探す | OPINIO",
    description: "IT/SaaS企業の現役社員・OB/OGに、はたらくリアルを直接聞いてみましょう。",
    type: "website",
    url: "https://opinio.jp/people",
    images: [{ url: "https://opinio.jp/api/og?title=%E5%85%88%E8%BC%A9%E3%82%92%E7%9F%A5%E3%82%8B&subtitle=IT%2FSaaS%E6%A5%AD%E7%95%8C%E3%81%AE%E7%8F%BE%E5%BD%B9%E7%A4%BE%E5%93%A1%E3%81%A8%E8%A9%B1%E3%81%9B%E3%82%8B", width: 1200, height: 630 }],
  },
};

type DbAmbassador = {
  id: string;
  user_id: string;
  company_id: string;
  role_title: string | null;
  department: string | null;
  talk_themes: string[] | null;
  user: { id: string; name: string | null; avatar_color: string | null; avatar_url: string | null; visibility: string | null } | null;
  company: {
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
    .from("ow_company_admins")
    .select(`
      id,
      user_id,
      company_id,
      role_title,
      department,
      talk_themes,
      user:ow_users!user_id(id, name, avatar_color, avatar_url, visibility),
      company:ow_companies!company_id(id, name, brand_name, logo_url, logo_gradient, logo_letter, phase, industry)
    `)
    .eq("is_ambassador", true)
    .eq("is_active", true)
    .not("user_id", "is", null)
    .order("company_id", { ascending: true });

  if (error) {
    console.error("[people] fetch error:", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as DbAmbassador[];

  return rows
    .filter((r) => r.user?.visibility === "public" && r.user?.name)
    .map((r) => {
      const gradient =
        r.user?.avatar_color?.startsWith("linear-gradient")
          ? r.user.avatar_color
          : FALLBACK_GRADIENT;

      return {
        adminId: r.id,
        userId: r.user_id,
        name: r.user?.name ?? "—",
        initial: r.user?.name?.charAt(0) ?? "?",
        gradient,
        avatarUrl: r.user?.avatar_url ?? null,
        roleTitle: r.role_title,
        department: r.department,
        talkThemes: r.talk_themes ?? [],
        companyId: r.company?.id ?? r.company_id,
        companyName: r.company?.brand_name ?? r.company?.name ?? "—",
        companyPhase: r.company?.phase ?? null,
        companyIndustry: r.company?.industry ?? null,
        companyLogoUrl: r.company?.logo_url ?? null,
        companyLogoGradient: r.company?.logo_gradient ?? null,
        companyLogoLetter: r.company?.logo_letter ?? null,
      };
    });
}

async function getPeers(): Promise<PeerCard[]> {
  const adminSupabase = createAdminClient();

  // キャリア軌跡を公開しているユーザーを取得
  const { data: careerProfiles, error } = await adminSupabase
    .from("ow_career_profiles")
    .select("user_id, headline, years_of_experience, ow_users(id, name, avatar_color, avatar_url, auth_id, visibility)")
    .eq("is_published", true)
    .order("updated_at", { ascending: false });

  if (error || !careerProfiles || careerProfiles.length === 0) return [];

  type CareerRow = {
    user_id: string;
    headline: string | null;
    years_of_experience: number | null;
    ow_users: { id: string; name: string | null; avatar_color: string | null; avatar_url: string | null; auth_id: string | null; visibility: string | null } | null;
  };

  const rows = careerProfiles as unknown as CareerRow[];
  const validRows = rows.filter((r) => r.ow_users?.visibility === "public" && r.ow_users?.name);

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
