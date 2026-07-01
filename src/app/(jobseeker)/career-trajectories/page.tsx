import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "キャリア軌跡 | OPINIO" },
  description: "IT/SaaS業界で活躍する人のキャリア軌跡を公開。転職の経緯・職種変遷・在籍企業の流れをタイムラインで確認できます。",
  alternates: { canonical: "https://opinio.jp/career-trajectories" },
  openGraph: {
    title: "キャリア軌跡 | OPINIO",
    description: "IT/SaaS業界で活躍する人のリアルなキャリア軌跡。転職の経緯・職種変遷をタイムラインで確認。",
    type: "website",
    url: "https://opinio.jp/career-trajectories",
    images: [{ url: "https://opinio.jp/api/og?title=%E3%82%AD%E3%83%A3%E3%83%AA%E3%82%A2%E8%BB%8C%E8%B7%A1&subtitle=IT%2FSaaS%E6%A5%AD%E7%95%8C%E3%81%A7%E6%B4%BB%E8%BA%8D%E3%81%99%E3%82%8B%E4%BA%BA%E3%81%AE%E3%82%AD%E3%83%A3%E3%83%AA%E3%82%A2%E3%82%92%E5%85%AC%E9%96%8B", width: 1200, height: 630 }],
  },
};

export const revalidate = 300;

import { createAdminClient } from "@/lib/supabase/admin";
import { type CardData } from "./TrajectoryCardClient";
import { TrajectoryPageClient } from "./TrajectoryPageClient";

// ────────────────────────────────────────────────────────────────
// サーバー側のみで使う型
// ────────────────────────────────────────────────────────────────

type CompanyLogo = {
  id: string;
  name: string;
  brand_name: string | null;
  logo_url: string | null;
  logo_gradient: string | null;
  logo_letter: string | null;
};

type ExpRow = {
  id: string;
  user_id: string;
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
  role_title: string | null;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
  display_order: number;
  visibility_company: string;
  salary_man: number | null;
  visibility_salary: boolean;
};

// ────────────────────────────────────────────────────────────────
// データ取得
// N+1解消: 旧 3+N+M クエリ → 4クエリ（うち2つ並列）
// ────────────────────────────────────────────────────────────────

async function getProfiles(): Promise<CardData[]> {
  const admin = createAdminClient();

  // ① ow_users と ow_career_profiles を並列取得（旧: 3回逐次 → 2回並列）
  const [usersRes, profilesRes] = await Promise.all([
    admin.from("ow_users").select("id, name, visibility"),
    admin
      .from("ow_career_profiles")
      .select("user_id, headline, years_of_experience, gender, birth_year, verified")
      .eq("is_published", true)
      .order("created_at", { ascending: true })
      .order("user_id", { ascending: true }),
  ]);

  const publicUserSet = new Set(
    (usersRes.data ?? []).filter((u) => u.visibility === "public").map((u) => u.id)
  );
  const userNameMap: Record<string, string | null> = {};
  for (const u of usersRes.data ?? []) userNameMap[u.id] = u.name;

  const profiles = (profilesRes.data ?? [])
    .filter((p) => publicUserSet.has(p.user_id))
    .map((p, idx) => ({ ...p, serialNumber: idx + 1 }));

  if (profiles.length === 0) return [];

  const userIds = profiles.map((p) => p.user_id);

  // ② 全ユーザー分の ow_experiences を一括取得（旧: N回RPC → 1回直接クエリ）
  //    一覧カードに必要な列だけ選択（重いテキスト列は除外してデータ転送量削減）
  const { data: rawExps } = await admin
    .from("ow_experiences")
    .select("id, user_id, company_id, company_text, company_anonymized, role_title, started_at, ended_at, is_current, display_order, visibility_company, salary_man, visibility_salary")
    .in("user_id", userIds)
    .neq("visibility_company", "hidden")
    .order("display_order", { ascending: true }) as { data: ExpRow[] | null };

  const allExps = rawExps ?? [];

  // ③ 全ユーザー分の企業ロゴを一括取得（旧: M回 → 1回）
  const allCompanyIds = Array.from(
    new Set(
      allExps
        .filter((e) => e.visibility_company === "real" && e.company_id)
        .map((e) => e.company_id as string)
    )
  );

  const globalLogoMap: Record<string, CompanyLogo> = {};
  if (allCompanyIds.length > 0) {
    const { data: logos } = await admin
      .from("ow_companies")
      .select("id, name, brand_name, logo_url, logo_gradient, logo_letter")
      .in("id", allCompanyIds);
    for (const l of (logos ?? []) as CompanyLogo[]) globalLogoMap[l.id] = l;
  }

  // ④ ユーザーごとにカードを組み立て（DBアクセスなし）
  const expsByUser: Record<string, ExpRow[]> = {};
  for (const e of allExps) {
    if (!expsByUser[e.user_id]) expsByUser[e.user_id] = [];
    expsByUser[e.user_id].push(e);
  }

  const cards: CardData[] = [];
  for (const profile of profiles) {
    const userExps = expsByUser[profile.user_id] ?? [];
    if (userExps.length === 0) continue;

    // visibility_company でマスキング（get_public_career_steps と同ロジック）
    const steps = userExps.map((e) => ({
      id: e.id,
      company_id: e.visibility_company === "real" ? (e.company_id ?? null) : null,
      company_text: e.company_text,
      company_anonymized: e.company_anonymized,
      role_title: e.role_title,
      started_at: e.started_at,
      ended_at: e.ended_at,
      is_current: e.is_current,
      display_order: e.display_order,
      visibility_company: e.visibility_company as "real" | "masked" | "hidden",
      salary_man: e.visibility_salary ? (e.salary_man ?? null) : null,
      visibility_salary: e.visibility_salary,
    }));

    const logoMap: Record<string, CompanyLogo> = {};
    for (const s of steps) {
      if (s.company_id && globalLogoMap[s.company_id]) {
        logoMap[s.company_id] = globalLogoMap[s.company_id];
      }
    }

    const salaryCurve = steps
      .filter((s) => s.visibility_salary && s.salary_man != null)
      .sort((a, b) => b.display_order - a.display_order)
      .map((s) => s.salary_man as number);

    cards.push({
      userId: profile.user_id,
      userName: userNameMap[profile.user_id] ?? null,
      headline: profile.headline,
      yearsOfExperience: profile.years_of_experience,
      gender: (profile as { gender?: string | null }).gender ?? null,
      birthYear: (profile as { birth_year?: number | null }).birth_year ?? null,
      steps,
      logoMap,
      salaryCurve,
      verified: (profile as { verified?: boolean }).verified ?? false,
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
