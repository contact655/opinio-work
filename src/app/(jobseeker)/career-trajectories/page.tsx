import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

// ────────────────────────────────────────────────────────────────
// 型
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

type CardData = {
  userId: string;
  userName: string | null;
  headline: string | null;
  yearsOfExperience: number | null;
  gender: string | null;
  birthYear: number | null;
  steps: PublicStep[];
  logoMap: Record<string, CompanyLogo>;
};

// ────────────────────────────────────────────────────────────────
// ブランド名抽出（「株式会社」「合同会社」などを除去）
// ────────────────────────────────────────────────────────────────

function toBrandName(fullName: string): string {
  return fullName
    .replace(/^(株式会社|合同会社|有限会社|一般社団法人|特定非営利活動法人|NPO法人)\s*/, "")
    .replace(/\s*(株式会社|合同会社|有限会社)$/, "")
    .trim() || fullName;
}

function getDisplayName(step: PublicStep, logo: CompanyLogo | null): string {
  if (step.visibility_company !== "real") {
    return step.company_anonymized ?? "非公開";
  }
  if (logo?.brand_name) return logo.brand_name;
  if (logo?.name) return toBrandName(logo.name);
  if (step.company_text) return toBrandName(step.company_text);
  return step.company_anonymized ?? "非公開";
}

// ────────────────────────────────────────────────────────────────
// ロゴチップ（直近3社用・大きめ）
// ────────────────────────────────────────────────────────────────

function LogoChip({
  logo,
  name,
  isCurrent,
  size = 52,
}: {
  logo: CompanyLogo | null;
  name: string;
  isCurrent: boolean;
  size?: number;
}) {
  const inner = logo?.logo_url ? (
    <img
      src={logo.logo_url}
      alt={name}
      width={size}
      height={size}
      style={{ borderRadius: 10, objectFit: "cover", display: "block" }}
    />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: 10,
      background: logo?.logo_gradient ?? "linear-gradient(135deg, #001233 0%, #002366 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 800, fontSize: Math.round(size * 0.36),
      fontFamily: "Inter, sans-serif",
    }}>
      {logo?.logo_letter ?? name.charAt(0)}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <div style={{
        position: "relative",
        border: isCurrent ? "2.5px solid var(--royal)" : "2px solid var(--line)",
        borderRadius: 12,
        padding: 2,
        background: isCurrent ? "var(--royal-50)" : "transparent",
      }}>
        {inner}
        {isCurrent && (
          <div style={{
            position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
            background: "var(--royal)", color: "#fff",
            fontSize: 8, fontWeight: 800, fontFamily: "Inter, sans-serif",
            padding: "1px 5px", borderRadius: 100, whiteSpace: "nowrap",
            letterSpacing: "0.05em",
          }}>
            現職
          </div>
        )}
      </div>
      <div style={{
        fontSize: 11, color: isCurrent ? "var(--ink)" : "var(--ink-soft)",
        fontWeight: isCurrent ? 700 : 500,
        maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis",
        whiteSpace: "nowrap", textAlign: "center",
      }}>
        {name}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// カード
// ────────────────────────────────────────────────────────────────

function TrajectoryCard({ card }: { card: CardData }) {
  // 古い順（display_order降順 = 最古→最新）で並べ、連続同社を除去
  const sortedSteps = [...card.steps].sort((a, b) => b.display_order - a.display_order);
  const uniqueSteps = sortedSteps.filter((s, i) => {
    if (i === 0) return true;
    return !(s.company_id && s.company_id === sortedSteps[i - 1].company_id);
  });

  // 直近3社（末尾から3件 = 最新3社）
  const MAX_SHOW = 3;
  const olderCount = uniqueSteps.length > MAX_SHOW ? uniqueSteps.length - MAX_SHOW : 0;
  const recentSteps = uniqueSteps.slice(olderCount); // 古い→新しい順の末尾3件

  const currentStep = uniqueSteps.find((s) => s.is_current);

  return (
    <Link
      href={`/career-trajectories/${card.userId}`}
      style={{ textDecoration: "none", display: "block", height: "100%" }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "24px 24px 18px",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 0,
          transition: "box-shadow 0.15s, border-color 0.15s, transform 0.15s",
          cursor: "pointer",
        }}
        className="trajectory-card"
      >
        {/* メタ情報チップ */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          {card.birthYear && (
            <span style={{
              fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif",
              color: "var(--ink)", background: "var(--bg-tint)",
              borderRadius: 100, padding: "4px 12px",
              border: "1px solid var(--line)",
            }}>
              {new Date().getFullYear() - card.birthYear}歳
            </span>
          )}
          {card.gender && (
            <span style={{
              fontSize: 13, fontWeight: 700,
              color: "var(--ink)", background: "var(--bg-tint)",
              borderRadius: 100, padding: "4px 12px",
              border: "1px solid var(--line)",
            }}>
              {card.gender}
            </span>
          )}
          {card.yearsOfExperience && (
            <span style={{
              fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif",
              color: "var(--ink-soft)", background: "var(--bg-tint)",
              borderRadius: 100, padding: "4px 12px",
              border: "1px solid var(--line)",
            }}>
              社会人歴 {card.yearsOfExperience}年
            </span>
          )}
          <span style={{
            fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif",
            color: "var(--ink-soft)", background: "var(--bg-tint)",
            borderRadius: 100, padding: "4px 12px",
            border: "1px solid var(--line)",
          }}>
            {card.steps.length}社経験
          </span>
        </div>

        {/* ロゴ軌跡ストリップ（直近3社） */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 4,
          flex: 1, paddingBottom: 8,
        }}>
          {/* 古い社の省略表示 */}
          {olderCount > 0 && (
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: "var(--line-soft)", border: "1px dashed var(--line)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: "var(--ink-mute)",
                  fontFamily: "Inter, sans-serif",
                }}>
                  +{olderCount}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 500 }}>
                  前職
                </div>
              </div>
              <div style={{
                width: 20, height: 1, borderTop: "2px dashed var(--line)",
                margin: "0 4px", marginBottom: 18, flexShrink: 0,
              }} />
            </div>
          )}

          {/* 直近3社ロゴ */}
          {recentSteps.map((step, i) => {
            const logo = step.company_id ? (card.logoMap[step.company_id] ?? null) : null;
            const name = getDisplayName(step, logo);

            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
                <LogoChip logo={logo} name={name} isCurrent={step.is_current} size={52} />
                {i < recentSteps.length - 1 && (
                  <div style={{
                    width: 20, height: 1,
                    borderTop: "2px dashed var(--line)",
                    margin: "0 4px", marginBottom: 18,
                    flexShrink: 0,
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* 現職 + CTA */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderTop: "1px solid var(--line-soft)", paddingTop: 12, marginTop: 4,
          gap: 8,
        }}>
          {currentStep ? (
            <div style={{ fontSize: 13, color: "var(--ink-mute)", overflow: "hidden", flex: 1, minWidth: 0 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: "var(--royal)",
                background: "var(--royal-50)", borderRadius: 100,
                padding: "2px 7px", marginRight: 6,
              }}>現在</span>
              <span style={{
                fontSize: 13, color: "var(--ink)", fontWeight: 700,
              }}>
                {(() => {
                  const logo = currentStep.company_id ? (card.logoMap[currentStep.company_id] ?? null) : null;
                  return getDisplayName(currentStep, logo);
                })()}
              </span>
            </div>
          ) : <div style={{ flex: 1 }} />}
          <span style={{ fontSize: 13, color: "var(--royal)", fontWeight: 700, flexShrink: 0 }}>
            詳しく見る →
          </span>
        </div>
      </div>
    </Link>
  );
}

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

      {/* ── グリッド ── */}
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
          .trajectory-card:hover {
            box-shadow: 0 4px 24px rgba(0,35,102,0.12);
            border-color: var(--royal-100);
            transform: translateY(-2px);
          }
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
              <TrajectoryCard key={card.userId} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
