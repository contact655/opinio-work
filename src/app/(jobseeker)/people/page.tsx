export const revalidate = 300;

import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { PeopleListClient, type AmbassadorCard } from "./PeopleListClient";

export const metadata: Metadata = {
  title: { absolute: "話せる人 | OPINIO" },
  description: "OPINIO に登録している企業の社員・OB/OGの中から、採用に関わっている方に直接話を聞けます。",
  alternates: { canonical: "https://opinio.jp/people" },
  openGraph: {
    title: "話せる人 | OPINIO",
    description: "企業の現役社員に、仕事のリアルを直接聞いてみませんか。",
    type: "website",
    url: "https://opinio.jp/people",
    images: [{ url: "https://opinio.jp/api/og?title=%E8%A9%B1%E3%81%9B%E3%82%8B%E4%BA%BA&subtitle=IT%2FSaaS%E6%A5%AD%E7%95%8C%E3%81%AE%E7%8F%BE%E5%BD%B9%E7%A4%BE%E5%93%A1%E3%81%A8%E8%A9%B1%E3%81%9B%E3%82%8B", width: 1200, height: 630 }],
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

export default async function PeoplePage() {
  const ambassadors = await getAmbassadors();

  // 企業ごとにグループ化してフィルター用のリストを作成
  const companies = Array.from(
    new Map(
      ambassadors.map((a) => [a.companyId, { id: a.companyId, name: a.companyName }])
    ).values()
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <h1 className="sr-only">話せる人</h1>
      <PeopleListClient ambassadors={ambassadors} companies={companies} />
    </div>
  );
}
