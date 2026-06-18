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
  logo_url: string | null;
  logo_gradient: string | null;
  logo_letter: string | null;
};

type ProfileRow = {
  user_id: string;
  headline: string | null;
  years_of_experience: number | null;
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
  steps: PublicStep[];
  logoMap: Record<string, CompanyLogo>;
};

// ────────────────────────────────────────────────────────────────
// ロゴ（リスト用 小さめ）
// ────────────────────────────────────────────────────────────────

function LogoChip({
  logo,
  name,
  isCurrent,
}: {
  logo: CompanyLogo | null;
  name: string;
  isCurrent: boolean;
}) {
  const size = 32;
  const inner = logo?.logo_url ? (
    <img
      src={logo.logo_url}
      alt={name}
      width={size}
      height={size}
      style={{ borderRadius: 6, objectFit: "cover", display: "block" }}
    />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: 6,
      background: logo?.logo_gradient ?? "linear-gradient(135deg, #001233 0%, #002366 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 800, fontSize: 13, fontFamily: "Inter, sans-serif",
    }}>
      {logo?.logo_letter ?? name.charAt(0)}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
      <div style={{
        position: "relative",
        border: isCurrent ? "2px solid var(--royal)" : "2px solid transparent",
        borderRadius: 8,
        padding: 1,
      }}>
        {inner}
        {isCurrent && (
          <div style={{
            position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)",
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--royal)",
          }} />
        )}
      </div>
      <div style={{
        fontSize: 9, color: "var(--ink-mute)", maxWidth: 52,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        textAlign: "center",
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
  // 古い順（display_order 降順: 5→4→3→2→1）に並べ、company_id で重複排除
  const sortedSteps = [...card.steps].sort((a, b) => b.display_order - a.display_order);
  const seenCompanyIds = new Set<string>();
  const uniqueSteps = sortedSteps.filter((s) => {
    if (!s.company_id) return true;
    if (seenCompanyIds.has(s.company_id)) return false;
    seenCompanyIds.add(s.company_id);
    return true;
  });

  const MAX_LOGOS = 5;
  const overflow = uniqueSteps.length > MAX_LOGOS ? uniqueSteps.length - MAX_LOGOS : 0;
  const visibleSteps = uniqueSteps.slice(0, MAX_LOGOS);

  return (
    <Link
      href={`/career-trajectories/${card.userId}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "20px",
        height: "100%",
        boxSizing: "border-box",
        transition: "box-shadow 0.15s, border-color 0.15s",
        cursor: "pointer",
      }}
        className="trajectory-card"
      >
        {/* ヘッダー: 匿名アバター + ヘッドライン */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #001233 0%, #002366 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
              {card.headline ?? "キャリア軌跡"}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
              社会人歴{card.yearsOfExperience ? ` ${card.yearsOfExperience}年` : ""} · {card.steps.length}社
            </div>
          </div>
        </div>

        {/* ロゴ軌跡ストリップ */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 0,
          padding: "12px 0 8px",
          borderTop: "1px solid var(--line-soft)",
        }}>
          {visibleSteps.map((step, i) => {
            const logo = step.company_id ? (card.logoMap[step.company_id] ?? null) : null;
            const name = step.visibility_company === "real"
              ? (step.company_text ?? logo?.name ?? step.company_anonymized ?? "非公開")
              : (step.company_anonymized ?? "非公開");

            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
                <LogoChip logo={logo} name={name} isCurrent={step.is_current} />
                {i < visibleSteps.length - 1 && (
                  <div style={{
                    width: 20, height: 1,
                    borderTop: "2px dashed var(--line)",
                    margin: "0 2px", marginBottom: 18,
                    flexShrink: 0,
                  }} />
                )}
              </div>
            );
          })}
          {overflow > 0 && (
            <div style={{
              display: "flex", alignItems: "center",
            }}>
              <div style={{
                width: 20, height: 1,
                borderTop: "2px dashed var(--line)",
                margin: "0 2px", marginBottom: 18,
                flexShrink: 0,
              }} />
              <div style={{
                width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                background: "var(--line-soft)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: "var(--ink-mute)",
                fontFamily: "Inter, sans-serif",
              }}>
                +{overflow}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--royal)", fontWeight: 600 }}>
          詳しく見る →
        </div>
      </div>
    </Link>
  );
}

// ────────────────────────────────────────────────────────────────
// データ取得
// ────────────────────────────────────────────────────────────────

async function getProfiles(): Promise<CardData[]> {
  const supabase = createClient();

  // is_published=true のプロフィール一覧
  const { data: profiles } = await supabase
    .from("ow_career_profiles")
    .select("user_id, headline, years_of_experience")
    .eq("is_published", true) as { data: ProfileRow[] | null };

  if (!profiles || profiles.length === 0) return [];

  const userIds = profiles.map((p) => p.user_id);

  // ユーザー名一括取得
  const { data: users } = await supabase
    .from("ow_users")
    .select("id, name")
    .in("id", userIds) as { data: UserRow[] | null };

  const userMap: Record<string, string | null> = {};
  for (const u of users ?? []) userMap[u.id] = u.name;

  // 各プロフィールのステップを取得（セキュリティ: get_public_career_steps 経由）
  const cards: CardData[] = [];

  for (const profile of profiles) {
    const { data: steps } = await supabase.rpc("get_public_career_steps", {
      p_user_id: profile.user_id,
    });

    if (!steps || steps.length === 0) continue;

    const typedSteps = steps as PublicStep[];

    // 実名公開企業のロゴ取得
    const companyIds = typedSteps
      .filter((s) => s.visibility_company === "real" && s.company_id)
      .map((s) => s.company_id as string);

    const logoMap: Record<string, CompanyLogo> = {};
    if (companyIds.length > 0) {
      const adminSupabase = createAdminClient();
      const { data: logos } = await adminSupabase
        .from("ow_companies")
        .select("id, name, logo_url, logo_gradient, logo_letter")
        .in("id", companyIds);
      if (logos) {
        for (const l of logos) logoMap[l.id] = l;
      }
    }

    cards.push({
      userId: profile.user_id,
      userName: userMap[profile.user_id] ?? null,
      headline: profile.headline,
      yearsOfExperience: profile.years_of_experience,
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

      {/* ── ヒーローバンド ── */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
        padding: "48px 24px 44px",
        color: "#fff",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", opacity: 0.6, marginBottom: 8 }}>
            CAREER TRAJECTORIES
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 10px", fontFamily: "Noto Serif JP, serif" }}>
            キャリア軌跡
          </h1>
          <p style={{ fontSize: 14, opacity: 0.8, margin: 0, lineHeight: 1.7, maxWidth: 520 }}>
            IT/SaaS 業界で活躍する先輩たちの実際のキャリアパスを、
            本人の希望する範囲で公開しています。
          </p>
          <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={{
              background: "rgba(255,255,255,0.12)", borderRadius: 100,
              padding: "4px 12px", fontSize: 12,
            }}>
              {cards.length}件公開中
            </span>
          </div>
        </div>
      </div>

      {/* ── グリッド ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>

        <style>{`
          .trajectory-card:hover {
            box-shadow: 0 4px 24px rgba(0,35,102,0.10);
            border-color: var(--royal-100);
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
