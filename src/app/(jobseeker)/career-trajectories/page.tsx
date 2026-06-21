export const dynamic = "force-dynamic";

import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { type CardData } from "./TrajectoryCardClient";
import { TrajectoryPageClient } from "./TrajectoryPageClient";

// ────────────────────────────────────────────────────────────────
// サーバー側のみで使う型
// ────────────────────────────────────────────────────────────────

type PublicStep = {
  id: string;
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
  role_title: string | null;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
  display_order: number;
  visibility_company: "real" | "masked" | "hidden";
  salary_man: number | null;
  visibility_salary: boolean;
};

type CompanyLogo = {
  id: string;
  name: string;
  brand_name: string | null;
  logo_url: string | null;
  logo_gradient: string | null;
  logo_letter: string | null;
};

type ProfileRow = {
  user_id: string;
  headline: string | null;
  years_of_experience: number | null;
  gender: string | null;
  birth_year: number | null;
  verified: boolean;
};

type UserRow = {
  id: string;
  name: string | null;
};

// ────────────────────────────────────────────────────────────────
// データ取得
// ────────────────────────────────────────────────────────────────

async function getProfiles(): Promise<CardData[]> {
  noStore();
  const adminSupabase = createAdminClient();

  const { data: publicUsers } = await adminSupabase
    .from("ow_users")
    .select("id")
    .eq("visibility", "public") as { data: { id: string }[] | null };

  const publicUserIds = (publicUsers ?? []).map((u) => u.id);
  if (publicUserIds.length === 0) return [];

  const { data: rawProfiles } = await adminSupabase
    .from("ow_career_profiles")
    .select("user_id, headline, years_of_experience, gender, birth_year, verified")
    .eq("is_published", true)
    .in("user_id", publicUserIds)
    .order("created_at", { ascending: true })
    .order("user_id", { ascending: true });

  if (!rawProfiles || rawProfiles.length === 0) return [];

  const profiles: (ProfileRow & { serialNumber: number })[] = rawProfiles.map((p, idx) => ({
    user_id: p.user_id,
    headline: p.headline,
    years_of_experience: p.years_of_experience,
    gender: (p as { gender?: string | null }).gender ?? null,
    birth_year: (p as { birth_year?: number | null }).birth_year ?? null,
    verified: (p as { verified?: boolean }).verified ?? false,
    serialNumber: idx + 1,
  }));

  const userIds = profiles.map((p) => p.user_id);

  const { data: users } = await adminSupabase
    .from("ow_users")
    .select("id, name")
    .in("id", userIds) as { data: UserRow[] | null };

  const userMap: Record<string, string | null> = {};
  for (const u of users ?? []) userMap[u.id] = u.name;

  const cards: CardData[] = [];

  for (const profile of profiles) {
    const { data: steps } = await adminSupabase.rpc("get_public_career_steps", {
      p_user_id: profile.user_id,
    });

    if (!steps || steps.length === 0) continue;

    const typedSteps = steps as PublicStep[];

    const companyIds = typedSteps
      .filter((s) => s.visibility_company === "real" && s.company_id)
      .map((s) => s.company_id as string);

    const logoMap: Record<string, CompanyLogo> = {};
    if (companyIds.length > 0) {
      const { data: logos } = await adminSupabase
        .from("ow_companies")
        .select("id, name, brand_name, logo_url, logo_gradient, logo_letter")
        .in("id", companyIds);
      if (logos) {
        for (const l of logos as CompanyLogo[]) logoMap[l.id] = l;
      }
    }

    // 年収カーブ: visibility_salary=true かつ salary_man 非 null の点を時系列昇順で抽出
    // display_order は大きいほど「古い」（カードのロゴストリップと同じ降順設計）
    // → 降順ソートで先頭が最古 = 左から右に時系列順（古→新）
    const salaryCurve = typedSteps
      .filter((s) => s.visibility_salary && s.salary_man != null)
      .sort((a, b) => b.display_order - a.display_order)
      .map((s) => s.salary_man as number);

    cards.push({
      userId: profile.user_id,
      userName: userMap[profile.user_id] ?? null,
      headline: profile.headline,
      yearsOfExperience: profile.years_of_experience,
      gender: profile.gender ?? null,
      birthYear: profile.birth_year ?? null,
      steps: typedSteps,
      logoMap,
      salaryCurve,
      verified: profile.verified,
      serialNumber: profile.serialNumber,
    });
  }

  return cards;
}

// ────────────────────────────────────────────────────────────────
// ページ
// ────────────────────────────────────────────────────────────────

export default async function CareerTrajectoriesPage() {
  const cards = await getProfiles();

  return <TrajectoryPageClient cards={cards} />;
}
