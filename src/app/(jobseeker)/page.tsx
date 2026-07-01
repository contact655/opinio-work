import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import HomePageClient from "./HomePageClient";

export const metadata: Metadata = {
  title: { absolute: "OPINIO | IT/SaaS業界の転職・求人情報" },
  description:
    "IT/SaaS業界の転職は、情報戦。OPINIO編集部が取材した企業情報と求人を掲載。スカウトなし・カジュアル面談で、納得のいくキャリア選択を。完全無料。",
  alternates: { canonical: "https://opinio.jp" },
  openGraph: {
    title: "OPINIO | IT/SaaS業界特化のキャリアプラットフォーム",
    description:
      "IT/SaaS業界の転職は、情報戦。OPINIO編集部が取材した企業情報と求人を掲載。スカウトなし・カジュアル面談で、納得のいくキャリア選択を。完全無料。",
    type: "website",
    url: "https://opinio.jp",
  },
};

// 300秒キャッシュ — 企業リストは頻繁に変わらない
const getHomeData = unstable_cache(
  async () => {
    const admin = createAdminClient();
    const [companiesRes, statsRes] = await Promise.all([
      admin
        .from("ow_companies")
        .select(
          "id, name, industry, phase, logo_gradient, logo_letter, logo_url, accepting_casual_meetings, employee_count"
        )
        .eq("is_published", true)
        .order("display_order", { ascending: true, nullsFirst: false })
        .limit(12),
      Promise.all([
        admin.from("ow_companies").select("id", { count: "exact", head: true }).eq("is_published", true),
        admin.from("ow_jobs").select("id", { count: "exact", head: true }).in("status", ["published", "active"]),
      ]),
    ]);

    const companies = (companiesRes.data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      industry: row.industry as string | null,
      phase: row.phase as string | null,
      gradient: (row.logo_gradient as string | null) ?? "linear-gradient(135deg,#001233,#002366)",
      letter: (row.logo_letter as string | null) ?? ((row.name as string)?.[0] ?? ""),
      logoUrl: row.logo_url as string | null,
      acceptingMeeting: (row.accepting_casual_meetings as boolean) ?? false,
      employeeCount: row.employee_count as number | null,
    }));

    const [companiesCount, jobsCount] = statsRes;
    const companyNum = `${companiesCount.count ?? 0}社+`;

    return { companies, companyNum };
  },
  ["home-page-data"],
  { revalidate: 300 }
);

export const revalidate = 300;

export default async function HomePage() {
  const { companies, companyNum } = await getHomeData();
  return <HomePageClient initialCompanies={companies} companyNum={companyNum} />;
}
