import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import PlacementsClient from "./PlacementsClient";

export const metadata: Metadata = {
  title: { absolute: "就職実績管理 | OPINIO Admin" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PlacementsPage() {
  const admin = createAdminClient();

  const [{ data: placements }, { data: users }, { data: companies }, { data: jobs }] = await Promise.all([
    admin
      .from("ow_placements")
      .select("id, candidate_id, company_id, job_id, joined_at, channel, annual_salary, fee_amount, resigned_at, resignation_reason, created_at")
      .order("joined_at", { ascending: false }),
    admin
      .from("ow_users")
      .select("id, name")
      .order("name"),
    admin
      .from("ow_companies")
      .select("id, name")
      .order("name"),
    admin
      .from("ow_jobs")
      .select("id, title, company_id")
      .order("title"),
  ]);

  // ユーザー・企業・求人をマップ化
  const userMap = new Map((users ?? []).map((u: any) => [u.id, u.name ?? "名前未設定"]));
  const companyMap = new Map((companies ?? []).map((c: any) => [c.id, c.name]));
  const jobMap = new Map((jobs ?? []).map((j: any) => [j.id, { title: j.title, companyId: j.company_id }]));

  const enriched = (placements ?? []).map((p: any) => {
    const joinedAt = new Date(p.joined_at);
    const twoYearsLater = new Date(joinedAt);
    twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2);
    const now = new Date();
    const daysLeft = p.resigned_at
      ? null
      : Math.max(0, Math.ceil((twoYearsLater.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      ...p,
      candidateName: userMap.get(p.candidate_id) ?? p.candidate_id,
      companyName: companyMap.get(p.company_id) ?? p.company_id,
      jobTitle: p.job_id ? (jobMap.get(p.job_id)?.title ?? "—") : "—",
      daysLeft,
    };
  });

  return (
    <PlacementsClient
      placements={enriched}
      users={(users ?? []).map((u: any) => ({ id: u.id as string, name: (u.name ?? "名前未設定") as string }))}
      companies={(companies ?? []).map((c: any) => ({ id: c.id as string, name: c.name as string }))}
      jobs={(jobs ?? []).map((j: any) => ({ id: j.id as string, title: j.title as string, companyId: j.company_id as string }))}
    />
  );
}
