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
  talk_themes: string[] | null;
  ow_users: { id: string; name: string; avatar_color: string | null; visibility: string | null; is_test: boolean | null } | null;
  ow_companies: { name: string; brand_name: string | null } | null;
};

type ExpRow = {
  user_id: string;
  company_text: string | null;
  started_at: string | null;
  is_current: boolean | null;
};

export default async function HomePage() {
  const adminSupabase = createAdminClient();

  const { data: raw } = await adminSupabase
    .from("ow_company_members")
    .select(`
      role_title,
      talk_themes,
      ow_users!user_id(id, name, avatar_color, visibility, is_test),
      ow_companies!company_id(name, brand_name)
    `)
    .eq("display_consent", true)
    .eq("is_public", true)
    .limit(8);

  const filtered = (raw ?? [])
    .map((r) => r as unknown as MemberRow)
    .filter((r) => {
      const u = r.ow_users;
      if (!u) return false;
      if (u.is_test === true) return false;
      if (u.visibility === "private") return false;
      return true;
    })
    .slice(0, 4);

  // Fetch career history for each member
  const userIds = filtered.map((r) => r.ow_users!.id);
  const expByUser: Record<string, string[]> = {};

  if (userIds.length > 0) {
    const { data: exps } = await adminSupabase
      .from("ow_experiences")
      .select("user_id, company_text, started_at, is_current")
      .in("user_id", userIds)
      .not("company_text", "is", null)
      .order("started_at", { ascending: true, nullsFirst: false });

    for (const e of (exps ?? []) as ExpRow[]) {
      if (!e.user_id || !e.company_text) continue;
      if (!expByUser[e.user_id]) expByUser[e.user_id] = [];
      expByUser[e.user_id].push(e.company_text);
    }
  }

  const members: LPMember[] = filtered.map((r) => {
    const u = r.ow_users!;
    const co = r.ow_companies;
    const flow = expByUser[u.id] ?? null;
    const quote = r.talk_themes?.[0] ?? null;
    return {
      id: u.id,
      name: u.name,
      avatarColor: u.avatar_color,
      roleTitle: r.role_title,
      companyName: co?.brand_name ?? co?.name ?? null,
      careerFlow: flow && flow.length > 1 ? flow : null,
      quote,
    };
  });

  return <LandingPage members={members} />;
}
