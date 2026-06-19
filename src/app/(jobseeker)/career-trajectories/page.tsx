import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TrajectoryCardClient, type CardData } from "./TrajectoryCardClient";

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
};

type UserRow = {
  id: string;
  name: string | null;
};

// ────────────────────────────────────────────────────────────────
// データ取得
// ────────────────────────────────────────────────────────────────

async function getProfiles(): Promise<CardData[]> {
  const adminSupabase = createAdminClient();

  const { data: publicUsers } = await adminSupabase
    .from("ow_users")
    .select("id")
    .eq("visibility", "public") as { data: { id: string }[] | null };

  const publicUserIds = (publicUsers ?? []).map((u) => u.id);
  if (publicUserIds.length === 0) return [];

  const { data: rawProfiles } = await adminSupabase
    .from("ow_career_profiles")
    .select("user_id, headline, years_of_experience")
    .eq("is_published", true)
    .in("user_id", publicUserIds);

  if (!rawProfiles || rawProfiles.length === 0) return [];

  const extraMap: Record<string, { gender: string | null; birth_year: number | null }> = {};
  const { data: extras, error: extrasError } = await adminSupabase
    .from("ow_career_profiles")
    .select("user_id, gender, birth_year")
    .in("user_id", rawProfiles.map((p) => p.user_id));
  if (!extrasError && extras) {
    for (const e of extras as { user_id: string; gender: string | null; birth_year: number | null }[]) {
      extraMap[e.user_id] = { gender: e.gender ?? null, birth_year: e.birth_year ?? null };
    }
  }

  const profiles: ProfileRow[] = rawProfiles.map((p) => ({
    user_id: p.user_id,
    headline: p.headline,
    years_of_experience: p.years_of_experience,
    gender: extraMap[p.user_id]?.gender ?? null,
    birth_year: extraMap[p.user_id]?.birth_year ?? null,
  }));

  const supabase = createClient();
  const userIds = profiles.map((p) => p.user_id);

  const { data: users } = await supabase
    .from("ow_users")
    .select("id, name")
    .in("id", userIds) as { data: UserRow[] | null };

  const userMap: Record<string, string | null> = {};
  for (const u of users ?? []) userMap[u.id] = u.name;

  const cards: CardData[] = [];

  for (const profile of profiles) {
    const { data: steps } = await supabase.rpc("get_public_career_steps", {
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

    cards.push({
      userId: profile.user_id,
      userName: userMap[profile.user_id] ?? null,
      headline: profile.headline,
      yearsOfExperience: profile.years_of_experience,
      gender: profile.gender ?? null,
      birthYear: profile.birth_year ?? null,
      steps: typedSteps,
      logoMap,
    });
  }

  return cards;
}

// ────────────────────────────────────────────────────────────────
// ページ
// ────────────────────────────────────────────────────────────────

export default async function CareerTrajectoriesPage() {
  const cards = await getProfiles();

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* ページヘッダー */}
        <div style={{ marginBottom: 36 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
            color: "var(--ink-mute)", marginBottom: 6, fontFamily: "Inter, sans-serif",
            textTransform: "uppercase",
          }}>
            Career Trajectories
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, margin: "0 0 10px",
            fontFamily: "Noto Serif JP, serif", color: "var(--ink)",
          }}>
            キャリア軌跡
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0, lineHeight: 1.7, maxWidth: 520 }}>
            IT/SaaS 業界で活躍する先輩たちの実際のキャリアパスを、
            本人の希望する範囲で公開しています。
          </p>
          {cards.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <span style={{
                background: "var(--royal-50)", color: "var(--royal)",
                borderRadius: 100, padding: "4px 14px",
                fontSize: 12, fontWeight: 700,
                border: "1px solid var(--royal-100)",
              }}>
                {cards.length}件公開中
              </span>
            </div>
          )}
        </div>

        <style>{`
          .trajectory-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
          }
          @media (max-width: 900px) {
            .trajectory-grid { grid-template-columns: repeat(2, 1fr); }
          }
          @media (max-width: 560px) {
            .trajectory-grid { grid-template-columns: 1fr; }
          }
        `}</style>

        {cards.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🗺️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
              公開中の軌跡はまだありません
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>
              メンターのキャリア軌跡が公開されると、ここに表示されます。
            </div>
          </div>
        ) : (
          <div className="trajectory-grid">
            {cards.map((card) => (
              <TrajectoryCardClient key={card.userId} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
