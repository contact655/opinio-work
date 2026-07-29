import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import LandingPage, { type LPMember } from "./LandingPage";

export const metadata: Metadata = {
  title: "OPINIO — IT/SaaS業界特化のキャリアプラットフォーム",
  description:
    "取材された企業情報と求人を、ひとつの場所に。スカウトも営業電話もなく、自分のペースでIT/SaaS企業のリアルを調べられます。",
  openGraph: {
    title: "OPINIO — 知ってから、動く。",
    description:
      "IT/SaaS業界に特化したキャリアプラットフォーム。取材された企業情報と求人票で、追われずに転職を考えられます。",
    url: "https://opinio.jp",
    siteName: "OPINIO",
    locale: "ja_JP",
    type: "website",
  },
  alternates: { canonical: "https://opinio.jp" },
};

type MemberRow = {
  role_title: string | null;
  ow_users: { id: string; name: string; avatar_color: string | null; visibility: string | null; is_test: boolean | null } | null;
  ow_companies: { name: string; brand_name: string | null } | null;
};

export default async function HomePage() {
  const adminSupabase = createAdminClient();

  const { data: raw } = await adminSupabase
    .from("ow_company_members")
    .select(`
      role_title,
      ow_users!user_id(id, name, avatar_color, visibility, is_test),
      ow_companies!company_id(name, brand_name)
    `)
    .eq("display_consent", true)
    .eq("is_public", true)
    .limit(8);

  const members: LPMember[] = (raw ?? [])
    .map((r) => r as unknown as MemberRow)
    .filter((r) => {
      const u = r.ow_users;
      if (!u) return false;
      if (u.is_test === true) return false;
      if (u.visibility === "private") return false;
      return true;
    })
    .map((r) => {
      const u = r.ow_users!;
      const co = r.ow_companies;
      return {
        id: u.id,
        name: u.name,
        avatarColor: u.avatar_color,
        roleTitle: r.role_title,
        companyName: co?.brand_name ?? co?.name ?? null,
      };
    })
    .slice(0, 4);

  return <LandingPage members={members} />;
}
